import {
  Account,
  BASE_FEE,
  Contract,
  Keypair,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { config } from "../config";

let server: rpc.Server | null = null;

export function getServer(): rpc.Server {
  if (!server) {
    server = new rpc.Server(config.rpcUrl, {
      allowHttp: config.rpcUrl.startsWith("http://"),
    });
  }
  return server;
}

// ---- ScVal builders --------------------------------------------------------

export const toAddress = (a: string): xdr.ScVal =>
  nativeToScVal(a, { type: "address" });
export const toI128 = (n: bigint): xdr.ScVal => nativeToScVal(n, { type: "i128" });
export const toU64 = (n: bigint | number): xdr.ScVal =>
  nativeToScVal(BigInt(n), { type: "u64" });
export const toU32 = (n: number): xdr.ScVal => nativeToScVal(n, { type: "u32" });

export function milestoneScVal(m: { amount: bigint }): xdr.ScVal {
  // Map keys must be symbols in sorted order: amount < approved < released.
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("amount"),
      val: toI128(m.amount),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("approved"),
      val: xdr.ScVal.scvBool(false),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("released"),
      val: xdr.ScVal.scvBool(false),
    }),
  ]);
}

export const milestonesScVal = (ms: { amount: bigint }[]): xdr.ScVal =>
  xdr.ScVal.scvVec(ms.map(milestoneScVal));

// ---- read (simulation only, no signing) ------------------------------------

/**
 * Simulate a read-only contract call and return the decoded result. Uses a
 * throwaway source account, so it works before any wallet is connected.
 */
export async function readContract<T>(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<T> {
  const srv = getServer();
  const source = new Account(Keypair.random().publicKey(), "0");
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await srv.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(decodeError(sim.error));
  }
  const retval = sim.result?.retval;
  if (!retval) throw new Error("Empty simulation result");
  return scValToNative(retval) as T;
}

// ---- write (simulate + sign + submit + poll) -------------------------------

export interface Signer {
  address: string;
  signTransaction: (xdr: string) => Promise<string>;
}

/**
 * Build, simulate, sign (via the wallet), submit, and poll a state-changing
 * contract call. Returns the decoded return value (or null).
 */
export async function invokeContract<T = unknown>(opts: {
  contractId: string;
  method: string;
  args?: xdr.ScVal[];
  signer: Signer;
}): Promise<T | null> {
  const srv = getServer();
  const account = await srv.getAccount(opts.signer.address);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(new Contract(opts.contractId).call(opts.method, ...(opts.args ?? [])))
    .setTimeout(60)
    .build();

  const prepared = await srv.prepareTransaction(tx);
  const signedXdr = await opts.signer.signTransaction(prepared.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signedXdr, config.networkPassphrase);

  const sent = await srv.sendTransaction(signedTx);
  if (sent.status === "ERROR") {
    throw new Error(decodeError(sent.errorResult));
  }

  let result = await srv.getTransaction(sent.hash);
  const deadline = Date.now() + 30_000;
  while (result.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
    if (Date.now() > deadline) throw new Error("Transaction timed out");
    await sleep(1000);
    result = await srv.getTransaction(sent.hash);
  }

  if (result.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Transaction failed: ${result.status}`);
  }
  return result.returnValue ? (scValToNative(result.returnValue) as T) : null;
}

// ---- helpers ---------------------------------------------------------------

const CONTRACT_ERRORS: Record<number, string> = {
  4: "The deadline has passed — contributions are closed.",
  5: "Amount must be greater than zero.",
  6: "The funding goal was not met.",
  8: "Refunds are only available for failed campaigns.",
  9: "You have nothing to refund.",
  11: "This milestone has not been approved yet.",
  12: "This milestone was already released.",
  13: "Milestones must be handled in order.",
};

/** Turn a raw contract/simulation error into a friendly message when possible. */
export function decodeError(raw: unknown): string {
  const text = typeof raw === "string" ? raw : JSON.stringify(raw ?? "");
  const match = text.match(/Error\(Contract,\s*#(\d+)\)/);
  if (match) {
    const code = Number(match[1]);
    return CONTRACT_ERRORS[code] ?? `Contract error #${code}`;
  }
  return text || "Unknown error";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
