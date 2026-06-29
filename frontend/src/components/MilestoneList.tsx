import { fromStroops } from "../lib/format";
import type { CampaignInfo, Milestone } from "../types";
import { Spinner } from "./Spinner";

interface Props {
  info: CampaignInfo;
  isCreator: boolean;
  busyIdx: number | null;
  onApprove: (idx: number) => void;
  onRelease: (idx: number) => void;
}

function nextActionable(milestones: Milestone[]): number {
  return milestones.findIndex((m) => !m.released);
}

export function MilestoneList({ info, isCreator, busyIdx, onApprove, onRelease }: Props) {
  const canManage = isCreator && info.status === "Successful";
  const next = nextActionable(info.milestones);

  return (
    <ol className="space-y-3">
      {info.milestones.map((m, idx) => {
        const isNext = idx === next;
        const busy = busyIdx === idx;
        return (
          <li
            key={idx}
            className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
          >
            <div>
              <div className="font-medium">
                Milestone {idx + 1} · {fromStroops(m.amount)} USDC
              </div>
              <div className="text-xs text-gray-500">
                {m.released ? "Released" : m.approved ? "Approved" : "Pending"}
              </div>
            </div>

            {canManage && isNext && !m.released && (
              <button
                onClick={() => (m.approved ? onRelease(idx) : onApprove(idx))}
                disabled={busy}
                className="flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
              >
                {busy && <Spinner className="h-4 w-4" />}
                {m.approved ? "Release funds" : "Approve"}
              </button>
            )}

            {m.released && <span className="text-green-600">✓</span>}
          </li>
        );
      })}
    </ol>
  );
}
