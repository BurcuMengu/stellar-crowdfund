#![no_std]
//! # Factory contract
//!
//! Deploys and tracks independent `campaign` contract instances. Each campaign
//! gets its own contract (and therefore its own isolated escrow), so funds in
//! one campaign can never be affected by another.
//!
//! Inter-contract communication: `create_campaign` uses the on-chain deployer
//! to instantiate the campaign WASM and run its constructor in a single call,
//! then records the resulting address in a registry.

mod events;

#[cfg(test)]
mod test;

use crate::events::Events;
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, Vec};

/// Mirrors `campaign::types::Milestone` exactly. Defined here (rather than
/// depending on the campaign crate) so the factory's WASM doesn't link the
/// campaign contract's exported symbols. `#[contracttype]` structs are encoded
/// structurally by field name/type, so this is XDR-compatible with the campaign
/// constructor's `Vec<Milestone>` argument.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Milestone {
    pub amount: i128,
    pub approved: bool,
    pub released: bool,
}

const LEDGERS_PER_DAY: u32 = 17_280;
const TTL_THRESHOLD: u32 = LEDGERS_PER_DAY * 30;
const TTL_BUMP: u32 = LEDGERS_PER_DAY * 60;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    WasmHash,
    Count,
    Campaign(u32),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotFound = 2,
}

#[contract]
pub struct Factory;

#[contractimpl]
impl Factory {
    /// Initialize the factory with the admin and the uploaded campaign WASM
    /// hash. The admin first uploads `campaign.wasm` to the ledger (off-chain
    /// via the CLI), then passes the resulting hash here.
    pub fn __constructor(env: Env, admin: Address, campaign_wasm_hash: BytesN<32>) {
        if env.storage().instance().has(&DataKey::Admin) {
            soroban_sdk::panic_with_error!(&env, Error::AlreadyInitialized);
        }
        let s = env.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::WasmHash, &campaign_wasm_hash);
        s.set(&DataKey::Count, &0u32);
        s.extend_ttl(TTL_THRESHOLD, TTL_BUMP);
    }

    /// Deploy a new campaign instance and register it. Returns its address.
    ///
    /// The campaign's constructor runs as part of this call, so the deployed
    /// campaign is fully initialized and validated before this returns.
    pub fn create_campaign(
        env: Env,
        creator: Address,
        token: Address,
        goal: i128,
        deadline: u64,
        milestones: Vec<Milestone>,
    ) -> Address {
        creator.require_auth();

        let wasm_hash: BytesN<32> = env.storage().instance().get(&DataKey::WasmHash).unwrap();
        let count: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);

        // Deterministic salt from the campaign index.
        let mut salt_bytes = [0u8; 32];
        salt_bytes[..4].copy_from_slice(&count.to_be_bytes());
        let salt = BytesN::from_array(&env, &salt_bytes);

        let address = env.deployer().with_current_contract(salt).deploy_v2(
            wasm_hash,
            (creator.clone(), token, goal, deadline, milestones),
        );

        let s = env.storage().instance();
        s.set(&DataKey::Campaign(count), &address);
        s.set(&DataKey::Count, &(count + 1));
        s.extend_ttl(TTL_THRESHOLD, TTL_BUMP);

        Events::campaign_created(&env, count, &creator, &address);
        address
    }

    /// Number of campaigns deployed.
    pub fn count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }

    /// Address of campaign `id`, or an error if it doesn't exist.
    pub fn get_campaign(env: Env, id: u32) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Campaign(id))
            .ok_or(Error::NotFound)
    }

    /// All deployed campaign addresses, oldest first.
    pub fn list_campaigns(env: Env) -> Vec<Address> {
        let count: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        let mut out = Vec::new(&env);
        for id in 0..count {
            if let Some(addr) = env.storage().instance().get(&DataKey::Campaign(id)) {
                out.push_back(addr);
            }
        }
        out
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
}
