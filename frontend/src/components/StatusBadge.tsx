import { statusClass } from "../lib/format";
import type { Status } from "../types";

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass(status)}`}
    >
      {status}
    </span>
  );
}
