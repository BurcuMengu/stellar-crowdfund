import { progressPercent } from "../lib/format";
import type { CampaignInfo } from "../types";

export function ProgressBar({ info }: { info: Pick<CampaignInfo, "goal" | "total_raised"> }) {
  const pct = progressPercent(info);
  return (
    <div
      className="h-3 w-full overflow-hidden rounded-full bg-gray-200"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-brand transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
