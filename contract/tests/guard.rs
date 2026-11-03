// Author: Tommy
use agent_guard::{AgentGuard, Policy};
use near_sdk::{
    json_types::{U128, U64},
    test_utils::VMContextBuilder,
    testing_env, AccountId, Gas, NearToken, PromiseError, PublicKey,
};

const NEAR: u128 = 1_000_000_000_000_000_000_000_000;
const DAY: u64 = 86_400_000_000_000;

fn account(name: &str) -> AccountId {
    name.parse().expect("valid fixture account")
}
fn key(byte: u8) -> PublicKey {
    let mut bytes = vec![0];
    bytes.extend([byte; 32]);
    PublicKey::try_from(bytes).expect("valid fixture key")
}
fn context(caller: &str, key_byte: u8, timestamp: u64) {
    let mut context = VMContextBuilder::new();
    context
        .current_account_id(account("vault.testnet"))
        .predecessor_account_id(account(caller))
        .signer_account_id(account(caller))
        .signer_account_pk(key(key_byte))
        .block_timestamp(timestamp)
        .account_balance(NearToken::from_near(20))
        .prepaid_gas(Gas::from_tgas(100));
    testing_env!(context.build());
}
fn guard() -> AgentGuard {
    context("vault.testnet", 1, 0);
    let guard = AgentGuard::new(
        account("owner.testnet"),
        Policy {
            agent_key: key(2),
            recipients: vec![account("merchant.testnet")],
            per_payment: U128(NEAR),
            per_day: U128(2 * NEAR),
            lifetime_budget: U128(3 * NEAR),
        },
    );
    context("owner.testnet", 1, 0);
    guard
}
fn pay(guard: &mut AgentGuard, nonce: u64, amount: u128) {
    drop(guard.pay(U64(nonce), account("merchant.testnet"), U128(amount)));
}
fn settle(guard: &mut AgentGuard, nonce: u64, success: bool) {
    context("vault.testnet", 1, 0);
    assert_eq!(
        guard.settle(
            U64(nonce),
            if success {
                Ok(())
            } else {
                Err(PromiseError::Failed)
            }
        ),
        success
    );
}

#[test]
fn payment_reserves_then_settles() {
    let mut guard = guard();
    context("owner.testnet", 2, 0);
    pay(&mut guard, 0, NEAR);
    assert_eq!(guard.status()["total_spent"], NEAR.to_string());
    assert_eq!(guard.status()["next_nonce"], "1");
    settle(&mut guard, 0, true);
    assert!(guard.status()["pending"].is_null());
    assert_eq!(guard.status()["total_spent"], NEAR.to_string());
}
#[test]
fn failed_transfer_restores_budget_but_consumes_nonce() {
    let mut guard = guard();
    context("owner.testnet", 2, 0);
    pay(&mut guard, 0, NEAR);
    settle(&mut guard, 0, false);
    assert_eq!(guard.status()["total_spent"], "0");
    assert_eq!(guard.status()["daily_spent"], "0");
    assert_eq!(guard.status()["next_nonce"], "1");
}
#[test]
#[should_panic(expected = "RECIPIENT_NOT_ALLOWED")]
fn injected_recipient_is_blocked() {
    let mut guard = guard();
    context("owner.testnet", 2, 0);
    drop(guard.pay(U64(0), account("attacker.testnet"), U128(NEAR)));
}
#[test]
#[should_panic(expected = "PAYMENT_LIMIT")]
fn oversized_payment_is_blocked() {
    let mut guard = guard();
    context("owner.testnet", 2, 0);
    pay(&mut guard, 0, NEAR + 1);
}
#[test]
#[should_panic(expected = "PAYMENT_LIMIT")]
fn zero_payment_is_blocked() {
    let mut guard = guard();
    context("owner.testnet", 2, 0);
    pay(&mut guard, 0, 0);
}
#[test]
#[should_panic(expected = "INVALID_NONCE")]
fn settled_payment_cannot_be_replayed() {
    let mut guard = guard();
    context("owner.testnet", 2, 0);
    pay(&mut guard, 0, NEAR);
    settle(&mut guard, 0, true);
    context("owner.testnet", 2, 0);
    pay(&mut guard, 0, NEAR);
}
#[test]
#[should_panic(expected = "PAYMENT_IN_FLIGHT")]
fn concurrent_payment_cannot_overspend() {
    let mut guard = guard();
    context("owner.testnet", 2, 0);
    pay(&mut guard, 0, NEAR);
    pay(&mut guard, 1, NEAR);
}
#[test]
#[should_panic(expected = "DAILY_LIMIT")]
fn splitting_payments_cannot_bypass_daily_limit() {
    let mut guard = guard();
    for nonce in 0..2 {
        context("owner.testnet", 2, 0);
        pay(&mut guard, nonce, NEAR);
        settle(&mut guard, nonce, true);
    }
    context("owner.testnet", 2, 0);
    pay(&mut guard, 2, 1);
}
#[test]
fn daily_budget_resets_without_resetting_lifetime_budget() {
    let mut guard = guard();
    context("owner.testnet", 2, 0);
    pay(&mut guard, 0, NEAR);
    settle(&mut guard, 0, true);
    context("owner.testnet", 2, DAY);
    assert_eq!(guard.status()["daily_spent"], "0");
    pay(&mut guard, 1, NEAR);
    assert_eq!(guard.status()["daily_spent"], NEAR.to_string());
    assert_eq!(guard.status()["total_spent"], (2 * NEAR).to_string());
}
#[test]
#[should_panic(expected = "LIFETIME_LIMIT")]
fn lifetime_cap_survives_day_boundaries() {
    let mut guard = guard();
    for nonce in 0..3 {
        context("owner.testnet", 2, nonce * DAY);
        pay(&mut guard, nonce, NEAR);
        settle(&mut guard, nonce, true);
    }
    context("owner.testnet", 2, 4 * DAY);
    pay(&mut guard, 3, 1);
}
#[test]
#[should_panic(expected = "UNAUTHORIZED_AGENT_KEY")]
fn owner_key_cannot_impersonate_agent() {
    let mut guard = guard();
    context("owner.testnet", 1, 0);
    pay(&mut guard, 0, NEAR);
}
#[test]
#[should_panic(expected = "UNAUTHORIZED_AGENT")]
fn other_account_cannot_impersonate_agent() {
    let mut guard = guard();
    context("attacker.testnet", 2, 0);
    pay(&mut guard, 0, NEAR);
}

#[test]
#[should_panic(expected = "AGENT_CANNOT_ADMINISTER")]
fn agent_cannot_pause_or_unpause_vault() {
    let mut guard = guard();
    context("owner.testnet", 2, 0);
    guard.set_paused(true);
}
#[test]
#[should_panic(expected = "PAUSED")]
fn owner_emergency_pause_stops_agent() {
    let mut guard = guard();
    guard.set_paused(true);
    context("owner.testnet", 2, 0);
    pay(&mut guard, 0, NEAR);
}
#[test]
#[should_panic(expected = "AGENT_CANNOT_ADMINISTER")]
fn agent_cannot_withdraw() {
    let mut guard = guard();
    context("owner.testnet", 2, 0);
    drop(guard.withdraw(U128(NEAR)));
}
#[test]
#[should_panic(expected = "INSUFFICIENT_VAULT_BALANCE")]
fn storage_and_operating_reserve_cannot_be_withdrawn() {
    let mut guard = guard();
    drop(guard.withdraw(U128(20 * NEAR)));
}
#[test]
#[should_panic(expected = "CALLBACK_NONCE_MISMATCH")]
fn callback_cannot_settle_another_payment() {
    let mut guard = guard();
    context("owner.testnet", 2, 0);
    pay(&mut guard, 0, NEAR);
    settle(&mut guard, 1, true);
}
#[test]
fn failed_payment_across_midnight_does_not_underflow() {
    let mut guard = guard();
    context("owner.testnet", 2, DAY - 1);
    pay(&mut guard, 0, NEAR);
    context("vault.testnet", 1, DAY + 1);
    assert!(!guard.settle(U64(0), Err(PromiseError::Failed)));
    assert_eq!(guard.status()["daily_spent"], "0");
    assert_eq!(guard.status()["total_spent"], "0");
    context("owner.testnet", 2, DAY + 2);
    pay(&mut guard, 1, NEAR);
    assert_eq!(guard.status()["daily_spent"], NEAR.to_string());
}

#[test]
#[should_panic(expected = "VAULT_MUST_INITIALIZE")]
fn external_account_cannot_claim_uninitialized_vault() {
    context("attacker.testnet", 1, 0);
    AgentGuard::new(
        account("attacker.testnet"),
        Policy {
            agent_key: key(2),
            recipients: vec![account("merchant.testnet")],
            per_payment: U128(NEAR),
            per_day: U128(2 * NEAR),
            lifetime_budget: U128(3 * NEAR),
        },
    );
}

#[test]
#[should_panic(expected = "OWNER_MUST_BE_SEPARATE")]
fn vault_cannot_be_its_own_owner() {
    context("vault.testnet", 1, 0);
    AgentGuard::new(
        account("vault.testnet"),
        Policy {
            agent_key: key(2),
            recipients: vec![account("merchant.testnet")],
            per_payment: U128(NEAR),
            per_day: U128(2 * NEAR),
            lifetime_budget: U128(3 * NEAR),
        },
    );
}
