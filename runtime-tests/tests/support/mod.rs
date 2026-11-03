// Author: Tommy
use near_jsonrpc_primitives::types::transactions::TransactionInfo;
use near_primitives::{hash::CryptoHash, views::TxExecutionStatus};
use near_workspaces::{
    Account, AccountId, Contract, Worker,
    network::Sandbox,
    operations::CallTransaction,
    result::ExecutionFinalResult,
    types::{AccessKey, Gas, KeyType, NearToken, SecretKey},
};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{error::Error, path::PathBuf, time::Duration};

pub type Result<T = ()> = std::result::Result<T, Box<dyn Error + Send + Sync>>;
pub const PRICE: u128 = 10_000_000_000_000_000_000_000;
pub fn baseline_hash() -> Result<String> {
    let hash = std::env::var("AGENTGUARD_RUNTIME_SHA256")?;
    assert!(hash.len() == 64 && hash.bytes().all(|b| b.is_ascii_hexdigit()));
    Ok(hash)
}
pub struct Fixture {
    pub worker: Worker<Sandbox>,
    pub owner: Account,
    pub agent: Account,
    pub vault: Contract,
    pub merchant: Account,
    pub missing: AccountId,
}
impl Fixture {
    pub async fn new() -> Result<Self> {
        let path = std::env::var_os("AGENTGUARD_RUNTIME_WASM")
            .map(PathBuf::from)
            .unwrap_or_else(|| {
                PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("../target/wasm32-unknown-unknown/release/agent_guard.wasm")
            });
        let wasm = std::fs::read(path)?;
        assert_eq!(
            format!("{:x}", Sha256::digest(&wasm)),
            baseline_hash()?,
            "Artifact differs from the runner-verified fresh build"
        );
        Self::from_wasm(&wasm).await
    }
    pub async fn callback_fault() -> Result<Self> {
        let path = std::env::var("AGENTGUARD_CALLBACK_WASM")?;
        let expected = std::env::var("AGENTGUARD_CALLBACK_SHA256")?;
        let wasm = std::fs::read(path)?;
        assert_eq!(format!("{:x}", Sha256::digest(&wasm)), expected);
        assert_ne!(
            expected,
            baseline_hash()?,
            "fault injection must be a separately identified artifact"
        );
        Self::from_wasm(&wasm).await
    }
    async fn from_wasm(wasm: &[u8]) -> Result<Self> {
        let worker = near_workspaces::sandbox().await?;
        assert!(
            worker.rpc_addr().starts_with("http://127.0.0.1:"),
            "Sandbox must be local"
        );
        let root = worker.root_account()?;
        let owner = root
            .create_subaccount("owner")
            .initial_balance(NearToken::from_near(10))
            .transact()
            .await?
            .into_result()?;
        let vault = root
            .create_subaccount("vault")
            .initial_balance(NearToken::from_near(5))
            .transact()
            .await?
            .into_result()?
            .deploy(wasm)
            .await?
            .into_result()?;
        let merchant = root
            .create_subaccount("merchant")
            .initial_balance(NearToken::from_near(1))
            .transact()
            .await?
            .into_result()?;
        let missing = format!("missing.{}", root.id()).parse()?;
        let key = SecretKey::from_random(KeyType::ED25519);
        owner
            .batch(owner.id())
            .add_key(
                key.public_key(),
                AccessKey::function_call_access(
                    vault.id(),
                    &["pay"],
                    Some(NearToken::from_millinear(100)),
                ),
            )
            .transact()
            .await?
            .into_result()?;
        let initialized = vault.call("new").args_json(json!({"owner":owner.id(),"policy":{
            "agent_key":key.public_key(),"recipients":[merchant.id(),&missing],
            "per_payment":(PRICE*10).to_string(),"per_day":(PRICE*20).to_string(),"lifetime_budget":(PRICE*50).to_string()
        }})).gas(Gas::from_tgas(40)).transact().await?;
        finalized(&worker, &initialized, vault.id()).await?;
        let agent = Account::from_secret_key(owner.id().clone(), key, &worker);
        Ok(Self {
            worker,
            owner,
            agent,
            vault,
            merchant,
            missing,
        })
    }
    pub fn pay(&self, nonce: u64, recipient: &AccountId, amount: u128) -> CallTransaction {
        self.agent.call(self.vault.id(), "pay").args_json(json!({"nonce":nonce.to_string(),"recipient":recipient,"amount":amount.to_string()})).gas(Gas::from_tgas(40))
    }
    pub async fn state(&self) -> Result<Value> {
        Ok(self.vault.view("status").await?.json()?)
    }
}
pub fn receipt(result: &ExecutionFinalResult) -> Value {
    json!({"transactionHash":result.outcome().transaction_hash.to_string(),"success":result.is_success(),
        "gasBurnt":result.total_gas_burnt.as_gas().to_string(),"logs":result.logs(),
        "receipts":result.receipt_outcomes().iter().map(|item|json!({
            "id":item.transaction_hash.to_string(),"executor":item.executor_id,"blockHash":item.block_hash.to_string(),
            "success":item.is_success(),"gasBurnt":item.gas_burnt.as_gas().to_string(),"logs":item.logs,
            "outcome":format!("{:?}",item.clone().into_result())
        })).collect::<Vec<_>>()})
}
pub fn has_event(result: &ExecutionFinalResult, name: &str) -> bool {
    result.logs().iter().any(|line| {
        line.strip_prefix("EVENT_JSON:")
            .and_then(|text| serde_json::from_str::<Value>(text).ok())
            .is_some_and(|event| event["event"] == name)
    })
}
pub fn save(name: &str, value: Value) -> Result {
    if let Some(path) = std::env::var_os("AGENTGUARD_RUNTIME_REPORT_DIR") {
        let directory = PathBuf::from(path);
        std::fs::create_dir_all(&directory)?;
        std::fs::write(
            directory.join(format!("{name}.json")),
            serde_json::to_vec_pretty(&json!({
                "case":name,"passed":true,"network":"local-sandbox","wasmSha256":value.get("faultWasmSha256").cloned().unwrap_or(json!(baseline_hash()?)),"evidence":value
            }))?,
        )?;
    }
    Ok(())
}

pub async fn finalized(
    worker: &Worker<Sandbox>,
    result: &ExecutionFinalResult,
    sender: &AccountId,
) -> Result<Value> {
    let response = tokio::time::timeout(
        Duration::from_secs(30),
        worker.tx_status(
            TransactionInfo::TransactionId {
                tx_hash: CryptoHash(result.outcome().transaction_hash.0),
                sender_account_id: sender.clone(),
            },
            TxExecutionStatus::Final,
        ),
    )
    .await??;
    assert_eq!(response.final_execution_status, TxExecutionStatus::Final);
    Ok(serde_json::to_value(response)?)
}

// Test-only Borsh locator for the current pinned AgentGuard state. Production
// code never patches state. Every offset is bounds-checked against view STATE.
pub fn day_offset(bytes: &[u8]) -> Result<usize> {
    fn length(bytes: &[u8], offset: &mut usize) -> Result<usize> {
        let end = *offset + 4;
        let value = u32::from_le_bytes(
            bytes
                .get(*offset..end)
                .ok_or("truncated state length")?
                .try_into()?,
        );
        *offset = end;
        Ok(value as usize)
    }
    let mut offset = 0;
    let owner_len = length(bytes, &mut offset)?;
    offset += owner_len;
    let key_len = length(bytes, &mut offset)?;
    assert_eq!(key_len, 33, "expected ed25519 serialized key");
    assert_eq!(bytes.get(offset), Some(&0), "expected ed25519 key");
    offset += key_len;
    let recipients = length(bytes, &mut offset)?;
    for _ in 0..recipients {
        let size = length(bytes, &mut offset)?;
        offset += size;
    }
    offset += 16 * 3 + 1 + 8; // Three caps, paused flag, next nonce.
    bytes.get(offset..offset + 8).ok_or("truncated day")?;
    Ok(offset)
}
