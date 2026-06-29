import { describe, expect, it } from "vitest";
import {
  formatCountdown,
  fromStroops,
  progressPercent,
  secondsLeft,
  shortAddress,
  toStroops,
} from "../lib/format";

describe("fromStroops", () => {
  it("formats whole and fractional amounts", () => {
    expect(fromStroops(0n)).toBe("0");
    expect(fromStroops(10000000n)).toBe("1");
    expect(fromStroops(12500000n)).toBe("1.25");
    expect(fromStroops(1n)).toBe("0.0000001");
  });
  it("handles negatives", () => {
    expect(fromStroops(-12500000n)).toBe("-1.25");
  });
});

describe("toStroops", () => {
  it("parses valid amounts", () => {
    expect(toStroops("1")).toBe(10000000n);
    expect(toStroops("1.25")).toBe(12500000n);
    expect(toStroops("0.0000001")).toBe(1n);
  });
  it("round-trips with fromStroops", () => {
    for (const v of ["0", "1", "1.25", "999.9999999"]) {
      expect(fromStroops(toStroops(v))).toBe(v);
    }
  });
  it("rejects bad input", () => {
    expect(() => toStroops("abc")).toThrow();
    expect(() => toStroops("1.234567890")).toThrow(); // too many decimals
    expect(() => toStroops("-5")).toThrow();
  });
});

describe("progressPercent", () => {
  it("computes and clamps", () => {
    expect(progressPercent({ goal: 1000n, total_raised: 0n })).toBe(0);
    expect(progressPercent({ goal: 1000n, total_raised: 500n })).toBe(50);
    expect(progressPercent({ goal: 1000n, total_raised: 2000n })).toBe(100);
    expect(progressPercent({ goal: 0n, total_raised: 5n })).toBe(0);
  });
});

describe("secondsLeft / formatCountdown", () => {
  it("computes remaining time", () => {
    const now = 1000;
    expect(secondsLeft(2000n, now)).toBe(1000);
    expect(secondsLeft(500n, now)).toBe(0);
  });
  it("formats countdown", () => {
    const now = 0;
    expect(formatCountdown(BigInt(2 * 86400 + 3 * 3600), now)).toBe("2d 3h");
    expect(formatCountdown(BigInt(3 * 3600 + 4 * 60), now)).toBe("3h 4m");
    expect(formatCountdown(BigInt(5 * 60), now)).toBe("5m");
    expect(formatCountdown(0n, now)).toBe("Ended");
  });
});

describe("shortAddress", () => {
  it("truncates long addresses", () => {
    expect(shortAddress("GABCDEF1234567890XYZ")).toBe("GABCDE…0XYZ");
    expect(shortAddress("short")).toBe("short");
  });
});
