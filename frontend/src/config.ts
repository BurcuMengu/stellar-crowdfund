/** Runtime configuration sourced from Vite env vars (see .env.example). */
export const config = {
  network: import.meta.env.VITE_NETWORK ?? "testnet",
  rpcUrl: import.meta.env.VITE_RPC_URL ?? "https://soroban-testnet.stellar.org",
  networkPassphrase:
    import.meta.env.VITE_NETWORK_PASSPHRASE ??
    "Test SDF Network ; September 2015",
  factoryId: import.meta.env.VITE_FACTORY_ID ?? "",
  usdcId: import.meta.env.VITE_USDC_ID ?? "",
  usdcIssuer: import.meta.env.VITE_USDC_ISSUER ?? "",
};

/** USDC (and our test SAC) use 7 decimals. */
export const TOKEN_DECIMALS = 7;

export function isConfigured(): boolean {
  return Boolean(config.factoryId && config.usdcId);
}
