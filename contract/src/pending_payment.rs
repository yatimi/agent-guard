// Author: Tommy
use near_sdk::{
    json_types::{U128, U64},
    near, AccountId,
};

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct PendingPayment {
    pub nonce: U64,
    pub recipient: AccountId,
    pub amount: U128,
}
