use soroban_sdk::{contractevent, Address, Env};

/// A new campaign was deployed and registered.
#[contractevent(topics = ["created"])]
#[derive(Clone)]
pub struct CampaignCreated {
    #[topic]
    pub id: u32,
    pub creator: Address,
    pub address: Address,
}

pub struct Events;

impl Events {
    pub fn campaign_created(env: &Env, id: u32, creator: &Address, address: &Address) {
        CampaignCreated {
            id,
            creator: creator.clone(),
            address: address.clone(),
        }
        .publish(env);
    }
}
