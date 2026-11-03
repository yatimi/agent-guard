// Author: Tommy
mod pending_payment;
mod policy;

use near_sdk::{
    env,
    json_types::{U128, U64},
    near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseError,
};
pub use pending_payment::PendingPayment;
pub use policy::Policy;

const DAY_NS: u64 = 86_400_000_000_000;
const RESERVE: u128 = 50_000_000_000_000_000_000_000; // 0.05 NEAR, in addition to storage.

/// One owner, one pinned agent key, immutable policy, one in-flight payment.
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct AgentGuard {
    owner: AccountId,
    policy: Policy,
    paused: bool,
    next_nonce: u64,
    day: u64,
    daily_spent: u128,
    total_spent: u128,
    pending: Option<PendingPayment>,
}

#[near]
impl AgentGuard {
    #[init]
    pub fn new(owner: AccountId, policy: Policy) -> Self {
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            "VAULT_MUST_INITIALIZE"
        );
        require!(owner != env::current_account_id(), "OWNER_MUST_BE_SEPARATE");
        policy.validate();
        require!(
            env::signer_account_pk() != policy.agent_key,
            "SEPARATE_OWNER_KEY_REQUIRED"
        );
        Self {
            owner,
            policy,
            paused: false,
            next_nonce: 0,
            day: env::block_timestamp() / DAY_NS,
            daily_spent: 0,
            total_spent: 0,
            pending: None,
        }
    }

    /// Agent calls attach zero NEAR; payments spend the pre-funded vault.
    pub fn pay(&mut self, nonce: U64, recipient: AccountId, amount: U128) -> Promise {
        require!(
            env::predecessor_account_id() == self.owner && env::signer_account_id() == self.owner,
            "UNAUTHORIZED_AGENT"
        );
        require!(
            env::signer_account_pk() == self.policy.agent_key,
            "UNAUTHORIZED_AGENT_KEY"
        );
        require!(!self.paused, "PAUSED");
        require!(self.pending.is_none(), "PAYMENT_IN_FLIGHT");
        require!(nonce.0 == self.next_nonce, "INVALID_NONCE");
        require!(
            self.policy.recipients.contains(&recipient),
            "RECIPIENT_NOT_ALLOWED"
        );
        require!(
            amount.0 > 0 && amount.0 <= self.policy.per_payment.0,
            "PAYMENT_LIMIT"
        );
        require!(env::prepaid_gas() >= Gas::from_tgas(30), "INSUFFICIENT_GAS");
        let day = env::block_timestamp() / DAY_NS;
        let spent = if day == self.day { self.daily_spent } else { 0 };
        let daily = spent.checked_add(amount.0).expect("AMOUNT_OVERFLOW");
        let total = self
            .total_spent
            .checked_add(amount.0)
            .expect("AMOUNT_OVERFLOW");
        require!(daily <= self.policy.per_day.0, "DAILY_LIMIT");
        require!(total <= self.policy.lifetime_budget.0, "LIFETIME_LIMIT");
        self.assert_liquid_balance(amount.0);
        let next_nonce = self.next_nonce.checked_add(1).expect("NONCE_EXHAUSTED");
        self.day = day;
        self.daily_spent = daily;
        self.total_spent = total;
        self.next_nonce = next_nonce;
        self.pending = Some(PendingPayment {
            nonce,
            recipient: recipient.clone(),
            amount,
        });
        Self::emit(
            "payment_reserved",
            near_sdk::serde_json::json!({
                "nonce": nonce, "recipient": recipient, "amount": amount
            }),
        );
        Promise::new(recipient)
            .transfer(NearToken::from_yoctonear(amount.0))
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(10))
                    .settle(nonce),
            )
    }

    #[private]
    pub fn settle(
        &mut self,
        nonce: U64,
        #[callback_result] result: Result<(), PromiseError>,
    ) -> bool {
        let payment = self.pending.as_ref().expect("NO_PENDING_PAYMENT");
        require!(payment.nonce == nonce, "CALLBACK_NONCE_MISMATCH");
        let success = result.is_ok();
        if !success {
            // Reserved before dispatch. A failed transfer refunds NEAR to this vault.
            self.daily_spent -= payment.amount.0;
            self.total_spent -= payment.amount.0;
        }
        Self::emit(
            if success {
                "payment_settled"
            } else {
                "payment_failed"
            },
            near_sdk::serde_json::json!({"nonce": nonce, "amount": payment.amount}),
        );
        self.pending = None;
        success
    }

    pub fn set_paused(&mut self, paused: bool) {
        self.assert_owner();
        self.paused = paused;
        Self::emit(
            "pause_changed",
            near_sdk::serde_json::json!({"paused": paused}),
        );
    }

    /// Owner recovery is outside agent budgets. No withdrawal during settlement.
    pub fn withdraw(&mut self, amount: U128) -> Promise {
        self.assert_owner();
        require!(self.pending.is_none(), "PAYMENT_IN_FLIGHT");
        require!(amount.0 > 0, "ZERO_AMOUNT");
        self.assert_liquid_balance(amount.0);
        Self::emit(
            "owner_withdrawal_requested",
            near_sdk::serde_json::json!({"amount": amount}),
        );
        Promise::new(self.owner.clone()).transfer(NearToken::from_yoctonear(amount.0))
    }

    #[payable]
    pub fn fund(&mut self) {
        require!(env::attached_deposit().as_yoctonear() > 0, "ZERO_DEPOSIT");
    }

    pub fn status(&self) -> near_sdk::serde_json::Value {
        let day = env::block_timestamp() / DAY_NS;
        near_sdk::serde_json::json!({
            "owner": self.owner, "policy": self.policy, "paused": self.paused,
            "next_nonce": U64(self.next_nonce), "day": U64(day),
            "daily_spent": U128(if day == self.day { self.daily_spent } else { 0 }),
            "total_spent": U128(self.total_spent), "pending": self.pending
        })
    }
}

impl AgentGuard {
    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner, "OWNER_ONLY");
        require!(
            env::signer_account_pk() != self.policy.agent_key,
            "AGENT_CANNOT_ADMINISTER"
        );
    }

    fn assert_liquid_balance(&self, amount: u128) {
        let storage = u128::from(env::storage_usage()) * env::storage_byte_cost().as_yoctonear();
        let available = env::account_balance()
            .as_yoctonear()
            .saturating_sub(storage)
            .saturating_sub(RESERVE);
        require!(amount <= available, "INSUFFICIENT_VAULT_BALANCE");
    }

    fn emit(event: &str, data: near_sdk::serde_json::Value) {
        env::log_str(&format!(
            "EVENT_JSON:{}",
            near_sdk::serde_json::json!({
                "standard": "agent_guard", "version": "1.0.0", "event": event, "data": [data]
            })
        ));
    }
}
