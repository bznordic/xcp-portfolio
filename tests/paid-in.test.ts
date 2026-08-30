import { describe, expect, it } from "vitest";
import {
  fmtPaidInBtc,
  paidInKey,
  parsePaidInStored,
  parsePaidInToSats,
  resolvedStartBtcSats,
} from "../src/lib/paidIn";

describe("parsePaidInToSats", () => {
  it("reads 0.001 BTC and comma decimals", () => {
    expect(parsePaidInToSats("0.00100000")).toBe(100_000);
    expect(parsePaidInToSats("0,00100000")).toBe(100_000);
    expect(parsePaidInToSats("  0.00100000 BTC ")).toBe(100_000);
  });

  it("reads a sat integer and grouped thousands", () => {
    expect(parsePaidInToSats("100000")).toBe(100_000);
    expect(parsePaidInToSats("100,000")).toBe(100_000);
  });

  it("treats empty as unset and rejects junk", () => {
    expect(parsePaidInToSats("")).toBeNull();
    expect(parsePaidInToSats("   ")).toBeNull();
    expect(parsePaidInToSats("nope")).toBeNull();
    expect(parsePaidInToSats("-1")).toBeNull();
  });

  it("round-trips sats through the BTC field format", () => {
    expect(parsePaidInToSats(fmtPaidInBtc(100_000))).toBe(100_000);
    expect(fmtPaidInBtc(50_000)).toBe("0.00050000");
  });
});

describe("resolvedStartBtcSats", () => {
  it("defaults to the monitored wallet UTXO when unpaid-in", () => {
    expect(resolvedStartBtcSats(null, 50_000)).toBe(50_000);
    expect(resolvedStartBtcSats(null, null)).toBeNull();
  });

  it("keeps an explicit paid-in stack over leftover BTC", () => {
    expect(resolvedStartBtcSats(100_000, 50_000)).toBe(100_000);
  });
});

describe("paid-in storage", () => {
  it("keys per address and parses stored sats", () => {
    expect(paidInKey("bc1pabc")).toBe("xcp-book:paid-in:bc1pabc");
    expect(parsePaidInStored("100000")).toBe(100_000);
    expect(parsePaidInStored(null)).toBeNull();
    expect(parsePaidInStored("{")).toBeNull();
  });
});
