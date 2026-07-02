#![cfg(test)]
extern crate std;

use crate::types::{Error, Milestone, Status};
use crate::{Campaign, CampaignClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env, Vec,
};

const DAY: u64 = 86_400;

struct Setup<'a> {
    env: Env,
    creator: Address,
    token: token::TokenClient<'a>,
    token_admin: token::StellarAssetClient<'a>,
    client: CampaignClient<'a>,
}

/// Build a campaign with the given goal split across `milestones` amounts and a
/// deadline `DAY` seconds in the future. Mints `mint` tokens to every funder.
fn setup<'a>(goal: i128, milestone_amounts: &[i128]) -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.timestamp = 1_000);

    let creator = Address::generate(&env);

    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let token = token::TokenClient::new(&env, &sac.address());
    let token_admin = token::StellarAssetClient::new(&env, &sac.address());

    let mut milestones: Vec<Milestone> = Vec::new(&env);
    for amount in milestone_amounts {
        milestones.push_back(Milestone {
            amount: *amount,
            approved: false,
            released: false,
        });
    }

    let deadline = env.ledger().timestamp() + DAY;
    let id = env.register(
        Campaign,
        (creator.clone(), sac.address(), goal, deadline, milestones),
    );
    let client = CampaignClient::new(&env, &id);

    Setup {
        env,
        creator,
        token,
        token_admin,
        client,
    }
}

fn funder(s: &Setup, amount: i128) -> Address {
    let a = Address::generate(&s.env);
    s.token_admin.mint(&a, &amount);
    a
}

fn expire(s: &Setup) {
    s.env.ledger().with_mut(|l| l.timestamp += DAY + 1);
}

#[test]
fn full_success_and_milestone_release() {
    let s = setup(1_000, &[600, 400]);
    let alice = funder(&s, 700);
    let bob = funder(&s, 300);

    s.client.contribute(&alice, &700);
    s.client.contribute(&bob, &300);

    assert_eq!(s.client.get_status(), Status::Active);
    assert_eq!(s.client.get_info().total_raised, 1_000);
    // Escrow holds the funds.
    assert_eq!(s.token.balance(&s.client.address), 1_000);

    expire(&s);
    assert_eq!(s.client.get_status(), Status::Successful);

    // Release milestone 0, then 1.
    s.client.approve_milestone(&0);
    s.client.release_milestone(&0);
    assert_eq!(s.token.balance(&s.creator), 600);
    assert_eq!(s.client.get_status(), Status::Successful);

    s.client.approve_milestone(&1);
    s.client.release_milestone(&1);
    assert_eq!(s.token.balance(&s.creator), 1_000);
    assert_eq!(s.token.balance(&s.client.address), 0);
    assert_eq!(s.client.get_status(), Status::Finalized);
}

#[test]
fn refund_on_failure() {
    let s = setup(1_000, &[1_000]);
    let alice = funder(&s, 400);
    s.client.contribute(&alice, &400);

    expire(&s);
    assert_eq!(s.client.get_status(), Status::Failed);
    assert_eq!(s.client.get_contribution(&alice), 400);

    s.client.refund(&alice);
    assert_eq!(s.token.balance(&alice), 400);
    assert_eq!(s.client.get_contribution(&alice), 0);
    assert_eq!(s.client.get_info().total_raised, 0);
}

#[test]
fn contribute_after_deadline_fails() {
    let s = setup(1_000, &[1_000]);
    expire(&s);
    let alice = funder(&s, 500);
    let res = s.client.try_contribute(&alice, &500);
    assert_eq!(res, Err(Ok(Error::DeadlinePassed)));
}

#[test]
fn overfunding_beyond_gap_rejected() {
    let s = setup(1_000, &[1_000]);
    let alice = funder(&s, 700);
    s.client.contribute(&alice, &700);
    assert_eq!(s.client.get_info().total_raised, 700);

    // Remaining gap is 300; a 500 contribution would push total past the goal.
    let bob = funder(&s, 500);
    assert_eq!(
        s.client.try_contribute(&bob, &500),
        Err(Ok(Error::ExceedsGoal))
    );
    // The escrow is untouched by the rejected contribution.
    assert_eq!(s.token.balance(&s.client.address), 700);

    // Filling exactly to the goal succeeds.
    let carol = funder(&s, 300);
    s.client.contribute(&carol, &300);
    assert_eq!(s.client.get_info().total_raised, 1_000);
    assert_eq!(s.token.balance(&s.client.address), 1_000);
}

#[test]
fn zero_amount_rejected() {
    let s = setup(1_000, &[1_000]);
    let alice = funder(&s, 500);
    assert_eq!(
        s.client.try_contribute(&alice, &0),
        Err(Ok(Error::ZeroAmount))
    );
}

#[test]
fn refund_when_not_failed_rejected() {
    let s = setup(1_000, &[1_000]);
    let alice = funder(&s, 1_000);
    s.client.contribute(&alice, &1_000);
    // Goal met, deadline passed => Successful, not Failed.
    expire(&s);
    assert_eq!(s.client.try_refund(&alice), Err(Ok(Error::NotFailed)));
}

#[test]
fn double_refund_yields_nothing() {
    let s = setup(1_000, &[1_000]);
    let alice = funder(&s, 400);
    s.client.contribute(&alice, &400);
    expire(&s);
    s.client.refund(&alice);
    assert_eq!(s.client.try_refund(&alice), Err(Ok(Error::NothingToRefund)));
}

#[test]
fn release_out_of_order_rejected() {
    let s = setup(1_000, &[600, 400]);
    let alice = funder(&s, 1_000);
    s.client.contribute(&alice, &1_000);
    expire(&s);
    // Approve+release index 1 before 0 must fail (approval order first).
    assert_eq!(
        s.client.try_approve_milestone(&1),
        Err(Ok(Error::OutOfOrder))
    );
}

#[test]
fn release_without_approval_rejected() {
    let s = setup(1_000, &[1_000]);
    let alice = funder(&s, 1_000);
    s.client.contribute(&alice, &1_000);
    expire(&s);
    assert_eq!(
        s.client.try_release_milestone(&0),
        Err(Ok(Error::MilestoneNotApproved))
    );
}

#[test]
fn approve_before_goal_met_rejected() {
    let s = setup(1_000, &[1_000]);
    let alice = funder(&s, 400);
    s.client.contribute(&alice, &400);
    expire(&s); // Failed, not Successful.
    assert_eq!(
        s.client.try_approve_milestone(&0),
        Err(Ok(Error::GoalNotMet))
    );
}

#[test]
#[should_panic]
fn constructor_rejects_mismatched_milestones() {
    // Milestones sum to 900 but goal is 1000 => InvalidMilestones panic.
    setup(1_000, &[500, 400]);
}

#[test]
#[should_panic]
fn constructor_rejects_empty_milestones() {
    setup(1_000, &[]);
}

/// Property-style: across many random-ish contribution splits, the escrow
/// balance always equals the sum of contributions, and status flips correctly
/// at the goal boundary.
#[test]
fn invariant_escrow_equals_contributions() {
    let goal = 10_000i128;
    // Overfunding is now rejected, so `raised` never exceeds `goal`; the
    // goal-exact case (10_000) covers the Successful boundary.
    for raised in [0i128, 1, 5_000, 9_999, 10_000] {
        let s = setup(goal, &[goal]);
        if raised > 0 {
            let a = funder(&s, raised);
            s.client.contribute(&a, &raised);
        }
        assert_eq!(s.token.balance(&s.client.address), raised);
        assert_eq!(s.client.get_info().total_raised, raised);
        expire(&s);
        let expected = if raised >= goal {
            Status::Successful
        } else {
            Status::Failed
        };
        assert_eq!(s.client.get_status(), expected);
    }
}
