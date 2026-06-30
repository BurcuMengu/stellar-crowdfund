import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Spinner } from "../components/Spinner";
import { config } from "../config";
import { createCampaign } from "../lib/contracts";
import { decodeError } from "../lib/stellar";
import { fromStroops, toStroops } from "../lib/format";
import { useToast } from "../state/ToastContext";
import { useWallet } from "../state/WalletContext";

export function CreateCampaign() {
  const { signer } = useWallet();
  const { push } = useToast();
  const navigate = useNavigate();

  const [goal, setGoal] = useState("");
  const [deadline, setDeadline] = useState("");
  const [milestones, setMilestones] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);

  const setMilestone = (i: number, v: string) =>
    setMilestones((m) => m.map((x, idx) => (idx === i ? v : x)));
  const addMilestone = () => setMilestones((m) => [...m, ""]);
  const removeMilestone = (i: number) =>
    setMilestones((m) => (m.length > 1 ? m.filter((_, idx) => idx !== i) : m));

  // Live validation summary.
  let milestoneSum = 0n;
  let parseOk = true;
  for (const m of milestones) {
    try {
      milestoneSum += toStroops(m || "0");
    } catch {
      parseOk = false;
    }
  }
  let goalStroops = 0n;
  try {
    goalStroops = toStroops(goal || "0");
  } catch {
    parseOk = false;
  }
  const sumMatches = parseOk && goalStroops > 0n && milestoneSum === goalStroops;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer) return push("Connect your wallet first.", "error");
    if (!sumMatches) return push("Milestone amounts must sum to the goal.", "error");

    const deadlineSecs = BigInt(Math.floor(new Date(deadline).getTime() / 1000));
    if (deadlineSecs <= BigInt(Math.floor(Date.now() / 1000))) {
      return push("Deadline must be in the future.", "error");
    }

    setBusy(true);
    try {
      const addr = await createCampaign(signer, {
        token: config.usdcId,
        goal: goalStroops,
        deadline: deadlineSecs,
        milestones: milestones.map((m) => ({ amount: toStroops(m) })),
      });
      push("Campaign created!", "success");
      if (addr) navigate(`/campaign/${addr}`);
      else navigate("/");
    } catch (err) {
      push(decodeError((err as Error).message), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold">Create a campaign</h1>

      <form onSubmit={onSubmit} className="space-y-5 rounded-xl border border-gray-200 bg-white p-6">
        <label className="block">
          <span className="text-sm font-medium">Funding goal (USDC)</span>
          <input
            type="text"
            inputMode="decimal"
            id="goal"
            name="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="1000"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Deadline</span>
          <input
            type="datetime-local"
            id="deadline"
            name="deadline"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
          />
        </label>

        <div>
          <span className="text-sm font-medium">Milestones</span>
          <p className="mb-2 text-xs text-gray-500">
            Funds are released in these chunks. They must sum to the goal.
          </p>
          <div className="space-y-2">
            {milestones.map((m, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  id={`milestone-${i}`}
                  name={`milestone-${i}`}
                  value={m}
                  onChange={(e) => setMilestone(i, e.target.value)}
                  placeholder={`Milestone ${i + 1} amount`}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:border-brand focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeMilestone(i)}
                  className="rounded-lg border border-gray-300 px-3 text-gray-500 hover:bg-gray-50"
                  aria-label="Remove milestone"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addMilestone}
            className="mt-2 text-sm font-semibold text-brand hover:underline"
          >
            + Add milestone
          </button>
        </div>

        <div className={`text-sm ${sumMatches ? "text-green-600" : "text-gray-500"}`}>
          Milestone total: {fromStroops(milestoneSum)} USDC
          {goalStroops > 0n && !sumMatches && " — must equal the goal"}
          {sumMatches && " ✓"}
        </div>

        <button
          type="submit"
          disabled={busy || !sumMatches}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {busy && <Spinner className="h-4 w-4" />}
          Create campaign
        </button>
      </form>
    </div>
  );
}
