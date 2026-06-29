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
      const addr = await wallet.connect();
      setAddress(addr);
      localStorage.setItem(STORAGE_KEY, addr);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await wallet.disconnect().catch(() => undefined);
    setAddress(null);
    setBalance(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Restore a previously connected address (best-effort).
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setAddress(saved);
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
