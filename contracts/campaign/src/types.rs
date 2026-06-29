use soroban_sdk::{contracterror, contracttype, Address, Vec};

/// One funding milestone. Milestone amounts must sum to the campaign goal.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Milestone {
    /// Amount (in token stroops) released to the creator when this milestone
    /// is approved and released.
    pub amount: i128,
    /// Creator has approved this milestone for release.
    pub approved: bool,
    /// Funds for this milestone have been transferred to the creator.
    pub released: bool,
}

/// Lifecycle of a campaign. Derived from goal vs. deadline vs. milestones —
/// never persisted, so it can't drift out of sync with reality.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Status {
    /// Before the deadline; still accepting contributions.
    Active,
    /// Deadline passed and goal met; funds can be released by milestone.
    Successful,
    /// Deadline passed and goal not met; contributors can refund.
    Failed,
    /// Goal met and every milestone released; nothing left to do.
    Finalized,
}

/// A read-only snapshot of campaign configuration + progress, for the frontend.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CampaignInfo {
    pub creator: Address,
    pub token: Address,
    pub goal: i128,
    pub deadline: u64,
    pub total_raised: i128,
    pub status: Status,
    pub milestones: Vec<Milestone>,
}

/// Storage keys. Config lives in instance storage; per-contributor balances in
/// persistent storage keyed by address (scales past instance-entry limits).
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Creator,
    Token,
    Goal,
    Deadline,
    TotalRaised,
    Milestones,
    Contribution(Address),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    InvalidMilestones = 2,
    InvalidDeadline = 3,
    DeadlinePassed = 4,
    ZeroAmount = 5,
    GoalNotMet = 6,
    DeadlineNotPassed = 7,
    NotFailed = 8,
    NothingToRefund = 9,
    Unauthorized = 10,
    MilestoneNotApproved = 11,
    MilestoneAlreadyReleased = 12,
    OutOfOrder = 13,
    MilestoneNotFound = 14,
    AlreadyApproved = 15,
}
