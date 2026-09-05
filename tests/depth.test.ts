import { describe, expect, it } from "vitest";
import {
  dexLevels,
  poolRungs,
  toDepthBook,
  type DepthOrder,
} from "../src/lib/depth";

const BID: DepthOrder = {
  status: "open",
  give_asset: "XCP",
  get_asset: "SAMPLEGAMMA",
  give_remaining_normalized: "2",
  get_remaining_normalized: "200000",
};

const ASK: DepthOrder = {
  status: "open",
  give_asset: "SAMPLEGAMMA",
  get_asset: "XCP",
  give_remaining_normalized: "100000",
  get_remaining_normalized: "1.5",
};

describe("dexLevels", () => {
  it("maps XCP-in bids to demand at XCP-per-token", () => {
    const levels = dexLevels("SAMPLEGAMMA", [BID]);
    expect(levels).toEqual([
      {
        side: "bid",
        priceXcp: 0.00001,
        tokenQty: 200000,
        xcpQty: 2,
        source: "dex",
      },
    ]);
  });

  it("maps token-in asks to supply at XCP-per-token", () => {
    const levels = dexLevels("SAMPLEGAMMA", [ASK]);
    expect(levels).toEqual([
      {
        side: "ask",
        priceXcp: 0.000015,
        tokenQty: 100000,
        xcpQty: 1.5,
        source: "dex",
      },
    ]);
  });

  it("stacks same-price DEX lots", () => {
    const extra: DepthOrder = {
      ...BID,
      give_remaining_normalized: "1",
      get_remaining_normalized: "100000",
    };
    const [level] = dexLevels("SAMPLEGAMMA", [BID, extra]);
    expect(level?.tokenQty).toBe(300000);
    expect(level?.xcpQty).toBe(3);
  });

  it("ignores filled rows and other pairs", () => {
    expect(
      dexLevels("SAMPLEGAMMA", [
        { ...BID, status: "filled" },
        { ...BID, get_asset: "PEPECASH" },
      ]),
    ).toEqual([]);
  });
});

describe("poolRungs", () => {
  it("builds incremental bid and ask rungs from TOKEN/XCP reserves", () => {
    const rungs = poolRungs(0.00001, 500);
    expect(rungs.asks.length).toBeGreaterThan(0);
    expect(rungs.bids.length).toBeGreaterThan(0);
    expect(rungs.asks.every((r) => r.side === "ask" && r.source === "pool")).toBe(
      true,
    );
    expect(rungs.bids.every((r) => r.side === "bid" && r.source === "pool")).toBe(
      true,
    );
    expect(rungs.asks[0]!.priceXcp).toBeGreaterThan(0.00001);
    expect(rungs.bids[0]!.priceXcp).toBeLessThan(0.00001);
    const askXcp = rungs.asks.reduce((s, r) => s + r.xcpQty, 0);
    expect(askXcp).toBeGreaterThan(1);
    expect(askXcp).toBeLessThan(500);
  });

  it("returns empty rungs without a live pool", () => {
    expect(poolRungs(null, 500)).toEqual({ asks: [], bids: [] });
    expect(poolRungs(0.00001, null)).toEqual({ asks: [], bids: [] });
  });
});

describe("toDepthBook", () => {
  it("lays asks above the mark and bids below, DEX then pool at a price", () => {
    const book = toDepthBook("SAMPLEGAMMA", [BID, ASK], 0.00001, 500);
    expect(book.mark).toBe(0.00001);
    expect(book.asks[0]?.priceXcp).toBeGreaterThanOrEqual(
      book.asks[book.asks.length - 1]?.priceXcp ?? 0,
    );
    expect(book.bids[0]?.priceXcp).toBeGreaterThanOrEqual(
      book.bids[book.bids.length - 1]?.priceXcp ?? 0,
    );
    expect(book.asks.some((r) => r.source === "dex" && r.priceXcp === 0.000015)).toBe(
      true,
    );
    expect(book.bids.some((r) => r.source === "dex" && r.priceXcp === 0.00001)).toBe(
      true,
    );
    expect(book.asks.some((r) => r.source === "pool")).toBe(true);
    expect(book.bestAsk).toBeLessThanOrEqual(0.000015);
    expect(book.bestBid).toBeGreaterThanOrEqual(0.00001);
  });

  it("keeps the nearest asks when the DEX ladder is long", () => {
    const farAsks: DepthOrder[] = Array.from({ length: 20 }, (_, i) => ({
      status: "open",
      give_asset: "SAMPLEGAMMA",
      get_asset: "XCP",
      give_remaining_normalized: "1000",
      get_remaining_normalized: String(1 + i),
    }));
    const near: DepthOrder = {
      status: "open",
      give_asset: "SAMPLEGAMMA",
      get_asset: "XCP",
      give_remaining_normalized: "1000",
      get_remaining_normalized: "0.02",
    };
    const book = toDepthBook("SAMPLEGAMMA", [...farAsks, near], null, null);
    expect(book.asks.some((r) => r.priceXcp === 0.00002)).toBe(true);
    expect(book.bestAsk).toBe(0.00002);
  });
});
