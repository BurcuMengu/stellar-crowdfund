# Stellar Crowdfund — Milestone Escrow dApp

A production-style, end-to-end crowdfunding/escrow dApp on **Stellar / Soroban**.

Backers contribute a SEP-41 token (USDC via its Stellar Asset Contract) into a
per-campaign escrow. If the goal is met by the deadline, the creator releases
funds **milestone by milestone**. If not, every backer can **refund** their exact
contribution. Each campaign is its own contract instance — deployed by a
**factory** — so one campaign's escrow can never touch another's.

```
React + Vite + Wallets Kit
        │ stellar-sdk (simulate + invoke)
        ▼
   factory ──deploy+init──▶ campaign (1 instance per campaign)
                                 │ transfer / transfer_from
                                 ▼
                          USDC (SAC token)
```

## Features

- **Advanced contract logic** — milestone-based, all-or-nothing escrow with a
  derived (never-drifting) lifecycle state machine.
- **Inter-contract communication** — the factory deploys + initializes campaign
  instances via the on-chain deployer; campaigns call the token SAC.
- **Event streaming** — contracts emit typed events (`#[contractevent]`); the
  frontend streams them via RPC `getEvents` for a live activity feed.
- **Mobile-responsive frontend** — React + Tailwind, mobile-first.
- **Error & loading states** — friendly contract-error decoding, spinners,
  toasts, optimistic refresh.
- **Tests** — 15 contract tests (unit + integration + property + factory deploy)
  and 16 frontend tests.
- **CI/CD** — GitHub Actions for fmt/clippy/test/build + a gated deploy workflow.

## Repo layout

```
contracts/
  campaign/   Soroban contract: contribute, milestones, refund, claim
  factory/    Soroban contract: deploys + registers campaign instances
frontend/     React + Vite + TS + Tailwind dApp
scripts/      deploy.sh, mint.sh
.github/      CI + deploy workflows
docs/         architecture, demo script, design spec
```

## Prerequisites

- Rust + `wasm32v1-none` target, [`stellar` CLI](https://developers.stellar.org/docs/tools/cli) ≥ 22
- Node.js ≥ 20

## Quick start

```bash
# 1. Build + test the contracts
stellar contract build
cargo test

# 2. Deploy to testnet (creates a funded identity, deploys factory + test USDC,
#    and writes frontend/.env.local)
./scripts/deploy.sh

# 3. Mint yourself some test USDC (needs a USDC trustline on the recipient)
./scripts/mint.sh <your-address> 1000

# 4. Run the frontend
cd frontend
npm install
npm run dev
```

> **Note on USDC trustlines:** the test USDC is a classic Stellar asset wrapped
> as a SAC. To receive it, an account needs a trustline to `USDC:<issuer>` (the
> issuer is printed by `deploy.sh`). Wallets like Freighter let you add it in a
> click, or use `stellar tx new change-trust`.

## Contract reference

### `campaign`
| Function | Auth | Description |
|---|---|---|
| `__constructor(creator, token, goal, deadline, milestones)` | — | Runs at deploy; validates milestones sum to goal. |
| `contribute(from, amount)` | `from` | Pulls tokens into escrow while Active. |
| `approve_milestone(idx)` | creator | Approve next milestone (Successful only). |
| `release_milestone(idx)` | creator | Release approved milestone funds, in order. |
| `refund(to)` | `to` | Refund full contribution when Failed. |
| `get_info` / `get_status` / `get_contribution` / `get_milestones` | — | Views. |

**Status** is derived live: `Active` → (`Successful` \| `Failed`) at the
deadline; `Successful` → `Finalized` once all milestones are released.

### `factory`
| Function | Auth | Description |
|---|---|---|
| `__constructor(admin, campaign_wasm_hash)` | — | Stores admin + campaign WASM hash. |
| `create_campaign(creator, token, goal, deadline, milestones)` | creator | Deploys + initializes a campaign, returns its address. |
| `count` / `get_campaign(id)` / `list_campaigns` / `admin` | — | Views. |

## Testing

```bash
cargo test                  # contracts (run `stellar contract build` first)
cd frontend && npm test     # frontend
```

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — design, data flow, decisions
- [`docs/demo.md`](docs/demo.md) — step-by-step demo script
- [`docs/superpowers/specs/`](docs/superpowers/specs/) — original design spec

## License

MIT
