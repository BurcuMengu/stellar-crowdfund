import { fromStroops, shortAddress } from "../lib/format";
import type { ContractEvent } from "../types";

export function eventText(e: ContractEvent): string {
  // `#[contractevent]` emits the data section as a MAP, so `value` is an object
  // keyed by the struct's non-topic field names (e.g. { amount, total_raised }).
  const { topics, value } = e.data as { topics: any[]; value: Record<string, any> };
  const v = value ?? {};
  switch (e.type) {
    case "contrib":
      return `${shortAddress(String(topics[0]))} contributed ${fromStroops(BigInt(v.amount))} USDC`;
    case "release":
      return `Milestone ${Number(topics[0]) + 1} released (${fromStroops(BigInt(v.amount))} USDC)`;
    case "approve":
      return `Milestone ${Number(topics[0]) + 1} approved`;
    case "refund":
      return `${shortAddress(String(topics[0]))} refunded ${fromStroops(BigInt(v.amount))} USDC`;
    case "created":
      return `Campaign #${Number(topics[0])} created`;
    default:
      return `Event: ${e.type}`;
  }
}

export function EventFeed({ events }: { events: ContractEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-gray-400">No activity yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {[...events].reverse().map((e) => (
        <li key={e.id} className="flex items-start gap-2 text-sm">
          <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-brand-light" />
          <span className="text-gray-700">{eventText(e)}</span>
        </li>
      ))}
    </ul>
  );
}
