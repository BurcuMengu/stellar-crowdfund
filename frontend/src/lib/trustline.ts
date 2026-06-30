import {
  Asset,
  BASE_FEE,
  Operation,
  rpc,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { config } from "../config";
import { getServer, type Signer } from "./stellar";

/**
 * Add a trustline to the test USDC asset for the connected account, so it can
 * hold and transfer USDC. This is a classic Stellar operation submitted through
 * the same RPC endpoint.
 */
export async function addUsdcTrustline(signer: Signer): Promise<void> {
  if (!config.usdcIssuer) {
    throw new Error("USDC issuer is not configured");
  }
  const srv = getServer();
  const account = await srv.getAccount(signer.address);
  const usdc = new Asset("USDC", config.usdcIssuer);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(Operation.changeTrust({ asset: usdc }))
    .setTimeout(60)
    .build();

  const signedXdr = await signer.signTransaction(tx.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signedXdr, config.networkPassphrase);

  const sent = await srv.sendTransaction(signedTx);
  if (sent.status === "ERROR") {
    throw new Error("Failed to submit trustline transaction");
  }

  let result = await srv.getTransaction(sent.hash);
  const deadline = Date.now() + 30_000;
  while (result.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
    if (Date.now() > deadline) throw new Error("Trustline transaction timed out");
    await new Promise((r) => setTimeout(r, 1000));
    result = await srv.getTransaction(sent.hash);
  }
  if (result.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Trustline transaction failed: ${result.status}`);
  }
}
