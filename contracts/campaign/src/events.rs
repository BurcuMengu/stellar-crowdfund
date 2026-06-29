use soroban_sdk::{contractevent, Address, Env};

/// A contribution was received. The frontend streams these via the RPC
/// `getEvents` endpoint to drive real-time UI updates.
#[contractevent(topics = ["contrib"])]
#[derive(Clone)]
pub struct Contribute {
    #[topic]
    pub from: Address,
    pub amount: i128,
    pub total_raised: i128,
}

/// A milestone was approved by the creator.
#[contractevent(topics = ["approve"])]
#[derive(Clone)]
pub struct MilestoneApproved {
    #[topic]
    pub idx: u32,
}

/// Milestone funds were released to the creator.
#[contractevent(topics = ["release"])]
#[derive(Clone)]
pub struct MilestoneReleased {
    #[topic]
    pub idx: u32,
    pub amount: i128,
}

/// A contributor was refunded after a failed campaign.
#[contractevent(topics = ["refund"])]
#[derive(Clone)]
pub struct Refund {
    #[topic]
    pub to: Address,
    pub amount: i128,
}

/// Thin facade so the contract body reads declaratively.
pub struct Events;

impl Events {
    pub fn contribute(env: &Env, from: &Address, amount: i128, total_raised: i128) {
        Contribute {
            from: from.clone(),
            amount,
            total_raised,
        }
        .publish(env);
    }

    pub fn milestone_approved(env: &Env, idx: u32) {
        MilestoneApproved { idx }.publish(env);
    }

    pub fn milestone_released(env: &Env, idx: u32, amount: i128) {
        MilestoneReleased { idx, amount }.publish(env);
    }

    pub fn refund(env: &Env, to: &Address, amount: i128) {
        Refund {
            to: to.clone(),
            amount,
        }
        .publish(env);
    }
}
