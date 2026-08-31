import { describe, expect, it } from "vitest";
import { type Position } from "../src/data/fixture";
import type { Launch } from "../src/lib/setups";
import { MINT_PRICE } from "../src/lib/xcp69";
import {
  SAMPLE_FILLS as FILLS,
  SAMPLE_POSITIONS as POSITIONS,
  SAMPLE_UNIVERSE as UNIVERSE_FIXTURE,
} from "./sample-desk";
import {
  applyCostOverrides,
  applyRemainingCost,
  applyLiveHoldings,
  applyLiveLaunchMarks,
  applyLiveMarks,
  archivedTokenNames,
  extraTokenPositions,
  escrowFills,
  escrowPositionsFromFairmints,
  holdingQuote,
  vsMintLabel,
  liveEquityWindow,
  mintPriceXcpFor,
  mintLoseFills,
  mergeBook,
  orderToFill,
  realizedFromFills,
  remainingCostByAsset,
  tokenLedger,
  mergeTape,
  overlayEscrows,
  overlayHoldings,
  toEscrowPosition,
  tradingPnlXcp,
  type CoreFairmint,
} from "../src/lib/book";

const WILLITSTICK: CoreFairmint = {
  asset: "WILLITSTICK",
  status: "valid",
  paid_quantity_normalized: "1.00000000",
  earn_quantity_normalized: "100000.00000000",
  block_index: 964410,
  tx_hash: "44db17f32dbbd017b5e9770633bf30bc7c4311058a6d9af497984826b5fcea3c",
};

const NAKAMOTOFUN: CoreFairmint = {
  asset: "NAKAMOTOFUN",
  status: "valid",
  paid_quantity_normalized: "1.00000000",
  earn_quantity_normalized: "100000.00000000",
  block_index: 964407,
  tx_hash: "2e957aeda9e93a4298585c3f80b10d55ace32c68253578c017c4a18edccd672f",
};

const LEECHES: CoreFairmint = {
  asset: "LEECHES",
  status: "valid",
  paid_quantity_normalized: "1.00000000",
  earn_quantity_normalized: "100000.00000000",
  block_index: 964458,
  tx_hash: "leeches-mint",
};

const SAMPLEESCROW: CoreFairmint = {
  asset: "SAMPLEESCROW",
  status: "valid",
  paid_quantity_normalized: "2.00000000",
  earn_quantity_normalized: "200000.00000000",
  block_index: 964400,
  tx_hash: "44ee3cadd5f96e4d1c79c1a84c04882dead62d93f7fc09d9b0529a9ecd190bff",
};

describe("toEscrowPosition", () => {
  it("marks an open mint at XCP paid, not mint price", () => {
    const pos = toEscrowPosition(WILLITSTICK);
    expect(pos.kind).toBe("escrow");
    expect(pos.asset).toBe("WILLITSTICK");
    expect(pos.qty).toBe(100000);
    expect(pos.markXcp).toBe(1);
    expect(pos.costXcp).toBe(1);
    expect(pos.pnlXcp).toBe(0);
    expect(pos.pnlPct).toBe(0);
  });
});

describe("escrowPositionsFromFairmints", () => {
  it("keeps valid mints that are not already a token position", () => {
    const tokenAssets = new Set(["SAMPLEALPHA", "SAMPLEGAMMA"]);
    const rows = escrowPositionsFromFairmints(
      [WILLITSTICK, NAKAMOTOFUN, SAMPLEESCROW],
      tokenAssets,
    );
    expect(rows.map((p) => p.asset).sort()).toEqual(
      ["NAKAMOTOFUN", "SAMPLEESCROW", "WILLITSTICK"].sort(),
    );
    expect(rows.every((p) => p.kind === "escrow")).toBe(true);
    expect(rows.reduce((s, p) => s + p.markXcp, 0)).toBe(4);
  });

  it("drops a mint once that name is already a token", () => {
    const rows = escrowPositionsFromFairmints(
      [WILLITSTICK],
      new Set(["WILLITSTICK"]),
    );
    expect(rows).toEqual([]);
  });

  it("drops a closed minter so the XCP refund is not double-counted", () => {
    const rows = escrowPositionsFromFairmints(
      [LEECHES, WILLITSTICK],
      new Set(),
      {
        LEECHES: { status: "closed", block_index: 964526 },
        WILLITSTICK: { status: "open" },
      },
    );
    expect(rows.map((p) => p.asset)).toEqual(["WILLITSTICK"]);
  });

  it("ignores invalid mint rows", () => {
    const rows = escrowPositionsFromFairmints(
      [{ ...WILLITSTICK, status: "invalid" }],
      new Set(),
    );
    expect(rows).toEqual([]);
  });
});

describe("mergeBook", () => {
  it("replaces fixture escrow with live mints and live cash", () => {
    const escrows = escrowPositionsFromFairmints(
      [WILLITSTICK, NAKAMOTOFUN, SAMPLEESCROW],
      new Set(),
    );
    const book = mergeBook(POSITIONS, escrows, 10);
    expect(book.filter((p) => p.kind === "escrow").map((p) => p.asset).sort()).toEqual(
      ["NAKAMOTOFUN", "SAMPLEESCROW", "WILLITSTICK"].sort(),
    );
    expect(book.find((p) => p.kind === "cash")?.markXcp).toBe(10);
    expect(book.some((p) => p.asset === "SAMPLEGAMMA" && p.kind === "token")).toBe(true);
  });

  it("books PEPECASH from a Core TOKEN/XCP mark, not only XCP-69 names", () => {
    const extra = extraTokenPositions(
      [{ asset: "PEPECASH", qty: 400 }],
      new Set(["SAMPLEGAMMA"]),
      { PEPECASH: 67065655475 / 42941031344044 },
      { PEPECASH: 0.7 },
    );
    expect(extra).toHaveLength(1);
    expect(extra[0]?.asset).toBe("PEPECASH");
    expect(extra[0]?.costXcp).toBe(0.7);
    expect(extra[0]?.markXcp).toBeCloseTo(
      400 * (67065655475 / 42941031344044),
      6,
    );
  });

  it("adds a live token that the snapshot book missed", () => {
    const extra = extraTokenPositions(
      [{ asset: "SAMPLEDEEP", qty: 16_000 }],
      new Set(["SAMPLEGAMMA", "SAMPLEDELTA"]),
      { SAMPLEDEEP: 0.000122316219984606 },
    );
    expect(extra).toHaveLength(1);
    expect(extra[0]?.asset).toBe("SAMPLEDEEP");
    expect(extra[0]?.kind).toBe("token");
    expect(extra[0]?.markXcp).toBeCloseTo(1.957, 3);
    const book = mergeBook(POSITIONS, [], 10, extra);
    expect(book.some((p) => p.asset === "SAMPLEDEEP" && p.kind === "token")).toBe(
      true,
    );
  });

  it("books SAMPLEDEEP at the 2 XCP fill, not at mark", () => {
    const extra = extraTokenPositions(
      [{ asset: "SAMPLEDEEP", qty: 16_000 }],
      new Set(),
      { SAMPLEDEEP: 0.0001297605 },
      { SAMPLEDEEP: 2 },
    );
    expect(extra[0]?.costXcp).toBe(2);
    expect(extra[0]?.markXcp).toBeCloseTo(16_000 * 0.0001297605, 4);
    expect(extra[0]?.pnlXcp).toBeCloseTo(extra[0]!.markXcp - 2, 4);
    expect(extra[0]?.pnlPct).toBeCloseTo(
      ((extra[0]!.markXcp - 2) / 2) * 100,
      4,
    );
  });

  it("does not duplicate a token already on the book", () => {
    expect(
      extraTokenPositions(
        [{ asset: "SAMPLEGAMMA", qty: 50_000 }],
        new Set(["SAMPLEGAMMA"]),
        { SAMPLEGAMMA: 0.00001864 },
      ),
    ).toEqual([]);
  });

  it("still books SAMPLEDEEP when the TOKEN/XCP mark fetch missed", () => {
    const extra = extraTokenPositions(
      [{ asset: "SAMPLEDEEP", qty: 16_000 }],
      new Set(["SAMPLEGAMMA", "SAMPLEDELTA"]),
      {},
      { SAMPLEDEEP: 2 },
    );
    expect(extra).toHaveLength(1);
    expect(extra[0]?.asset).toBe("SAMPLEDEEP");
    expect(extra[0]?.qty).toBeCloseTo(16_000, 6);
    expect(extra[0]?.priceXcp).toBeNull();
    expect(extra[0]?.markXcp).toBe(0);
    expect(extra[0]?.costXcp).toBe(2);
    const book = mergeBook(POSITIONS, [], 0.01, extra);
    expect(book.some((p) => p.asset === "SAMPLEDEEP" && p.kind === "token")).toBe(
      true,
    );
  });

  it("fills SAMPLEDEEP's mark later without dropping the row", () => {
    const extra = extraTokenPositions(
      [{ asset: "SAMPLEDEEP", qty: 16_000 }],
      new Set(["SAMPLEGAMMA"]),
      {},
      { SAMPLEDEEP: 2 },
    );
    const marked = applyLiveMarks(mergeBook(POSITIONS, [], 0.01, extra), {
      SAMPLEDEEP: 0.00014535,
    });
    const row = marked.find((p) => p.asset === "SAMPLEDEEP");
    expect(row?.markXcp).toBeCloseTo(16_000 * 0.00014535, 4);
    expect(row?.priceXcp).toBeCloseTo(0.00014535, 8);
  });
});

describe("remainingCostByAsset", () => {
  it("withdraws a NAKAMOTOFUN sale from remaining investment", () => {
    const remaining = remainingCostByAsset([
      {
        id: "mint-1",
        block: 1,
        time: "",
        action: "mint_escrow",
        asset: "NAKAMOTOFUN",
        detail: "",
        xcp: -1,
      },
      {
        id: "mint-3",
        block: 2,
        time: "",
        action: "mint_escrow",
        asset: "NAKAMOTOFUN",
        detail: "",
        xcp: -3,
      },
      {
        id: "sell",
        block: 3,
        time: "",
        action: "sell",
        asset: "NAKAMOTOFUN",
        detail: "",
        xcp: 3,
      },
    ]);
    expect(remaining.NAKAMOTOFUN).toBeCloseTo(1, 8);
  });

  it("zeroes leftover cost once sale proceeds cover what was paid", () => {
    const remaining = remainingCostByAsset([
      {
        id: "mint",
        block: 1,
        time: "",
        action: "mint_escrow",
        asset: "NAKAMOTOFUN",
        detail: "",
        xcp: -1,
      },
      {
        id: "sell",
        block: 2,
        time: "",
        action: "sell",
        asset: "NAKAMOTOFUN",
        detail: "",
        xcp: 2,
      },
    ]);
    expect(remaining.NAKAMOTOFUN).toBe(0);
    expect(realizedFromFills([
      {
        id: "mint",
        block: 1,
        time: "",
        action: "mint_escrow",
        asset: "NAKAMOTOFUN",
        detail: "",
        xcp: -1,
      },
      {
        id: "sell",
        block: 2,
        time: "",
        action: "sell",
        asset: "NAKAMOTOFUN",
        detail: "",
        xcp: 2,
      },
    ])).toBe(1);
  });
});

describe("orderToFill", () => {
  it("maps a filled TOKEN→XCP order to a sell", () => {
    const fill = orderToFill({
      tx_hash: "sell-naka",
      block_index: 964603,
      status: "filled",
      give_asset: "NAKAMOTOFUN",
      get_asset: "XCP",
      give_quantity_normalized: "200000.00000000",
      get_quantity_normalized: "3.00000000",
    });
    expect(fill).toMatchObject({
      action: "sell",
      asset: "NAKAMOTOFUN",
      xcp: 3,
    });
  });

  it("maps a filled XCP→TOKEN order to a buy", () => {
    const fill = orderToFill({
      tx_hash: "buy-gamma",
      block_index: 964400,
      status: "filled",
      give_asset: "XCP",
      get_asset: "SAMPLEGAMMA",
      give_quantity_normalized: "1.00000000",
      get_quantity_normalized: "50000.00000000",
    });
    expect(fill).toMatchObject({ action: "buy", asset: "SAMPLEGAMMA", xcp: -1 });
  });

  it("ignores open orders", () => {
    expect(
      orderToFill({
        status: "open",
        give_asset: "NAKAMOTOFUN",
        get_asset: "XCP",
        get_quantity_normalized: "2",
      }),
    ).toBeNull();
  });
});

describe("tokenLedger", () => {
  it("runs NAKAMOTOFUN mint, mint, sale to leftover qty and XCP still in", () => {
    const rows = tokenLedger(
      [
        {
          id: "mint-1",
          block: 964407,
          time: "",
          action: "mint_escrow",
          asset: "NAKAMOTOFUN",
          detail: "",
          xcp: -1,
          qty: 100000,
        },
        {
          id: "mint-3",
          block: 964583,
          time: "",
          action: "mint_escrow",
          asset: "NAKAMOTOFUN",
          detail: "",
          xcp: -3,
          qty: 300000,
        },
        {
          id: "sell",
          block: 964603,
          time: "",
          action: "sell",
          asset: "NAKAMOTOFUN",
          detail: "",
          xcp: 3,
          qty: 200000,
        },
      ],
      "NAKAMOTOFUN",
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      qtyDelta: 100000,
      qtyAfter: 100000,
      investedAfter: 1,
    });
    expect(rows[1]).toMatchObject({
      qtyDelta: 300000,
      qtyAfter: 400000,
      investedAfter: 4,
    });
    expect(rows[2]?.qtyDelta).toBe(-200000);
    expect(rows[2]?.qtyAfter).toBe(200000);
    expect(rows[2]?.investedAfter).toBeCloseTo(1, 8);
    expect(rows[2]?.paidPriceAfter).toBeCloseTo(1 / 200000, 12);
  });

  it("ignores other names", () => {
    expect(
      tokenLedger(
        [
          {
            id: "gamma-buy",
            block: 1,
            time: "",
            action: "buy",
            asset: "SAMPLEGAMMA",
            detail: "",
            xcp: -1,
            qty: 50000,
          },
        ],
        "NAKAMOTOFUN",
      ),
    ).toEqual([]);
  });
});

describe("applyRemainingCost", () => {
  it("sets leftover NAKAMOTOFUN cost to paid minus sale proceeds", () => {
    const pos: Position = {
      asset: "NAKAMOTOFUN",
      kind: "token",
      qty: 200000,
      priceXcp: 0.00001,
      markXcp: 2,
      costXcp: 4,
      pnlXcp: -2,
      pnlPct: -50,
    };
    const [next] = applyRemainingCost([pos], { NAKAMOTOFUN: 1 });
    expect(next?.costXcp).toBeCloseTo(1, 8);
    expect(next?.pnlXcp).toBeCloseTo(1, 8);
  });
});

describe("applyCostOverrides", () => {
  it("overwrites SAMPLEDEEP fill cost and recomputes ROI", () => {
    const pos: Position = {
      asset: "SAMPLEDEEP",
      kind: "token",
      qty: 16_000,
      priceXcp: 0.00012976,
      markXcp: 2.0821,
      costXcp: 2.0821,
      pnlXcp: 0,
      pnlPct: 0,
    };
    const [next] = applyCostOverrides([pos], { SAMPLEDEEP: 2 });
    expect(next?.costXcp).toBe(2);
    expect(next?.markXcp).toBe(2.0821);
    expect(next?.pnlXcp).toBeCloseTo(0.0821, 4);
    expect(next?.pnlPct).toBeCloseTo(4.105, 3);
  });

  it("leaves names without an override unchanged", () => {
    const gooby = POSITIONS.find((p) => p.asset === "SAMPLEGAMMA")!;
    expect(applyCostOverrides([gooby], {})).toEqual([gooby]);
  });
});

describe("applyLiveHoldings", () => {
  it("replaces fixture SAMPLEDELTA qty after a sell and scales remaining cost", () => {
    const fun = POSITIONS.find((p) => p.asset === "SAMPLEDELTA")!;
    const liveQty = 10_000;
    const [next] = applyLiveHoldings([fun], { SAMPLEDELTA: liveQty });
    expect(next?.qty).toBe(liveQty);
    expect(next?.costXcp).toBeCloseTo(fun.costXcp * (liveQty / fun.qty), 10);
    expect(next?.qty).not.toBe(fun.qty);
  });

  it("drops a token whose qty displays as 0.00", () => {
    const fun = POSITIONS.find((p) => p.asset === "SAMPLEDELTA")!;
    expect(applyLiveHoldings([fun], { SAMPLEDELTA: 0.001 })).toEqual([]);
  });

  it("drops a fixture token when the live balance is gone", () => {
    const fun = POSITIONS.find((p) => p.asset === "SAMPLEDELTA")!;
    expect(applyLiveHoldings([fun], { SAMPLEDELTA: 0 })).toEqual([]);
    expect(applyLiveHoldings([fun], {})).toEqual([]);
  });

  it("leaves the recorded book when live balances have not arrived", () => {
    const fun = POSITIONS.find((p) => p.asset === "SAMPLEDELTA")!;
    expect(applyLiveHoldings([fun], null)).toEqual([fun]);
  });
});

describe("archivedTokenNames", () => {
  it("archives names whose live qty displays as 0.00", () => {
    expect(
      archivedTokenNames(["SAMPLEDELTA", "SAMPLEGAMMA"], {
        SAMPLEDELTA: 0.001,
        SAMPLEGAMMA: 50_000,
      }),
    ).toEqual(["SAMPLEDELTA"]);
  });
});

describe("holdingQuote", () => {
  it("shows bag value, live market, paid price, and ROI in XCP", () => {
    const gooby = POSITIONS.find((p) => p.asset === "SAMPLEGAMMA")!;
    const q = holdingQuote(gooby);
    expect(q.valueXcp).toBe(gooby.markXcp);
    expect(q.marketPriceXcp).toBe(gooby.priceXcp);
    expect(q.purchasePriceXcp).toBeCloseTo(gooby.costXcp / gooby.qty, 12);
    expect(q.roiXcp).toBe(gooby.pnlXcp);
    expect(q.roiPct).toBe(gooby.pnlPct);
  });

  it("leaves purchase price empty when qty is zero", () => {
    const q = holdingQuote({
      asset: "EMPTY",
      kind: "token",
      qty: 0,
      priceXcp: 0.00002,
      markXcp: 0,
      costXcp: 1,
      pnlXcp: -1,
      pnlPct: -100,
    });
    expect(q.purchasePriceXcp).toBeNull();
    expect(q.roiXcp).toBe(-1);
  });

  it("quotes vs mint as a 1 XCP mint, not the bag", () => {
    const gooby = POSITIONS.find((p) => p.asset === "SAMPLEGAMMA")!;
    const q = holdingQuote(gooby, MINT_PRICE);
    const multiple = gooby.priceXcp! / MINT_PRICE - 1;
    expect(q.mintPriceXcp).toBe(MINT_PRICE);
    expect(q.vsMintXcp).toBeCloseTo(multiple, 12);
    expect(q.vsMintPct).toBeCloseTo(multiple * 100, 12);
    expect(q.vsMintXcp).not.toBeCloseTo(
      gooby.qty * (gooby.priceXcp! - MINT_PRICE),
      4,
    );
    expect(q.roiXcp).toBe(gooby.pnlXcp);
    const smaller = holdingQuote({ ...gooby, qty: gooby.qty / 2 }, MINT_PRICE);
    expect(smaller.vsMintXcp).toBeCloseTo(q.vsMintXcp!, 12);
    expect(smaller.vsMintPct).toBeCloseTo(q.vsMintPct!, 12);
  });

  it("labels vs mint as an XCP multiple, not USD since mint", () => {
    expect(vsMintLabel(0.00015222, MINT_PRICE)).toBe("15.22× · +1422.20%");
  });

  it("hides vs mint when there is no XCP-69 mint", () => {
    const gooby = POSITIONS.find((p) => p.asset === "SAMPLEGAMMA")!;
    const q = holdingQuote(gooby, null);
    expect(q.mintPriceXcp).toBeNull();
    expect(q.vsMintXcp).toBeNull();
    expect(q.vsMintPct).toBeNull();
  });

  it("shows mint price on escrow but not vs-mint performance", () => {
    const escrow = POSITIONS.find((p) => p.asset === "SAMPLEESCROW")!;
    const q = holdingQuote(escrow, MINT_PRICE);
    expect(q.mintPriceXcp).toBe(MINT_PRICE);
    expect(q.vsMintXcp).toBeNull();
    expect(q.vsMintPct).toBeNull();
  });
});

describe("mintPriceXcpFor", () => {
  it("uses the XCP-69 mint on graduated and minting names", () => {
    const gooby = POSITIONS.find((p) => p.asset === "SAMPLEGAMMA")!;
    const launch = UNIVERSE_FIXTURE.find((l) => l.asset === "SAMPLEGAMMA");
    expect(mintPriceXcpFor(gooby, launch)).toBe(MINT_PRICE);
  });

  it("uses the XCP-69 mint on a listed name even if you never minted", () => {
    const pos: Position = {
      asset: "NAKAMOTOFUN",
      kind: "token",
      qty: 200000,
      priceXcp: 0.000015,
      markXcp: 3,
      costXcp: 1,
      pnlXcp: 2,
      pnlPct: 200,
    };
    const listed: Launch = {
      asset: "NAKAMOTOFUN",
      status: "listed",
      mark: 0.000015,
      poolXcp: 10,
      fill: null,
      blocksLeft: null,
      blocksSinceOpen: null,
      issuer: "unknown",
      you: "held",
      youSleeveWt: 0,
      youMintPaidXcp: 0,
    };
    expect(mintPriceXcpFor(pos, listed, true)).toBe(MINT_PRICE);
    expect(mintPriceXcpFor(pos, undefined, true)).toBe(MINT_PRICE);
    expect(mintPriceXcpFor(pos, listed, false)).toBeNull();
  });

  it("has no mint on a listed Core pool", () => {
    const gooby = POSITIONS.find((p) => p.asset === "SAMPLEGAMMA")!;
    expect(
      mintPriceXcpFor(gooby, {
        asset: "SAMPLEGAMMA",
        status: "listed",
        mark: 0.0000186,
        poolXcp: 600,
        fill: null,
        blocksLeft: null,
        blocksSinceOpen: null,
        issuer: "unknown",
        you: "held",
        youSleeveWt: 0,
        youMintPaidXcp: 0,
      }),
    ).toBeNull();
  });

  it("uses mint on escrow even without a launch row", () => {
    const escrow = POSITIONS.find((p) => p.asset === "SAMPLEESCROW")!;
    expect(mintPriceXcpFor(escrow, undefined)).toBe(MINT_PRICE);
  });
});

describe("applyLiveMarks", () => {
  it("reprices a fixture token from the live pool and keeps cost", () => {
    const gooby = POSITIONS.find((p) => p.asset === "SAMPLEGAMMA")!;
    const [next] = applyLiveMarks([gooby], { SAMPLEGAMMA: 0.00002 });
    expect(next?.costXcp).toBe(gooby.costXcp);
    expect(next?.priceXcp).toBe(0.00002);
    expect(next?.markXcp).toBeCloseTo(gooby.qty * 0.00002, 6);
    expect(next?.pnlXcp).toBeCloseTo(next!.markXcp - gooby.costXcp, 6);
  });
});

describe("applyLiveLaunchMarks", () => {
  it("overwrites the recorded SAMPLEGAMMA mark with a live pool", () => {
    const next = applyLiveLaunchMarks(UNIVERSE_FIXTURE, {
      SAMPLEGAMMA: { priceXcp: 0.00001929, poolXcp: 644.35, block: 964444 },
    });
    const gooby = next.find((l) => l.asset === "SAMPLEGAMMA");
    expect(gooby?.mark).toBeCloseTo(0.00001929, 8);
    expect(gooby?.poolXcp).toBeCloseTo(644.35, 2);
    const fixture = UNIVERSE_FIXTURE.find((l) => l.asset === "SAMPLEGAMMA");
    expect(gooby?.mark).not.toBe(fixture?.mark);
  });

  it("leaves names without a live pool on the recorded mark", () => {
    const next = applyLiveLaunchMarks(UNIVERSE_FIXTURE, {});
    expect(next.find((l) => l.asset === "SAMPLEGAMMA")?.mark).toBe(0.00001864);
  });
});

describe("tradingPnlXcp", () => {
  it("counts token uPnL plus realized, not bag growth vs a 20 XCP start", () => {
    const pnl = tradingPnlXcp(
      [
        {
          asset: "XCP",
          kind: "cash",
          qty: 8.7,
          priceXcp: 1,
          markXcp: 8.7,
          costXcp: 8.7,
          pnlXcp: 0,
          pnlPct: 0,
        },
        {
          asset: "SAMPLEDEEP",
          kind: "token",
          qty: 1,
          priceXcp: 2.08,
          markXcp: 2.08,
          costXcp: 2.08,
          pnlXcp: 0,
          pnlPct: 0,
        },
        {
          asset: "SAMPLEALPHA",
          kind: "token",
          qty: 1,
          priceXcp: 0.00001,
          markXcp: 2.07,
          costXcp: 2,
          pnlXcp: 0.07,
          pnlPct: 3.5,
        },
        {
          asset: "HOTEXIT",
          kind: "escrow",
          qty: 200000,
          priceXcp: 0.00001,
          markXcp: 10,
          costXcp: 10,
          pnlXcp: 0,
          pnlPct: 0,
        },
      ],
      0.45,
    );
    expect(pnl).toBeCloseTo(0.52, 8);
  });
});

describe("liveEquityWindow", () => {
  it("moves the last curve point to live equity and keeps trading P&L", () => {
    const window = liveEquityWindow(
      {
        pnlXcp: 0.7813,
        startMark: 20,
        label: "vs 20 XCP start",
        curve: [
          { day: "open", markXcp: 20 },
          { day: "now", markXcp: 20.7813 },
        ],
      },
      24.85,
      0.49,
    );
    expect(window.pnlXcp).toBeCloseTo(0.49, 8);
    expect(window.curve.at(-1)?.markXcp).toBe(24.85);
    expect(window.curve[0]?.markXcp).toBe(20);
    expect(window.label).toBe("vs cost");
  });
});

describe("overlayHoldings", () => {
  it("marks SAMPLEDEEP held and sets sleeve weight from token marks", () => {
    const extra = extraTokenPositions(
      [{ asset: "SAMPLEDEEP", qty: 16_000 }],
      new Set(),
      { SAMPLEDEEP: 0.000122316219984606 },
    );
    const launches = overlayHoldings(UNIVERSE_FIXTURE, extra);
    const row = launches.find((l) => l.asset === "SAMPLEDEEP");
    expect(row?.you).toBe("held");
    expect(row?.youSleeveWt).toBeGreaterThan(0.2);
  });
});

describe("overlayEscrows", () => {
  it("tags fixture SAMPLEESCROW as escrow and adds missing mint names", () => {
    const escrows = escrowPositionsFromFairmints(
      [WILLITSTICK, NAKAMOTOFUN, SAMPLEESCROW],
      new Set(),
    );
    const launches = overlayEscrows(UNIVERSE_FIXTURE, escrows);
    expect(launches.find((l) => l.asset === "SAMPLEESCROW")?.you).toBe("escrow");
    expect(launches.find((l) => l.asset === "SAMPLEESCROW")?.youMintPaidXcp).toBe(2);
    expect(launches.find((l) => l.asset === "WILLITSTICK")).toMatchObject({
      status: "minting",
      you: "escrow",
      youMintPaidXcp: 1,
    });
    expect(launches.find((l) => l.asset === "NAKAMOTOFUN")?.you).toBe("escrow");
  });
});

describe("escrowFills", () => {
  it("adds a tape row at XCP paid", () => {
    const [fill] = escrowFills([WILLITSTICK]);
    expect(fill?.action).toBe("mint_escrow");
    expect(fill?.asset).toBe("WILLITSTICK");
    expect(fill?.xcp).toBe(-1);
    expect(fill?.block).toBe(964410);
  });
});

describe("mintLoseFills", () => {
  it("credits the refund when the minter closes and you hold no tokens", () => {
    const [fill] = mintLoseFills(
      [LEECHES],
      { LEECHES: { status: "closed", block_index: 964526, end_block: 0 } },
      new Set(),
    );
    expect(fill?.action).toBe("mint_lose");
    expect(fill?.asset).toBe("LEECHES");
    expect(fill?.xcp).toBe(1);
    expect(fill?.block).toBe(964526);
    expect(fill?.detail).toMatch(/mint lost/);
  });

  it("does not treat a graduated mint as a lose", () => {
    expect(
      mintLoseFills(
        [SAMPLEESCROW],
        { SAMPLEESCROW: { status: "closed", block_index: 964500 } },
        new Set(["SAMPLEESCROW"]),
      ),
    ).toEqual([]);
  });
});

describe("mergeTape", () => {
  it("still appends a mint lose when the fixture already has that mint escrow", () => {
    const lose = mintLoseFills(
      [SAMPLEESCROW],
      { SAMPLEESCROW: { status: "closed", block_index: 964526 } },
      new Set(),
    );
    const tape = mergeTape(FILLS, [...escrowFills([SAMPLEESCROW]), ...lose]);
    expect(
      tape.filter((f) => f.asset === "SAMPLEESCROW").map((f) => f.action),
    ).toEqual(["mint_escrow", "mint_lose"]);
  });
});
