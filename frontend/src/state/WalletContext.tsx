import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { tokenBalance } from "../lib/contracts";
import type { Signer } from "../lib/stellar";
import * as wallet from "../lib/wallet";

interface WalletApi {
  address: string | null;
  signer: Signer | null;
  balance: bigint | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletApi | null>(null);
const STORAGE_KEY = "crowdfund.address";
const WALLET_ID_KEY = "crowdfund.walletId";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [connecting, setConnecting] = useState(false);

  const refreshBalance = useCallback(async () => {
    if (!address) return;
    setBalance(await tokenBalance(address));
  }, [address]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const { address: addr, walletId } = await wallet.connect();
      setAddress(addr);
      localStorage.setItem(STORAGE_KEY, addr);
      localStorage.setItem(WALLET_ID_KEY, walletId);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await wallet.disconnect().catch(() => undefined);
    setAddress(null);
    setBalance(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(WALLET_ID_KEY);
  }, []);

  // Restore a previously connected address (best-effort). The saved wallet id
  // must be re-selected on the kit, otherwise it silently falls back to the
  // default (Freighter) and signs with the wrong wallet.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const savedId = localStorage.getItem(WALLET_ID_KEY);
    if (savedId) wallet.selectWallet(savedId);
    setAddress(saved);
  }, []);

  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance]);

  const signer = address ? wallet.makeSigner(address) : null;

  return (
    <WalletContext.Provider
      value={{ address, signer, balance, connecting, connect, disconnect, refreshBalance }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletApi {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
