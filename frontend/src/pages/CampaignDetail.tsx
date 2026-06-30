import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EventFeed } from "../components/EventFeed";
import { MilestoneList } from "../components/MilestoneList";
import { ProgressBar } from "../components/ProgressBar";
import { Spinner } from "../components/Spinner";
import { StatusBadge } from "../components/StatusBadge";
import {
  approveMilestone,
  contribute,
  getContribution,
  refund,
  releaseMilestone,
} from "../lib/contracts";
import { decodeError } from "../lib/stellar";
import { addUsdcTrustline } from "../lib/trustline";
import { config } from "../config";
import { formatCountdown, fromStroops, shortAddress, toStroops } from "../lib/format";
import { useCampaign } from "../hooks/useCampaign";
import { useEvents } from "../hooks/useEvents";
import { useToast } from "../state/ToastContext";
import { useWallet } from "../state/WalletContext";

export function CampaignDetail() {
  const { address } = useParams<{ address: string }>();
  const { info, loading, error, reload } = useCampaign(address);
  const events = useEvents(address ? [address] : []);
  const { signer, address: wallet, balance, refreshBalance } = useWallet();
  const { push } = useToast();

  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [myContribution, setMyContribution] = useState<bigint>(0n);

  const isCreator = !!wallet && !!info && wallet === info.creator;

  // Refresh "your contribution" whenever the wallet, campaign, or events change.
  useEffect(() => {
    if (!wallet || !address) {
      setMyContribution(0n);
      return;
    }
    void getContribution(address, wallet).then(setMyContribution).catch(() => undefined);
  }, [wallet, address, events.length]);

  const afterAction = async () => {
    await reload();
    await refreshBalance();
  };

  const onAddTrustline = async () => {
    if (!signer) return push("Connect your wallet first.", "error");
    setBusy("trustline");
    try {
      await addUsdcTrustline(signer);
      push("USDC trustline added. Now get some test USDC to contribute.", "success");
      await refreshBalance();
    } catch (e) {
      push(decodeError((e as Error).message), "error");
    } finally {
      setBusy(null);
    }
  };

  const onContribute = async () => {
    if (!signer) return push("Connect your wallet first.", "error");
    let stroops: bigint;
    try {
      stroops = toStroops(amount);
    } catch (e) {
      return push((e as Error).message, "error");
    }
    setBusy("contribute");
    try {
      await contribute(signer, address!, stroops);
      push(`Contributed ${amount} USDC. Thank you!`, "success");
      setAmount("");
      await afterAction();
    } catch (e) {
      push(decodeError((e as Error).message), "error");
    } finally {
      setBusy(null);
    }
  };

  const onRefund = async () => {
    if (!signer) return push("Connect your wallet first.", "error");
    setBusy("refund");
    try {
      await refund(signer, address!);
      push("Refund complete.", "success");
      await afterAction();
    } catch (e) {
      push(decodeError((e as Error).message), "error");
    } finally {
      setBusy(null);
    }
  };

  const onMilestone = async (idx: number, action: "approve" | "release") => {
    if (!signer) return push("Connect your wallet first.", "error");
    setBusy(`m-${idx}`);
    try {
      if (action === "approve") await approveMilestone(signer, address!, idx);
      else await releaseMilestone(signer, address!, idx);
      push(action === "approve" ? "Milestone approved." : "Funds released.", "success");
      await afterAction();
    } catch (e) {
      push(decodeError((e as Error).message), "error");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-brand">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (error || !info) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error ?? "Campaign not found."}{" "}
        <Link to="/" className="font-semibold underline">
          Back
        </Link>
      </div>
    );
  }

  const canRefund = info.status === "Failed" && myContribution > 0n;
  const canContribute = info.status === "Active";

  return (
    <div className="space-y-6">
      <Link to="/" className="text-sm text-gray-500 hover:underline">
        ← All campaigns
      </Link>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-gray-500">by {shortAddress(info.creator)}</span>
          <StatusBadge status={info.status} />
        </div>

        <ProgressBar info={info} />
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-2xl font-bold">
            {fromStroops(info.total_raised)}{" "}
            <span className="text-base font-normal text-gray-500">
              / {fromStroops(info.goal)} USDC
            </span>
          </span>
          <span className="text-sm text-gray-500">{formatCountdown(info.deadline)}</span>
        </div>

        {myContribution > 0n && (
          <p className="mt-2 text-sm text-gray-500">
            Your contribution: {fromStroops(myContribution)} USDC
          </p>
        )}

        {/* Needs USDC helper */}
        {canContribute && wallet && (balance === null || balance === 0n) && (
          <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">You need test USDC to contribute.</p>
            <p className="mt-1">
              1) Add the USDC trustline, then 2) get test USDC from the issuer
              (<code>{shortAddress(config.usdcIssuer)}</code>) — e.g.{" "}
              <code>./scripts/mint.sh {shortAddress(wallet)} 1000</code>.
            </p>
            <button
              onClick={onAddTrustline}
              disabled={busy === "trustline"}
              className="mt-3 flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-1.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {busy === "trustline" && <Spinner className="h-4 w-4" />}
              Add USDC trustline
            </button>
          </div>
        )}

        {/* Contribute */}
        {canContribute && (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              inputMode="decimal"
              id="contribute-amount"
              name="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount (USDC)"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
            />
            <button
              onClick={onContribute}
              disabled={busy === "contribute"}
              className="flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {busy === "contribute" && <Spinner className="h-4 w-4" />}
              Contribute
            </button>
          </div>
        )}

        {/* Refund */}
        {canRefund && (
          <button
            onClick={onRefund}
            disabled={busy === "refund"}
            className="mt-5 flex items-center gap-2 rounded-lg border border-red-300 px-5 py-2 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            {busy === "refund" && <Spinner className="h-4 w-4" />}
            Refund my contribution
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Milestones</h2>
          <MilestoneList
            info={info}
            isCreator={isCreator}
            busyIdx={busy?.startsWith("m-") ? Number(busy.slice(2)) : null}
            onApprove={(idx) => onMilestone(idx, "approve")}
            onRelease={(idx) => onMilestone(idx, "release")}
          />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Live activity</h2>
          <EventFeed events={events} />
        </section>
      </div>
    </div>
  );
}
