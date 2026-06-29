#![cfg(test)]
extern crate std;

use crate::{Factory, FactoryClient, Milestone};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, vec, Address, Env, Vec,
};

// Pull in the compiled campaign WASM so the factory can deploy real instances.
// Requires `stellar contract build` (or the wasm target build) to have run.
mod campaign_contract {
    soroban_sdk::contractimport!(file = "../../target/wasm32v1-none/release/campaign.wasm");
}

const DAY: u64 = 86_400;

fn milestones(env: &Env, amounts: &[i128]) -> Vec<Milestone> {
    let mut v = Vec::new(env);
    for a in amounts {
        v.push_back(Milestone {
            amount: *a,
            approved: false,
            released: false,
        });
    }
    v
}

struct Setup<'a> {
    env: Env,
    admin: Address,
    factory: FactoryClient<'a>,
    token_addr: Address,
    token_admin: token::StellarAssetClient<'a>,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.timestamp = 1_000);

    let admin = Address::generate(&env);

    // Upload the campaign wasm and hand its hash to the factory.
    let wasm_hash = env.deployer().upload_contract_wasm(campaign_contract::WASM);
    let factory_id = env.register(Factory, (admin.clone(), wasm_hash));
    let factory = FactoryClient::new(&env, &factory_id);

    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let token_admin = token::StellarAssetClient::new(&env, &sac.address());

    Setup {
        env,
        admin,
        factory,
        token_addr: sac.address(),
        token_admin,
    }
}

#[test]
fn deploys_and_registers_campaigns() {
    let s = setup();
    let creator = Address::generate(&s.env);
    let deadline = s.env.ledger().timestamp() + DAY;

    assert_eq!(s.factory.count(), 0);

    let addr0 = s.factory.create_campaign(
        &creator,
        &s.token_addr,
        &1_000,
        &deadline,
        &milestones(&s.env, &[1_000]),
    );
    let addr1 = s.factory.create_campaign(
        &creator,
        &s.token_addr,
        &500,
        &deadline,
        &milestones(&s.env, &[200, 300]),
    );

    assert_eq!(s.factory.count(), 2);
    assert_ne!(addr0, addr1);
    assert_eq!(s.factory.get_campaign(&0), addr0);
    assert_eq!(s.factory.get_campaign(&1), addr1);
    assert_eq!(
        s.factory.list_campaigns(),
        vec![&s.env, addr0.clone(), addr1.clone()]
    );
    assert_eq!(s.factory.admin(), s.admin);
}

#[test]
fn deployed_campaign_is_initialized_and_usable() {
    let s = setup();
    let creator = Address::generate(&s.env);
    let deadline = s.env.ledger().timestamp() + DAY;

    let addr = s.factory.create_campaign(
        &creator,
        &s.token_addr,
        &1_000,
        &deadline,
        &milestones(&s.env, &[1_000]),
    );

    // Talk to the deployed campaign through the imported client.
    let campaign = campaign_contract::Client::new(&s.env, &addr);
    let info = campaign.get_info();
    assert_eq!(info.goal, 1_000);
    assert_eq!(info.creator, creator);
    assert_eq!(info.total_raised, 0);

    // A real contribution flows end-to-end into the deployed escrow.
    let alice = Address::generate(&s.env);
    s.token_admin.mint(&alice, &1_000);
    campaign.contribute(&alice, &1_000);
    assert_eq!(campaign.get_info().total_raised, 1_000);

    let token = token::TokenClient::new(&s.env, &s.token_addr);
    assert_eq!(token.balance(&addr), 1_000);
}

#[test]
fn get_missing_campaign_errors() {
    let s = setup();
    assert_eq!(
        s.factory.try_get_campaign(&99),
        Err(Ok(crate::Error::NotFound))
    );
}
