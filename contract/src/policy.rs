// Author: Tommy
use near_sdk::{json_types::U128, near, AccountId, PublicKey};

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Policy {
    pub agent_key: PublicKey,
    pub recipients: Vec<AccountId>,
    pub per_payment: U128,
    pub per_day: U128,
    pub lifetime_budget: U128,
}

impl Policy {
    pub fn validate(&self) {
        assert!(
            !self.recipients.is_empty() && self.recipients.len() <= 16,
            "INVALID_RECIPIENT_COUNT"
        );
        for (index, account) in self.recipients.iter().enumerate() {
            assert!(
                !self.recipients[..index].contains(account),
                "DUPLICATE_RECIPIENT"
            );
        }
        assert!(self.per_payment.0 > 0, "INVALID_PAYMENT_LIMIT");
        assert!(self.per_payment.0 <= self.per_day.0, "INVALID_DAILY_LIMIT");
        assert!(
            self.per_day.0 <= self.lifetime_budget.0,
            "INVALID_LIFETIME_BUDGET"
        );
    }
}
