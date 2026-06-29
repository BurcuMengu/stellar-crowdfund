import { TOKEN_DECIMALS } from "../config";
import type { CampaignInfo, Status } from "../types";

const SCALE = 10n ** BigInt(TOKEN_DECIMALS);

/** Convert stroops (bigint) to a human display string, e.g. 12500000n -> "1.25". */
export function fromStroops(amount: bigint): string {
  const neg = amount < 0n;
  const abs = neg ? -amount : amount;
  const whole = abs / SCALE;
  const frac = abs % SCALE;
  let out = whole.toString();
  if (frac > 0n) {
    const fracStr = frac.toString().padStart(TOKEN_DECIMALS, "0").replace(/0+$/, "");
    out += "." + fracStr;
  }
  return neg ? "-" + out : out;
}

/** Convert a human amount string to stroops (bigint). Throws on bad input. */
export function toStroops(amount: string): bigint {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Invalid amount");
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > TOKEN_DECIMALS) {
    throw new Error(`Max ${TOKEN_DECIMALS} decimal places`);
  }
  const padded = (frac + "0".repeat(TOKEN_DECIMALS)).slice(0, TOKEN_DECIMALS);
  return BigInt(whole) * SCALE + BigInt(padded || "0");
}

/** Funding progress as a 0-100 percentage (clamped). */
export function progressPercent(info: Pick<CampaignInfo, "goal" | "total_raised">): number {
  if (info.goal <= 0n) return 0;
  const pct = Number((info.total_raised * 100n) / info.goal);
  return Math.max(0, Math.min(100, pct));
}

/** Seconds remaining until the deadline (0 if passed). `now` is unix seconds. */
export function secondsLeft(deadline: bigint, now: number = Math.floor(Date.now() / 1000)): number {
  const left = Number(deadline) - now;
  return left > 0 ? left : 0;
}

/** Human countdown like "3d 4h" or "Ended". */
export function formatCountdown(deadline: bigint, now?: number): string {
  const s = secondsLeft(deadline, now);
  if (s <= 0) return "Ended";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function shortAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const STATUS_STYLES: Record<Status, string> = {
  Active: "bg-blue-100 text-blue-700",
  Successful: "bg-green-100 text-green-700",
  Failed: "bg-red-100 text-red-700",
  Finalized: "bg-purple-100 text-purple-700",
};

export function statusClass(status: Status): string {
  return STATUS_STYLES[status];
}
