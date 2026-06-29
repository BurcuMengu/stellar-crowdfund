import { Link } from "react-router-dom";
import { formatCountdown, fromStroops, shortAddress } from "../lib/format";
import type { CampaignInfo } from "../types";
import { ProgressBar } from "./ProgressBar";
import { StatusBadge } from "./StatusBadge";

export function CampaignCard({ info }: { info: CampaignInfo }) {
  return (
    <Link
      to={`/campaign/${info.address}`}
      className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-gray-500">by {shortAddress(info.creator)}</span>
        <StatusBadge status={info.status} />
      </div>

      <ProgressBar info={info} />

      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-lg font-semibold">
          {fromStroops(info.total_raised)}{" "}
          <span className="text-sm font-normal text-gray-500">
            / {fromStroops(info.goal)} USDC
          </span>
        </span>
        <span className="text-sm text-gray-500">{formatCountdown(info.deadline)}</span>
      </div>

      <div className="mt-2 text-xs text-gray-400">
        {info.milestones.length} milestone{info.milestones.length === 1 ? "" : "s"}
      </div>
    </Link>
  );
}
