import {
  allowAllModules,
  FREIGHTER_ID,
  StellarWalletsKit,
  WalletNetwork,
  type ISupportedWallet,
} from "@creit.tech/stellar-wallets-kit";
import { config } from "../config";
import type { Signer } from "./stellar";

const network =
  config.network === "public" ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET;

export const kit = new StellarWalletsKit({
  network,
  selectedWalletId: FREIGHTER_ID,
  modules: allowAllModules(),
});

/** Open the multi-wallet picker and return the connected address. */
export async function connect(): Promise<string> {
  return new Promise((resolve, reject) => {
    kit
      .openModal({
        onWalletSelected: async (option: ISupportedWallet) => {
          try {
            kit.setWallet(option.id);
            const { address } = await kit.getAddress();
            resolve(address);
          } catch (e) {
            reject(e);
          }
        },
        onClosed: () => reject(new Error("Wallet selection cancelled")),
      })
      .catch(reject);
  });
}

export async function disconnect(): Promise<void> {
  await kit.disconnect();
}

/** A `Signer` bound to the connected wallet, for `invokeContract`. */
export function makeSigner(address: string): Signer {
  return {
    address,
    signTransaction: async (xdr: string) => {
      const { signedTxXdr } = await kit.signTransaction(xdr, {
        address,
        networkPassphrase: config.networkPassphrase,
      });
      return signedTxXdr;
    },
  };
}
