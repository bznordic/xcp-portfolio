import { describe, expect, it } from "vitest";
import { describe, expect, it } from "vitest";
import { QUOTE_STRIP, quotesFor } from "../src/data/universe-fixture";
import { rankSetups } from "../src/lib/setups";
import { impactCell, matchesScan } from "../src/screens/MarketsScreen";
import {
  SAMPLE_CASH_XCP as CASH_XCP,
  SAMPLE_IMPACT_BY_ASSET as IMPACT_BY_ASSET,
  SAMPLE_TIP_BLOCK as TIP_BLOCK,
  SAMPLE_UNIVERSE as UNIVERSE_FIXTURE,
} from "./sample-desk";

describe("universe fixture + desk wiring", () => {
  it("records the eight 28 Aug 2026 names", () => {
    expect(UNIVERSE_FIXTURE.map((l) => l.asset)).toEqual([
      "SAMPLEDEEP",
      "SAMPLEPEER",
      "SAMPLESIBLING",
      "SAMPLEGAMMA",
      "SAMPLEDELTA",
      "SAMPLEBETA",
      "SAMPLEALPHA",
      "SAMPLEESCROW",
    ]);
    expect(UNIVERSE_FIXTURE.find((l) => l.asset === "SAMPLEESCROW")?.status).toBe(
      "minting",
    );
    expect(CASH_XCP).toBe(14);
    expect(TIP_BLOCK).toBe(964404);
  });

  it("reuses the 0.5/1/2 XCP quote strip", () => {
    expect(QUOTE_STRIP.map((q) => [q.xcpIn, q.impact])).toEqual([
      [0.5, 0.02],
      [1, 0.04],
      [2, 0.08],
    ]);
    expect(quotesFor("SAMPLEGAMMA")[1]?.impact).toBe(0.04);
    const gooby = quotesFor(
      "SAMPLEGAMMA",
      UNIVERSE_FIXTURE.find((l) => l.asset === "SAMPLEGAMMA"),
    );
    expect(gooby[1]?.tokensOut).toBeGreaterThan(0);
    expect(quotesFor("SAMPLEESCROW", UNIVERSE_FIXTURE.find((l) => l.asset === "SAMPLEESCROW")).every((q) => q.tokensOut == null)).toBe(true);
  });

  it("pair setups rail only lists that asset", () => {
    function pairSetups(asset: string) {
      const launches = UNIVERSE_FIXTURE.filter((l) => l.asset === asset);
      const ranked = rankSetups({
        launches,
        cashXcp: CASH_XCP,
        tipBlock: TIP_BLOCK,
        impactByAsset: IMPACT_BY_ASSET,
      });
      return ranked.filter((s) => s.asset === asset);
    }

    const gooby = pairSetups("SAMPLEGAMMA");
    expect(gooby).toHaveLength(1);
    expect(gooby[0].rule).toBe("post_open_dump");
    expect(gooby.every((s) => s.asset === "SAMPLEGAMMA")).toBe(true);

    expect(pairSetups("SAMPLEDEEP")).toEqual([]);
  });

  it("feeds rankSetups: buys on fresh grads including a large sleeve name", () => {
    const setups = rankSetups({
      launches: UNIVERSE_FIXTURE,
      cashXcp: CASH_XCP,
      tipBlock: TIP_BLOCK,
      impactByAsset: IMPACT_BY_ASSET,
    });
    expect(setups.length).toBeGreaterThan(0);
    expect(setups.length).toBeLessThanOrEqual(5);
    expect(
      setups.some((s) => s.asset === "SAMPLEGAMMA" && s.action === "BUY_POOL"),
    ).toBe(true);
    expect(
      setups.some((s) => s.asset === "SAMPLEALPHA" && s.action === "BUY_POOL"),
    ).toBe(true);
    expect(setups.every((s) => s.rule !== "already_loaded")).toBe(true);
  });

  it("filters scan pills on the fixture", () => {
    const fresh = UNIVERSE_FIXTURE.filter((l) => matchesScan(l, "fresh_grads"));
    expect(fresh.map((l) => l.asset).sort()).toEqual(
      ["SAMPLEALPHA", "SAMPLEDELTA", "SAMPLEGAMMA", "SAMPLEBETA"].sort(),
    );
    const mine = UNIVERSE_FIXTURE.filter((l) => matchesScan(l, "my_overlap"));
    expect(mine.map((l) => l.asset).sort()).toEqual(
      ["SAMPLEALPHA", "SAMPLEDELTA", "SAMPLEGAMMA", "SAMPLEESCROW", "SAMPLEBETA"].sort(),
    );
    expect(UNIVERSE_FIXTURE.filter((l) => matchesScan(l, "near_fill"))).toEqual(
      [],
    );
    expect(UNIVERSE_FIXTURE.filter((l) => matchesScan(l, "thin_chase"))).toEqual(
      [],
    );
  });

  it("computes live 1 XCP quote from pool reserves", () => {
    const launch = UNIVERSE_FIXTURE.find((l) => l.asset === "SAMPLEGAMMA");
    const quotes = quotesFor("SAMPLEGAMMA", launch);
    const oneXcp = quotes.find((q) => q.xcpIn === 1);
    expect(oneXcp?.impact).toBeCloseTo(1 / 633.35, 5);
    expect(oneXcp?.tokensOut).toBeGreaterThan(0);
  });

  it("formats the markets 1% impact cell", () => {
    const gooby = UNIVERSE_FIXTURE.find((l) => l.asset === "SAMPLEGAMMA");
    const pamp = UNIVERSE_FIXTURE.find((l) => l.asset === "SAMPLEESCROW");
    expect(gooby).toBeDefined();
    expect(pamp).toBeDefined();
    expect(impactCell(gooby!, IMPACT_BY_ASSET)).toBe("1 XCP → −4.00%");
    expect(impactCell(pamp!, IMPACT_BY_ASSET)).toBe("—");
  });
});
