// Author: Tommy
mod support;
use near_workspaces::types::{AccessKey, Gas, NearToken};
use serde_json::{Value, json};
use support::{Fixture, PRICE, Result, day_offset, finalized, has_event, receipt, save};

#[tokio::test]
async fn failed_transfer_refunds_and_next_payment_settles() -> Result {
    let f = Fixture::new().await?;
    let before = f.vault.view_account().await?.balance.as_yoctonear();
    let failed = f.pay(0, &f.missing, PRICE).transact().await?;
    assert!(
        failed.is_success(),
        "Callback should return false, not fail: {failed:?}"
    );
    assert!(!failed.clone().json::<bool>()?);
    assert!(
        failed
            .receipt_failures()
            .iter()
            .any(|item| item.executor_id == f.missing)
    );
    assert!(has_event(&failed, "payment_reserved") && has_event(&failed, "payment_failed"));
    assert!(!has_event(&failed, "payment_settled"));
    let final_receipts = finalized(&f.worker, &failed, f.owner.id()).await?;
    let restored = f.state().await?;
    assert_eq!(restored["total_spent"], "0");
    assert_eq!(restored["daily_spent"], "0");
    assert_eq!(restored["next_nonce"], "1");
    assert!(restored["pending"].is_null());
    let after = f.vault.view_account().await?.balance.as_yoctonear();
    // Owner pays gas; the contract may receive a small execution reward.
    assert!(
        after >= before && after - before < PRICE / 10,
        "principal was not fully restored: before={before}, after={after}, receipts={failed:?}"
    );
    let merchant_before = f.merchant.view_account().await?.balance.as_yoctonear();
    let success = f.pay(1, f.merchant.id(), PRICE).transact().await?;
    assert!(success.clone().json::<bool>()?);
    assert!(success.receipt_failures().is_empty());
    assert!(has_event(&success, "payment_settled"));
    assert_eq!(
        f.merchant.view_account().await?.balance.as_yoctonear() - merchant_before,
        PRICE
    );
    let final_state = f.state().await?;
    assert_eq!(final_state["total_spent"], PRICE.to_string());
    assert_eq!(final_state["next_nonce"], "2");
    save(
        "failed-transfer",
        json!({"runtime":f.worker.status().await?,"balanceBefore":before.to_string(),"balanceAfterRefund":after.to_string(),
        "failedTransfer":receipt(&failed),"finalRpcReceipt":final_receipts,"stateAfterFailure":restored,"nextPayment":receipt(&success),"stateAfterSuccess":final_state}),
    )
}

#[tokio::test]
async fn concurrent_payments_cannot_cross_pending_reservation() -> Result {
    let f = Fixture::new().await?;
    let before = f.merchant.view_account().await?.balance.as_yoctonear();
    // Send both before awaiting either transfer/callback chain.
    let first = f.pay(0, f.merchant.id(), PRICE).transact_async().await?;
    let second = f.pay(1, f.merchant.id(), PRICE).transact_async().await?;
    let (first, second) = tokio::join!(async { first.await }, async { second.await });
    let first = first?;
    let second = second?;
    assert!(first.clone().json::<bool>()?);
    assert!(
        second.is_failure(),
        "Second request must reach the in-flight reservation: {second:?}"
    );
    assert!(
        format!("{second:?}").contains("PAYMENT_IN_FLIGHT"),
        "A nonce-only rejection is not proof of pending enforcement"
    );
    let state = f.state().await?;
    assert_eq!(state["next_nonce"], "1");
    assert_eq!(state["total_spent"], PRICE.to_string());
    assert!(state["pending"].is_null());
    assert_eq!(
        f.merchant.view_account().await?.balance.as_yoctonear() - before,
        PRICE
    );
    save(
        "concurrent-payments",
        json!({"accepted":receipt(&first),"blocked":receipt(&second),"state":state}),
    )
}

#[tokio::test]
async fn restricted_key_allowance_and_revocation_stop_before_contract() -> Result {
    let f = Fixture::new().await?;
    let initial = f.state().await?;
    let method = f
        .agent
        .call(f.vault.id(), "set_paused")
        .args_json(json!({"paused":true}))
        .gas(Gas::from_tgas(40))
        .transact()
        .await
        .unwrap_err();
    assert!(format!("{method:?}").contains("MethodNameMismatch"));
    let receiver = f
        .agent
        .call(f.merchant.id(), "pay")
        .args_json(json!({}))
        .gas(Gas::from_tgas(40))
        .transact()
        .await
        .unwrap_err();
    assert!(format!("{receiver:?}").contains("ReceiverMismatch"));
    assert_eq!(f.state().await?, initial);
    // Replace only the disposable local key's permission, leaving one yocto of gas allowance.
    let public = f.agent.secret_key().public_key();
    f.owner
        .batch(f.owner.id())
        .delete_key(public.clone())
        .add_key(
            public.clone(),
            AccessKey::function_call_access(
                f.vault.id(),
                &["pay"],
                Some(NearToken::from_yoctonear(1)),
            ),
        )
        .transact()
        .await?
        .into_result()?;
    let allowance = f
        .pay(0, f.merchant.id(), PRICE)
        .transact()
        .await
        .unwrap_err();
    assert!(format!("{allowance:?}").contains("NotEnoughAllowance"));
    assert_eq!(f.state().await?, initial);
    f.owner
        .batch(f.owner.id())
        .delete_key(public)
        .transact()
        .await?
        .into_result()?;
    let revoked = f
        .pay(0, f.merchant.id(), PRICE)
        .transact()
        .await
        .unwrap_err();
    assert!(
        format!("{revoked:?}").contains("AccessKeyNotFound"),
        "revocation must be a missing-key rejection"
    );
    assert_eq!(f.state().await?, initial);
    save(
        "key-boundaries",
        json!({"wrongMethod":format!("{method:?}"),"wrongReceiver":format!("{receiver:?}"),
        "allowance":format!("{allowance:?}"),"revoked":format!("{revoked:?}"),"state":initial}),
    )
}

#[tokio::test]
async fn previous_utc_day_resets_daily_budget_and_preserves_lifetime() -> Result {
    let f = Fixture::new().await?;
    f.pay(0, f.merchant.id(), PRICE * 10)
        .transact()
        .await?
        .into_result()?;
    f.pay(1, f.merchant.id(), PRICE * 10)
        .transact()
        .await?
        .into_result()?;
    let before = f.state().await?;
    let denied = f.pay(2, f.merchant.id(), PRICE).transact().await?;
    assert!(denied.is_failure() && format!("{denied:?}").contains("DAILY_LIMIT"));
    // Inject the previous day's persisted bucket. The compiled WASM reads the
    // real sandbox timestamp; this is NOT evidence of advancing wall-clock time.
    let states = f.vault.view_state().await?;
    let original = states.get(b"STATE".as_slice()).ok_or("STATE missing")?;
    let mut patched = original.clone();
    let offset = day_offset(&patched)?;
    let previous_day = before["day"].as_str().unwrap().parse::<u64>()? - 1;
    patched[offset..offset + 8].copy_from_slice(&previous_day.to_le_bytes());
    f.worker
        .patch_state(f.vault.id(), b"STATE", &patched)
        .await?;
    let rolled = f.state().await?;
    assert_eq!(rolled["day"], before["day"]);
    assert_eq!(rolled["daily_spent"], "0");
    assert_eq!(rolled["total_spent"], before["total_spent"]);
    let accepted = f.pay(2, f.merchant.id(), PRICE).transact().await?;
    assert!(accepted.clone().json::<bool>()?);
    let after: Value = f.state().await?;
    assert_eq!(after["daily_spent"], PRICE.to_string());
    assert_eq!(after["total_spent"], (PRICE * 21).to_string());
    save(
        "previous-day-bucket",
        json!({"faultInjection":"Only stored UTC day patched to the previous day; no clock travel", "patchedPreviousDay":previous_day,"before":before,"dailyRejection":receipt(&denied),"afterPreviousDayPatch":rolled,"accepted":receipt(&accepted),"after":after}),
    )
}

#[tokio::test]
async fn callback_gas_failure_keeps_spent_budget_and_blocks_future_payments() -> Result {
    // Fault injection: only callback gas is reduced in a separate temporary
    // artifact. This does not assert the unchanged production artifact fails.
    let f = Fixture::callback_fault().await?;
    let before = f.merchant.view_account().await?.balance.as_yoctonear();
    let failure = f.pay(0, f.merchant.id(), PRICE).transact().await?;
    let final_receipts = finalized(&f.worker, &failure, f.owner.id()).await?;
    assert!(failure.is_failure());
    assert!(
        format!("{failure:?}").contains("Exceeded the prepaid gas."),
        "expected forced callback gas failure: {failure:?}"
    );
    assert!(has_event(&failure, "payment_reserved"));
    assert!(!has_event(&failure, "payment_settled"));
    assert_eq!(
        f.merchant.view_account().await?.balance.as_yoctonear() - before,
        PRICE,
        "supplier was paid even though callback failed"
    );
    let stuck = f.state().await?;
    assert!(!stuck["pending"].is_null());
    assert_eq!(stuck["next_nonce"], "1");
    assert_eq!(stuck["total_spent"], PRICE.to_string());
    assert_eq!(stuck["daily_spent"], PRICE.to_string());
    let second = f.pay(1, f.merchant.id(), PRICE).transact().await?;
    assert!(second.is_failure() && format!("{second:?}").contains("PAYMENT_IN_FLIGHT"));
    let forged = f
        .owner
        .call(f.vault.id(), "settle")
        .args_json(json!({"nonce":"0"}))
        .gas(Gas::from_tgas(40))
        .transact()
        .await?;
    assert!(forged.is_failure() && format!("{forged:?}").contains("private"));
    assert_eq!(f.state().await?, stuck);
    save(
        "callback-gas-fault",
        json!({"faultInjection":"test-only callback static gas 0.1 Tgas, unused-gas weight 0", "faultWasmSha256":std::env::var("AGENTGUARD_CALLBACK_SHA256")?,
        "payment":receipt(&failure),"finalRpcReceipt":final_receipts,"blockedNext":receipt(&second),"forgedCallback":receipt(&forged),"stuckState":stuck}),
    )
}
