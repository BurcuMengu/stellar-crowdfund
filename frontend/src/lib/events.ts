import { scValToNative } from "@stellar/stellar-sdk";
import type { ContractEvent } from "../types";
import { getServer } from "./stellar";

const WINDOW = 9_000; // ledgers to look back when no cursor is given (~12h)

interface EventPage {
  events: ContractEvent[];
  latestLedger: number;
}

function decode(e: {
  id: string;
  ledger: number;
  topic: any[];
  value: any;
}): ContractEvent {
  const topics = e.topic.map((t) => scValToNative(t));
  return {
    id: e.id,
    ledger: e.ledger,
    type: topics[0] as ContractEvent["type"],
    data: { topics: topics.slice(1), value: scValToNative(e.value) },
  };
}

/**
 * Fetch contract events for the given contract IDs. Pass the previous
 * `latestLedger + 1` as `startLedger` to stream only new events.
 */
export async function fetchEvents(
  contractIds: string[],
  startLedger?: number,
): Promise<EventPage> {
  const srv = getServer();
  const latest = await srv.getLatestLedger();
  const start =
    startLedger && startLedger > 0
      ? startLedger
      : Math.max(latest.sequence - WINDOW, 1);

  try {
    const res = await srv.getEvents({
      startLedger: start,
      filters: [{ type: "contract", contractIds }],
      limit: 100,
    });
    return { events: res.events.map(decode), latestLedger: res.latestLedger };
  } catch {
    // startLedger fell outside the retention window — retry from a fresh one.
    const res = await srv.getEvents({
      startLedger: Math.max(latest.sequence - WINDOW, 1),
      filters: [{ type: "contract", contractIds }],
      limit: 100,
    });
    return { events: res.events.map(decode), latestLedger: res.latestLedger };
  }
}
