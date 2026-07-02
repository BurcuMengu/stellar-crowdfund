#![no_std]
//! # Campaign contract
//!
//! A single crowdfunding campaign with milestone-based, all-or-nothing escrow.
//!
//! - Contributors send a SEP-41 token (e.g. USDC via its SAC) into the contract.
//! - If the goal is met by the deadline, the creator releases funds milestone by
//!   milestone (each must be approved, then released, in order).
//! - If the goal is *not* met by the deadline, every contributor can refund
//!   their exact contribution.
//!
//! The campaign holds the escrowed funds itself, so a bug or dispute in one
//! campaign can never touch another's money — campaigns are deployed as
//! independent instances by the `factory` contract.

#![allow(clippy::too_many_arguments)]

mod events;
mod types;

#[cfg(test)]
mod test;

use crate::events::Events;
use crate::types::{CampaignInfo, DataKey, Error, Milestone, Status};
use soroban_sdk::{contract, contractimpl, token, Address, Env, Vec};

/// Bump persistent/instance TTL by ~30 days worth of ledgers on each touch.
const LEDGERS_PER_DAY: u32 = 17_280; // ~5s ledgers
const TTL_THRESHOLD: u32 = LEDGERS_PER_DAY * 30;
const TTL_BUMP: u32 = LEDGERS_PER_DAY * 60;

#[contract]
pub struct Campaign;

#[contractimpl]
impl Campaign {
    /// Initialize the campaign. Called once, automatically, at deploy time.
    ///
    /// `milestones` amounts must be positive and sum to exactly `goal`.
    /// `deadline` is a unix timestamp (seconds) strictly in the future.
    pub fn __constructor(
        env: Env,
        creator: Address,
        token: Address,
        goal: i128,
        deadline: u64,
        milestones: Vec<Milestone>,
    ) {
        if env.storage().instance().has(&DataKey::Creator) {
            panic_with(&env, Error::AlreadyInitialized);
        }
        if goal <= 0 || milestones.is_empty() {
            panic_with(&env, Error::InvalidMilestones);
        }
        if deadline <= env.ledger().timestamp() {
            panic_with(&env, Error::InvalidDeadline);
        }

        // Milestone amounts must be positive and sum to the goal.
        let mut sum: i128 = 0;
        for m in milestones.iter() {
            if m.amount <= 0 || m.approved || m.released {
                panic_with(&env, Error::InvalidMilestones);
            }
            sum += m.amount;
        }
        if sum != goal {
            panic_with(&env, Error::InvalidMilestones);
        }

        let s = env.storage().instance();
        s.set(&DataKey::Creator, &creator);
        s.set(&DataKey::Token, &token);
        s.set(&DataKey::Goal, &goal);
        s.set(&DataKey::Deadline, &deadline);
        s.set(&DataKey::TotalRaised, &0i128);
        s.set(&DataKey::Milestones, &milestones);
        s.extend_ttl(TTL_THRESHOLD, TTL_BUMP);
    }

    /// Contribute `amount` of the campaign token. Requires `from`'s auth, pulls
    /// the tokens into escrow, and records the contribution. Only while Active.
    pub fn contribute(env: Env, from: Address, amount: i128) -> Result<(), Error> {
        from.require_auth();
        if amount <= 0 {
            return Err(Error::ZeroAmount);
        }
        if Self::get_status(env.clone()) != Status::Active {
            return Err(Error::DeadlinePassed);
        }

        // Milestones sum to exactly `goal` and only milestone amounts are ever
        // released, so any surplus above `goal` would be trapped forever. Reject
        // contributions that would push total past the goal — the final funder
        // must send at most the remaining gap (`goal - total_raised`).
        let total = Self::total_raised(&env) + amount;
        if total > Self::goal(&env) {
            return Err(Error::ExceedsGoal);
        }

        let token = Self::token(&env);
        let this = env.current_contract_address();
        token::TokenClient::new(&env, &token).transfer(&from, &this, &amount);

        env.storage().instance().set(&DataKey::TotalRaised, &total);

        let key = DataKey::Contribution(from.clone());
        let prev: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(prev + amount));
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_BUMP);
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_BUMP);

        Events::contribute(&env, &from, amount, total);
        Ok(())
    }

    /// Creator approves milestone `idx` for release. Must be approved in order,
    /// and only once the campaign is Successful.
    pub fn approve_milestone(env: Env, idx: u32) -> Result<(), Error> {
        let creator = Self::creator(&env);
        creator.require_auth();

        if Self::get_status(env.clone()) == Status::Active {
            return Err(Error::DeadlineNotPassed);
        }
        let mut milestones = Self::milestones(&env);
        let mut m = milestones.get(idx).ok_or(Error::MilestoneNotFound)?;

        if !Self::goal_met(&env) {
            return Err(Error::GoalNotMet);
        }
        if m.approved {
            return Err(Error::AlreadyApproved);
        }
        // Sequential: every earlier milestone must already be approved.
        for i in 0..idx {
            if !milestones.get(i).unwrap().approved {
                return Err(Error::OutOfOrder);
            }
        }

        m.approved = true;
        milestones.set(idx, m);
        env.storage()
            .instance()
            .set(&DataKey::Milestones, &milestones);
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_BUMP);
        Events::milestone_approved(&env, idx);
        Ok(())
    }

    /// Release approved milestone `idx`'s funds to the creator. Must be released
    /// in order. Marks the campaign Finalized once the last one is released.
    pub fn release_milestone(env: Env, idx: u32) -> Result<(), Error> {
        let creator = Self::creator(&env);
        creator.require_auth();

        if !Self::goal_met(&env) {
            return Err(Error::GoalNotMet);
        }
        let mut milestones = Self::milestones(&env);
        let mut m = milestones.get(idx).ok_or(Error::MilestoneNotFound)?;

        if !m.approved {
            return Err(Error::MilestoneNotApproved);
        }
        if m.released {
            return Err(Error::MilestoneAlreadyReleased);
        }
        for i in 0..idx {
            if !milestones.get(i).unwrap().released {
                return Err(Error::OutOfOrder);
            }
        }

        let token = Self::token(&env);
        let this = env.current_contract_address();
        token::TokenClient::new(&env, &token).transfer(&this, &creator, &m.amount);

        m.released = true;
        let amount = m.amount;
        milestones.set(idx, m);
        env.storage()
            .instance()
            .set(&DataKey::Milestones, &milestones);
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_BUMP);
        Events::milestone_released(&env, idx, amount);
        Ok(())
    }

    /// Refund the caller's full contribution. Only when the campaign Failed.
    pub fn refund(env: Env, to: Address) -> Result<(), Error> {
        to.require_auth();
        if Self::get_status(env.clone()) != Status::Failed {
            return Err(Error::NotFailed);
        }

        let key = DataKey::Contribution(to.clone());
        let amount: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if amount <= 0 {
            return Err(Error::NothingToRefund);
        }

        // Zero out *before* the transfer so a re-entrant call finds nothing.
        env.storage().persistent().set(&key, &0i128);
        let total = Self::total_raised(&env) - amount;
        env.storage().instance().set(&DataKey::TotalRaised, &total);

        let token = Self::token(&env);
        let this = env.current_contract_address();
        token::TokenClient::new(&env, &token).transfer(&this, &to, &amount);

        Events::refund(&env, &to, amount);
        Ok(())
    }

    // ---- read-only views -------------------------------------------------

    /// Current lifecycle status, derived live from goal/deadline/milestones.
    pub fn get_status(env: Env) -> Status {
        let now = env.ledger().timestamp();
        let deadline = Self::deadline(&env);
        if now < deadline {
            return Status::Active;
        }
        if !Self::goal_met(&env) {
            return Status::Failed;
        }
        // Goal met after deadline: Successful until every milestone released.
        let milestones = Self::milestones(&env);
        if milestones.iter().all(|m| m.released) {
            Status::Finalized
        } else {
            Status::Successful
        }
    }

    /// Full snapshot for the frontend.
    pub fn get_info(env: Env) -> CampaignInfo {
        CampaignInfo {
            creator: Self::creator(&env),
            token: Self::token(&env),
            goal: Self::goal(&env),
            deadline: Self::deadline(&env),
            total_raised: Self::total_raised(&env),
            status: Self::get_status(env.clone()),
            milestones: Self::milestones(&env),
        }
    }

    pub fn get_milestones(env: Env) -> Vec<Milestone> {
        Self::milestones(&env)
    }

    pub fn get_contribution(env: Env, who: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Contribution(who))
            .unwrap_or(0)
    }

    // ---- internal helpers ------------------------------------------------

    fn goal_met(env: &Env) -> bool {
        Self::total_raised(env) >= Self::goal(env)
    }

    fn creator(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Creator).unwrap()
    }
    fn token(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Token).unwrap()
    }
    fn goal(env: &Env) -> i128 {
        env.storage().instance().get(&DataKey::Goal).unwrap()
    }
    fn deadline(env: &Env) -> u64 {
        env.storage().instance().get(&DataKey::Deadline).unwrap()
    }
    fn total_raised(env: &Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalRaised)
            .unwrap_or(0)
    }
    fn milestones(env: &Env) -> Vec<Milestone> {
        env.storage().instance().get(&DataKey::Milestones).unwrap()
    }
}

/// Panic with a typed contract error (so clients see a clean error code).
fn panic_with(env: &Env, err: Error) -> ! {
    soroban_sdk::panic_with_error!(env, err)
}
