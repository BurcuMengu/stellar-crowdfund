import { fromStroops, shortAddress } from "../lib/format";
import { useToast } from "../state/ToastContext";
import { useWallet } from "../state/WalletContext";
import { Spinner } from "./Spinner";

export function WalletButton() {
  const { address, balance, connecting, connect, disconnect } = useWallet();
  const { push } = useToast();

  const onConnect = async () => {
    try {
      await connect();
    } catch (e) {
      push((e as Error).message ?? "Could not connect wallet", "error");
    }
  };

  if (address) {
    return (
      <div className="flex items-center gap-3">
        {balance !== null && (
          <span className="hidden text-sm text-gray-500 sm:inline">
            {fromStroops(balance)} USDC
          </span>
        )}
        <button
          onClick={disconnect}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
          title="Disconnect"
        >
          {shortAddress(address)}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onConnect}
      disabled={connecting}
      className="flex items-center gap-2 rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
    >
      {connecting && <Spinner className="h-4 w-4" />}
      Connect Wallet
    </button>
  );
}
