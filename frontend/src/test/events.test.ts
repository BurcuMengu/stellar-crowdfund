import { describe, expect, it } from "vitest";
import { eventText } from "../components/EventFeed";
import type { ContractEvent } from "../types";

const mk = (type: ContractEvent["type"], topics: any[], value: any): ContractEvent => ({
  id: "1",
  ledger: 1,
  type,
  data: { topics, value },
});

describe("eventText", () => {
  it("describes a contribution", () => {
    const e = mk("contrib", ["GABCDEFGHIJKLMNOP"], [50_0000000n, 50_0000000n]);
    expect(eventText(e)).toContain("contributed 50 USDC");
  });
  it("describes a milestone release with 1-based index", () => {
    expect(eventText(mk("release", [0], 600_0000000n))).toBe(
      "Milestone 1 released (600 USDC)",
    );
  });
  it("describes an approval", () => {
    expect(eventText(mk("approve", [1], {}))).toBe("Milestone 2 approved");
  });
  it("describes a refund", () => {
    const e = mk("refund", ["GZZZZZZZZZZZZZZZZ"], 25_0000000n);
    expect(eventText(e)).toContain("refunded 25 USDC");
  });
});
