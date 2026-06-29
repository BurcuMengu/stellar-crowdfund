#!/usr/bin/env bash
#
# Mint test USDC to an address (demo faucet). Reads the token + issuer from
# frontend/.env.local written by deploy.sh.
#
# Usage: ./scripts/mint.sh <recipient-address> [amount]
#
set -euo pipefail

RECIPIENT="${1:?usage: mint.sh <address> [amount]}"
AMOUNT="${2:-1000}"
NETWORK="${NETWORK:-testnet}"
IDENTITY="${IDENTITY:-crowdfund}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# shellcheck disable=SC1091
source "$ROOT/frontend/.env.local"

# USDC uses 7 decimals (stroops). Convert the human amount.
STROOPS=$(( AMOUNT * 10000000 ))

echo "▶ Minting $AMOUNT USDC ($STROOPS stroops) to $RECIPIENT"
stellar contract invoke \
  --id "$VITE_USDC_ID" \
  --source "$IDENTITY" --network "$NETWORK" \
  -- mint --to "$RECIPIENT" --amount "$STROOPS"
echo "✓ Done"
