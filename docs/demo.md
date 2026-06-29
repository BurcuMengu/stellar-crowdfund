# Demo Script

A ~5-minute walkthrough that shows every requirement working end to end.

## 0. Setup (once, before the demo)

```bash
stellar contract build
cargo test                       # show 15 passing contract tests
./scripts/deploy.sh              # deploys factory + test USDC to testnet
./scripts/mint.sh <addrA> 1000   # fund two demo backers
./scripts/mint.sh <addrB> 1000
cd frontend && npm install && npm run dev
```

Open the app, have **two** browser profiles/wallets ready (a creator + a backer),
each with a USDC trustline.

## 1. Create a campaign (creator)

1. Connect the creator wallet (Wallets Kit modal — show multi-wallet support).
2. Go to **+ New Campaign**.
3. Goal `1000`, deadline a few minutes out, milestones `600` + `400`.
4. Watch the live validation: "Milestone total: 1000 USDC ✓".
5. Submit → it deploys a **new campaign contract** via the factory and routes to
   its detail page.

> Talking point: each campaign is its own contract — show the new contract
> address; the factory's `list_campaigns` now returns it.

## 2. Contribute (backers)

1. As backer A, contribute `700`. Show the spinner → success toast.
2. The progress bar jumps to 70%; the **Live activity** feed shows the
   contribution (streamed from on-chain events).
3. As backer B, contribute `300`. Goal reached (100%).

> Talking point: funds are escrowed in the campaign contract, not the creator's
> account — verify with the balance.

## 3. Reach the deadline → Successful

Wait for the deadline (or set a short one). Refresh — status flips to
**Successful**. The contribute box disappears; milestone controls appear for the
creator.

## 4. Release funds by milestone (creator)

1. As creator: **Approve** milestone 1 → **Release funds** → 600 USDC moves to
   the creator. Feed shows `Milestone 1 released`.
2. Repeat for milestone 2 (400 USDC). Status flips to **Finalized**.

> Talking point: releases are sequential and require approval first — try
> releasing out of order to show the contract rejecting it (friendly error toast).

## 5. The failure path (refund)

Create a second campaign with a goal nobody fully funds, contribute a little,
let it expire → status **Failed** → backer clicks **Refund my contribution** and
gets their exact tokens back. The feed shows the `refund` event.

## What to highlight for each requirement

| Requirement | Where |
|---|---|
| Advanced contract logic | milestone escrow + derived status state machine |
| Inter-contract comms | factory deploys campaign; campaign calls USDC SAC |
| Event streaming | Live activity feed (RPC `getEvents`) |
| CI/CD | GitHub Actions tab: fmt/clippy/test/build green |
| Deployment workflow | `scripts/deploy.sh` + manual `deploy.yml` |
| Mobile responsive | resize the window / open on a phone |
| Error & loading states | spinners, toasts, rejected-tx messages |
| Tests | `cargo test` (15) + `npm test` (16) |
| Docs | this file + `architecture.md` + README |
