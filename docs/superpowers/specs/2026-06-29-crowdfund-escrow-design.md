# Stellar Crowdfunding & Escrow dApp — Design Spec

**Date:** 2026-06-29
**Status:** Approved

## Goal
A production-ready, end-to-end Stellar (Soroban) crowdfunding/escrow dApp that
demonstrates advanced contract logic, inter-contract communication, event
streaming, testing, CI/CD, and a mobile-responsive frontend.

## Decisions
- **Frontend:** React + Vite + TypeScript + Tailwind
- **Location:** `~/stellar-crowdfund` (monorepo)
- **Scope:** Full production (contracts + tests + CI/CD + frontend + docs)
- **Asset:** USDC via the Stellar Asset Contract (SAC, SEP-41 token interface)
- **Release model:** Milestone-based + all-or-nothing
- **Wallet:** Stellar Wallets Kit (multi-wallet)
- **Architecture:** Factory + per-campaign child contracts (Approach A)

## Architecture
```
Frontend (React+Vite, Wallets Kit)
   │ stellar-sdk (simulate + invoke)
   ▼
factory contract ──deploy+init──▶ campaign contract (1 instance per campaign)
                                        │ transfer / transfer_from
                                        ▼
                                  USDC (SAC token)
```

Inter-contract communication is shown two ways:
1. `factory` → deploys and initializes `campaign` instances (deployer pattern).
2. `campaign` → calls the USDC SAC token client (`transfer`, `transfer_from`).

## Contract: `campaign`
**State:** `creator`, `token` (SAC addr), `goal: i128`, `deadline: u64` (ledger
seq), `total_raised: i128`, `status` (Active/Successful/Failed/Finalized),
`milestones: Vec<Milestone>`, `contributions: Map<Address, i128>`.

**Milestone:** `{ amount: i128, released: bool, approved: bool }`.

**Functions:**
- `__constructor(creator, token, goal, deadline, milestones)` — validate that
  milestone amounts sum to `goal`; initialize state.
- `contribute(from, amount)` — `require_auth(from)`; `token.transfer_from` into
  the contract; update `total_raised` and `contributions`; emit `contribute`
  event. Rejected once deadline passed.
- `get_status()` — derive Active/Successful/Failed from goal vs deadline.
- `approve_milestone(idx)` — creator-only; mark milestone approved (sequential).
- `release_milestone(idx)` — requires Successful + approved + previous released;
  `token.transfer` milestone amount to creator; emit `release`.
- `refund()` — caller, only when Failed; transfer their contribution back; emit
  `refund`. Idempotency via zeroing the contribution.
- Views: `get_campaign`, `get_milestones`, `get_contribution(addr)`.

**Errors (`#[contracterror]`):** AlreadyInitialized, InvalidMilestones,
DeadlinePassed, ZeroAmount, GoalNotMet, DeadlineNotPassed, NotFailed,
NothingToRefund, Unauthorized, MilestoneNotApproved, MilestoneAlreadyReleased,
OutOfOrder.

**Auth:** `require_auth` on contributor for `contribute`/`refund`; creator auth
for `approve_milestone`/`release_milestone`.

## Contract: `factory`
- `__constructor(admin, wasm_hash)` — store the campaign wasm hash + admin.
- `create_campaign(creator, token, goal, deadline, milestones)` —
  `deployer().with_address(...).deploy_v2(wasm_hash, args)` to deploy + init a
  new campaign; append address to registry; emit `campaign_created`.
- Views: `list_campaigns()`, `get_campaign(id)`, `count()`.

## Frontend
- **Pages:** Campaign list, detail (progress bar + milestones + live event
  feed), create campaign, wallet connect.
- **Flows:** simulate → sign (Wallets Kit) → submit; loading spinners; error
  toasts; optimistic refresh.
- **Event streaming:** RPC `getEvents` polling (~5s) for `contribute`,
  `release`, `refund`, `campaign_created`.
- **Mobile-responsive:** Tailwind mobile-first.

## Testing
- **Contracts:** unit tests with a test SAC token; happy paths, every error
  path, deadline/refund scenarios; fuzz on contribution amounts.
- **Frontend:** Vitest + React Testing Library (components + mocked invokes).

## CI/CD
- **CI (`ci.yml`):** `cargo fmt --check`, `clippy -D warnings`, `cargo test`,
  `stellar contract build`; frontend `lint + test + build`.
- **Deploy (`deploy.yml`):** manual-dispatch testnet deploy via `scripts/`,
  writing contract IDs into frontend `.env`.

## Repo layout
```
stellar-crowdfund/
├── contracts/{campaign,factory}/   (Rust)
├── frontend/                        (React+Vite+TS+Tailwind)
├── scripts/                         (deploy.sh, fund.sh)
├── .github/workflows/              (ci.yml, deploy.yml)
├── docs/                            (architecture, demo notes, spec)
└── README.md
```
