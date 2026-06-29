# Architecture

## Overview

The system has three on-chain pieces and one off-chain app:

1. **`factory` contract** — a registry + deployer. Holds the campaign WASM hash
   and deploys a fresh `campaign` instance for each new campaign.
2. **`campaign` contract** — one instance per campaign. Holds the escrowed
   tokens and all crowdfunding logic.
3. **USDC SAC** — the Stellar Asset Contract exposing classic USDC as a SEP-41
   token that the campaign can `transfer`.
4. **Frontend** — React + Vite app that simulates/invokes contracts and streams
   events.

```
┌─────────────────────────────────────────────┐
│ Frontend (React, Vite, Stellar Wallets Kit)  │
│  pages: list · detail · create               │
│  lib: stellar (sim/invoke) · contracts ·     │
│       events (getEvents poll) · wallet        │
└───────────────┬──────────────────────────────┘
                │ @stellar/stellar-sdk
                ▼
       ┌─────────────────┐  deploy_v2 + __constructor  ┌──────────────────┐
       │  factory         │ ───────────────────────────▶│ campaign (xN)    │
       │  create_campaign │                              │ contribute       │
       │  list_campaigns  │                              │ approve/release  │
       └─────────────────┘                              │ refund           │
                                                         └────────┬─────────┘
                                                                  │ transfer
                                                                  ▼
                                                         ┌──────────────────┐
                                                         │ USDC SAC (SEP-41)│
                                                         └──────────────────┘
```

## Why a factory + per-campaign instances?

**Isolation.** Each campaign's funds live in its own contract. A bug, dispute,
or storage-exhaustion in one campaign cannot affect another's escrow. This is
the strongest demonstration of inter-contract communication: the factory uses
the on-chain deployer (`env.deployer().with_current_contract(salt).deploy_v2`)
to instantiate the campaign WASM and run its constructor atomically.

The alternative — a single contract storing all campaigns in maps — is simpler
but co-mingles funds and shares one storage/TTL fate.

## Campaign lifecycle (derived state)

`Status` is **never stored**; it is computed from goal, deadline, and milestone
flags. This removes a whole class of "state got out of sync" bugs.

```
            now < deadline           now ≥ deadline
                 │                          │
                 ▼                          ▼
              Active            raised ≥ goal ? Successful : Failed
                                          │
                              all milestones released ?
                                          ▼
                                      Finalized
```

- **Active:** `contribute` allowed.
- **Successful:** creator `approve_milestone` then `release_milestone`, in order.
- **Failed:** backers `refund` their exact contribution.
- **Finalized:** terminal; all milestone funds released.

## Money flow & safety

- **Contribute:** `campaign.contribute` calls `token.transfer(from, campaign,
  amount)`. `from` authorizes the whole call tree with one signature.
- **Release:** `token.transfer(campaign, creator, milestone.amount)`.
- **Refund:** the contributor's record is **zeroed before** the transfer
  (checks-effects-interactions) so a re-entrant call finds nothing to refund.
- **Validation:** the constructor rejects campaigns whose milestone amounts
  don't sum to the goal, and non-positive goals/amounts.

## Events

Typed events via `#[contractevent]`:

| Contract | Event | Topics | Data |
|---|---|---|---|
| campaign | `contrib` | `from` | `(amount, total_raised)` |
| campaign | `approve` | `idx` | — |
| campaign | `release` | `idx` | `amount` |
| campaign | `refund` | `to` | `amount` |
| factory | `created` | `id` | `(creator, address)` |

The frontend's `useEvents` hook polls RPC `getEvents` every 5s, keyed by
contract ID, and de-duplicates by event id to drive the live feed.

## Frontend layering

- `lib/stellar.ts` — RPC server, ScVal builders, `readContract` (simulation),
  `invokeContract` (simulate → sign via wallet → send → poll), error decoding.
- `lib/contracts.ts` — typed wrappers per contract method.
- `lib/events.ts` / `hooks/useEvents.ts` — event streaming.
- `lib/wallet.ts` / `state/WalletContext.tsx` — Wallets Kit + connection state.
- `hooks/useCampaigns`, `hooks/useCampaign` — data fetching with loading/error.
- `pages/*`, `components/*` — UI.

## Storage & TTL

- Campaign config and `total_raised`/`milestones` live in **instance** storage.
- Per-contributor balances live in **persistent** storage keyed by address, so
  they scale beyond instance-entry limits.
- Every mutating call bumps TTL (~60 days) to keep entries live.

## Trade-offs / future work

- Milestone approval is creator-controlled; a richer version would let backers
  vote (DAO-style) before release.
- A single bundled JS chunk is shipped; code-splitting per route would trim it.
- Indexing is poll-based; a dedicated indexer (Horizon/RPC stream → DB) would
  scale better than client-side `getEvents`.
