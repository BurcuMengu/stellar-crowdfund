# Deployments

## Testnet (2026-06-29)

Deployed and verified end-to-end (factory deploy → create campaign → mint USDC →
contribute, with funds escrowed and events emitted).

| Item | Value |
|---|---|
| Network | testnet |
| Deployer / USDC issuer | `GAKDQMK5JFSGHDH77LQCQXM43IB5IVCOZQZ6ECJTYTMH4DCYUC7DNLLH` |
| Factory contract | `CALMUO52YPO5N22S4RVP7FYDEBKIOUP76TYKJ3O2FGJCK3G3N4RDLTP5` |
| USDC SAC (test) | `CCA74LWCL4QS4CM3MCPTA7QI7WHGQ4F57GEW24T4JWYMSBFY63SIE4RP` |
| Campaign WASM hash | `902faf775c4b726012746f24cd4c3525ed7ab2cc26990b3a230af2b1207bfce4` |
| Example campaign | `CBKGNXKFIC53AMLAO4V47VVZGLMJLWMKBBRJIEYBUXE3QC3I4BEBUM6G` |

Explorer: <https://stellar.expert/explorer/testnet/contract/CALMUO52YPO5N22S4RVP7FYDEBKIOUP76TYKJ3O2FGJCK3G3N4RDLTP5>

> These IDs are written to `frontend/.env.local` by `scripts/deploy.sh` (which is
> git-ignored). Re-running the script creates a fresh set.

### Verified on-chain
- `factory.create_campaign` deployed a child campaign instance (inter-contract).
- `campaign.get_info` returned the correct config and `status: "Active"`.
- `contribute` moved 700 USDC into the campaign escrow; `total_raised` and
  `get_contribution` both read `7000000000` (700.0 USDC); `contrib` event emitted.
