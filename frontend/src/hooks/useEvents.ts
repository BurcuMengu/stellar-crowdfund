import { useEffect, useRef, useState } from "react";
import { fetchEvents } from "../lib/events";
import type { ContractEvent } from "../types";

const POLL_MS = 5000;
const MAX_EVENTS = 50;

/** Poll contract events for the given IDs every few seconds, newest last. */
export function useEvents(contractIds: string[]): ContractEvent[] {
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const cursor = useRef<number | undefined>(undefined);
  const key = contractIds.join(",");

  useEffect(() => {
    // Reset accumulated events + cursor when the watched contracts change, so
    // navigating between campaigns doesn't show a previous campaign's activity.
    setEvents([]);
    cursor.current = undefined;
    if (!key) return;
    const ids = key.split(",");
    let active = true;

    const poll = async () => {
      try {
        const page = await fetchEvents(ids, cursor.current);
        if (!active) return;
        cursor.current = page.latestLedger + 1;
        if (page.events.length) {
          setEvents((prev) => {
            const seen = new Set(prev.map((e) => e.id));
            const merged = [...prev, ...page.events.filter((e) => !seen.has(e.id))];
            return merged.slice(-MAX_EVENTS);
          });
        }
      } catch {
        /* transient RPC error — try again next tick */
      }
    };

    void poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [key]);

  return events;
}
