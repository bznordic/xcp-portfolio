import { describe, expect, it } from "vitest";
import { rankSetups } from "../src/lib/setups";

describe("rankSetups", () => {
  it("recommends post_open_dump on a fresh grad below 2× mint with cash", () => {
    const setups = rankSetups({
      cashXcp: 14,
      tipBlock: 964404,
      impactByAsset: { SAMPLEGAMMA: 0.02 },
      launches: [
        {
          asset: "SAMPLEGAMMA",
          status: "graduated",
          mark: 0.00001864,
          poolXcp: 633,
          fill: 1,
          blocksLeft: null,
          blocksSinceOpen: 20,
          issuer: "17Xw…",
          you: "held",
          youSleeveWt: 0.21,
          youMintPaidXcp: 0,
        },
      ],
    });
    expect(setups[0].rule).toBe("post_open_dump");
    expect(setups[0].action).toBe("BUY_POOL");
    expect(setups[0].sizeXcp).toBe(2);
    expect(setups[0].why.length).toBeGreaterThan(0);
  });

  it("still BUY_POOL when a name is a large sleeve — rank upside, not bag size", () => {
    const setups = rankSetups({
      cashXcp: 14,
      tipBlock: 964404,
      impactByAsset: { SAMPLEGAMMA: 0.02 },
      launches: [
        {
          asset: "SAMPLEGAMMA",
          status: "graduated",
          mark: 0.00001864,
          poolXcp: 633,
          fill: 1,
          blocksLeft: null,
          blocksSinceOpen: 20,
          issuer: "17Xw…",
          you: "held",
          youSleeveWt: 0.4,
          youMintPaidXcp: 0,
        },
      ],
    });
    expect(setups[0].action).toBe("BUY_POOL");
    expect(setups[0].asset).toBe("SAMPLEGAMMA");
    expect(setups.every((s) => s.rule !== "already_loaded")).toBe(true);
  });

  it("ranks more room-to-2× ahead of a name already near 2× mint", () => {
    const setups = rankSetups({
      cashXcp: 14,
      tipBlock: 964404,
      impactByAsset: {},
      launches: [
        {
          asset: "NEAR",
          status: "graduated",
          mark: 0.000019,
          poolXcp: 400,
          fill: 1,
          blocksLeft: null,
          blocksSinceOpen: 10,
          issuer: "1…",
          you: "none",
          youSleeveWt: 0,
          youMintPaidXcp: 0,
        },
        {
          asset: "ROOM",
          status: "graduated",
          mark: 0.000011,
          poolXcp: 400,
          fill: 1,
          blocksLeft: null,
          blocksSinceOpen: 10,
          issuer: "1…",
          you: "none",
          youSleeveWt: 0,
          youMintPaidXcp: 0,
        },
      ],
    });
    const buys = setups.filter((s) => s.action === "BUY_POOL");
    expect(buys[0]?.asset).toBe("ROOM");
  });

  it("emits last_lots MINT when fill is 85% and 100 blocks left", () => {
    const setups = rankSetups({
      cashXcp: 14,
      tipBlock: 964404,
      impactByAsset: {},
      launches: [
        {
          asset: "SAMPLEESCROW",
          status: "minting",
          mark: null,
          poolXcp: null,
          fill: 0.85,
          blocksLeft: 100,
          blocksSinceOpen: null,
          issuer: "1Ma…",
          you: "escrow",
          youSleeveWt: 0,
          youMintPaidXcp: 2,
        },
      ],
    });
    expect(
      setups.some((s) => s.rule === "last_lots" && s.action === "MINT"),
    ).toBe(true);
  });

  it("emits sit_cash when nothing fires", () => {
    const setups = rankSetups({
      cashXcp: 14,
      tipBlock: 964404,
      impactByAsset: {},
      launches: [
        {
          asset: "SNOOZE",
          status: "scheduled",
          mark: null,
          poolXcp: null,
          fill: 0,
          blocksLeft: 5000,
          blocksSinceOpen: null,
          issuer: "1…",
          you: "none",
          youSleeveWt: 0,
          youMintPaidXcp: 0,
        },
      ],
    });
    expect(setups[0].rule).toBe("sit_cash");
  });

  it("keeps only the highest-scoring setup per asset", () => {
    const gooby = {
      asset: "SAMPLEGAMMA",
      status: "graduated" as const,
      mark: 0.00001864,
      poolXcp: 633,
      fill: 1,
      blocksLeft: null,
      blocksSinceOpen: 20,
      issuer: "17Xw…",
      you: "held" as const,
      youSleeveWt: 0.21,
      youMintPaidXcp: 0,
    };
    const setups = rankSetups({
      cashXcp: 14,
      tipBlock: 964404,
      impactByAsset: { SAMPLEGAMMA: 0.02 },
      launches: [gooby, { ...gooby, blocksSinceOpen: 50 }],
    });
    const goobySetups = setups.filter((s) => s.asset === "SAMPLEGAMMA");
    expect(goobySetups).toHaveLength(1);
    expect(goobySetups[0].rule).toBe("post_open_dump");
  });

  it("emits thin_chase without requiring graduated status", () => {
    const setups = rankSetups({
      cashXcp: 14,
      tipBlock: 964404,
      impactByAsset: {},
      launches: [
        {
          asset: "CHASE",
          status: "minting",
          mark: 0.00005,
          poolXcp: 150,
          fill: 0.5,
          blocksLeft: 500,
          blocksSinceOpen: null,
          issuer: "1Ch…",
          you: "none",
          youSleeveWt: 0,
          youMintPaidXcp: 0,
        },
      ],
    });
    expect(setups.some((s) => s.rule === "thin_chase" && s.action === "AVOID")).toBe(
      true,
    );
  });

  it("emits dip_below_mint when mark is under mint with deep pool", () => {
    const setups = rankSetups({
      cashXcp: 14,
      tipBlock: 964404,
      impactByAsset: {},
      launches: [
        {
          asset: "DIP",
          status: "graduated",
          mark: 0.000005,
          poolXcp: 400,
          fill: 1,
          blocksLeft: null,
          blocksSinceOpen: 200,
          issuer: "1Di…",
          you: "none",
          youSleeveWt: 0,
          youMintPaidXcp: 0,
        },
      ],
    });
    expect(setups[0].rule).toBe("dip_below_mint");
    expect(setups[0].action).toBe("BUY_POOL");
  });

  it("keeps BUY_POOL when duplicate rows mix high and low sleeve weight", () => {
    const gooby = {
      asset: "SAMPLEGAMMA",
      status: "graduated" as const,
      mark: 0.000005,
      poolXcp: 633,
      fill: 1,
      blocksLeft: null,
      blocksSinceOpen: 200,
      issuer: "17Xw…",
      you: "held" as const,
      youMintPaidXcp: 0,
    };
    const setups = rankSetups({
      cashXcp: 14,
      tipBlock: 964404,
      impactByAsset: { SAMPLEGAMMA: 0.02 },
      launches: [
        { ...gooby, youSleeveWt: 0.4 },
        { ...gooby, youSleeveWt: 0.1 },
      ],
    });
    expect(setups.some((s) => s.asset === "SAMPLEGAMMA" && s.action === "BUY_POOL")).toBe(
      true,
    );
    expect(setups.every((s) => s.rule !== "already_loaded")).toBe(true);
  });

  it("drops BUY_POOL score by 25 when impact exceeds 8%", () => {
    const withoutImpact = rankSetups({
      cashXcp: 14,
      tipBlock: 964404,
      impactByAsset: { SAMPLEGAMMA: 0.02 },
      launches: [
        {
          asset: "SAMPLEGAMMA",
          status: "graduated",
          mark: 0.00001864,
          poolXcp: 633,
          fill: 1,
          blocksLeft: null,
          blocksSinceOpen: 20,
          issuer: "17Xw…",
          you: "held",
          youSleeveWt: 0.21,
          youMintPaidXcp: 0,
        },
      ],
    });
    const withImpact = rankSetups({
      cashXcp: 14,
      tipBlock: 964404,
      impactByAsset: { SAMPLEGAMMA: 0.1 },
      launches: [
        {
          asset: "SAMPLEGAMMA",
          status: "graduated",
          mark: 0.00001864,
          poolXcp: 633,
          fill: 1,
          blocksLeft: null,
          blocksSinceOpen: 20,
          issuer: "17Xw…",
          you: "held",
          youSleeveWt: 0.21,
          youMintPaidXcp: 0,
        },
      ],
    });
    expect(withImpact[0].score).toBe(withoutImpact[0].score - 25);
    expect(withImpact[0].why.some((w) => w.includes("8%"))).toBe(true);
  });

  it("does not apply XCP-69 mint setups to a listed Core pool like PEPECASH", () => {
    const setups = rankSetups({
      cashXcp: 14,
      tipBlock: 964404,
      impactByAsset: { PEPECASH: 0.01 },
      launches: [
        {
          asset: "PEPECASH",
          status: "listed",
          mark: 0.00156,
          poolXcp: 670,
          fill: null,
          blocksLeft: null,
          blocksSinceOpen: null,
          issuer: "unknown",
          you: "held",
          youSleeveWt: 0.1,
          youMintPaidXcp: 0,
        },
      ],
    });
    expect(setups.every((s) => s.asset !== "PEPECASH")).toBe(true);
  });
});
