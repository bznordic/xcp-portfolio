import { describe, expect, it } from "vitest";
import {
  btcSatsFromMempoolAddress,
  btcToSats,
  dispenserFloorXcpPerBtc,
  feeSatsBurned,
  liquidationSats,
  netSatsAfterFees,
  satsToUsd,
  toAggregateFiat,
  xcpToSats,
} from "../src/lib/fx";

describe("dispenserFloorXcpPerBtc", () => {
  it("takes the cheapest open XCP dispenser satoshirate (xcp.fun floor)", () => {
    const floor = dispenserFloorXcpPerBtc([
      { status: 0, satoshirate: 5700, give_remaining: 100_000_000, give_quantity: 100_000_000 },
      { status: 0, satoshirate: 5699, give_remaining: 100_000_000, give_quantity: 100_000_000 },
      { status: 0, satoshirate: 5900, give_remaining: 0, give_quantity: 100_000_000 },
    ]);
    expect(floor).toBeCloseTo(0.00005699, 10);
  });

  it("ignores 1-sat dust lots that are not 1 XCP vends", () => {
    const floor = dispenserFloorXcpPerBtc([
      { status: 0, satoshirate: 1, give_remaining: 97_897_270, give_quantity: 1581 },
      { status: 0, satoshirate: 5000, give_remaining: 50_000_002, give_quantity: 50_000_002 },
      { status: 0, satoshirate: 5700, give_remaining: 100_000_000, give_quantity: 100_000_000 },
    ]);
    expect(floor).toBeCloseTo(0.000057, 10);
  });

  it("skips a 1 XCP vend isolated far below the rest of the book", () => {
    const floor = dispenserFloorXcpPerBtc([
      { status: 0, satoshirate: 888, give_remaining: 200_000_000, give_quantity: 100_000_000 },
      { status: 0, satoshirate: 9600, give_remaining: 5_500_000_000, give_quantity: 100_000_000 },
      { status: 0, satoshirate: 9650, give_remaining: 16_400_000_000, give_quantity: 100_000_000 },
      { status: 0, satoshirate: 9700, give_remaining: 4_700_000_000, give_quantity: 100_000_000 },
    ]);
    expect(floor).toBeCloseTo(0.000096, 10);
  });
});

describe("toAggregateFiat", () => {
  it("marks 20 XCP at 5699 sats and live BTC/USD", () => {
    const a = toAggregateFiat(20, {
      xcpPerBtc: 0.00005699,
      usdPerBtc: 79_800,
    });
    expect(a.btc).toBeCloseTo(20 * 0.00005699, 8);
    expect(a.usd).toBeCloseTo(20 * 0.00005699 * 79_800, 2);
    expect(a.usd).toBeGreaterThan(90);
  });
});

describe("paid-in vs liquidation", () => {
  const paidIn = 100_000;
  const live = 50_000;
  const fx = { xcpPerBtc: 0.00005699, usdPerBtc: 79_800 };

  it("treats 0.001 BTC as 100,000 sats", () => {
    expect(btcToSats(0.001)).toBe(100_000);
  });

  it("converts leftover wallet BTC and book XCP to sats at today's floor", () => {
    expect(btcToSats(0.0005)).toBe(50_000);
    expect(xcpToSats(20, fx)).toBe(113_980);
  });

  it("reads confirmed plus mempool BTC from a mempool.space address payload", () => {
    expect(
      btcSatsFromMempoolAddress({
        chain_stats: { funded_txo_sum: 80_000, spent_txo_sum: 30_000 },
        mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0 },
      }),
    ).toBe(50_000);
    expect(
      btcSatsFromMempoolAddress({
        chain_stats: { funded_txo_sum: 50_000, spent_txo_sum: 0 },
        mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 500 },
      }),
    ).toBe(49_500);
  });

  it("aggregates wallet BTC plus book XCP at today's BTC price", () => {
    expect(
      liquidationSats({ liveBtcSats: live, xcp: 20, fx }),
    ).toBe(50_000 + 113_980);
    expect(feeSatsBurned(paidIn, live)).toBe(50_000);
    expect(
      netSatsAfterFees({
        liveBtcSats: live,
        xcp: 20,
        fx,
        startBtcSats: paidIn,
      }),
    ).toBe(50_000 + 113_980 - 100_000);
  });

  it("marks the whole wallet in today's fiat from those sats", () => {
    const sold = liquidationSats({ liveBtcSats: live, xcp: 20, fx });
    const vsPaidIn = sold - paidIn;
    expect(satsToUsd(sold, fx.usdPerBtc)).toBeCloseTo(
      (50_000 + 113_980) / 1e8 * 79_800,
      2,
    );
    expect(satsToUsd(vsPaidIn, fx.usdPerBtc)).toBeCloseTo(
      (50_000 + 113_980 - 100_000) / 1e8 * 79_800,
      2,
    );
  });
});
