import { describe, expect, it } from "vitest";
import { rankSetups } from "../src/lib/setups";
import {
  SAMPLE_CASH_XCP as CASH_XCP,
  SAMPLE_IMPACT_BY_ASSET as IMPACT_BY_ASSET,
  SAMPLE_TIP_BLOCK as TIP_BLOCK,
  SAMPLE_UNIVERSE as UNIVERSE_FIXTURE,
} from "./sample-desk";
import {
  setupDiesIf,
  setupDoThis,
  setupHeadline,
  setupOrderLabel,
  setupPairLabel,
  setupWindow,
} from "../src/lib/setupCopy";
import { xcpFunArtUrl, xcpFunAssetUrl } from "../src/lib/xcpFun";

function fixtureSetups() {
  return rankSetups({
    launches: UNIVERSE_FIXTURE,
    cashXcp: CASH_XCP,
    tipBlock: TIP_BLOCK,
    impactByAsset: IMPACT_BY_ASSET,
  });
}

describe("setupCopy", () => {
  it("turns BUY_POOL into a verb + size headline", () => {
    const gooby = fixtureSetups().find((s) => s.asset === "SAMPLEGAMMA");
    expect(gooby).toBeTruthy();
    expect(setupHeadline(gooby!)).toBe("Buy SAMPLEGAMMA in the pool · 2 XCP");
    expect(setupPairLabel(gooby!)).toBe("Open SAMPLEGAMMA/XCP");
    expect(setupOrderLabel(gooby!)).toBe("Buy on xcp.fun");
    expect(xcpFunAssetUrl(gooby!.asset)).toBe("https://xcp.fun/SAMPLEGAMMA");
    expect(xcpFunArtUrl(gooby!.asset)).toBe(
      "https://xcp.fun/i/SAMPLEGAMMA?fb=full&w=240",
    );
  });

  it("does not build an order URL for cash", () => {
    expect(xcpFunAssetUrl("XCP")).toBeNull();
    expect(xcpFunArtUrl("XCP")).toBeNull();
    expect(xcpFunAssetUrl("")).toBeNull();
  });

  it("turns a large-sleeve fresh grad into a buy headline", () => {
    const evo = fixtureSetups().find((s) => s.asset === "SAMPLEALPHA");
    expect(evo).toBeTruthy();
    expect(evo!.action).toBe("BUY_POOL");
    expect(setupHeadline(evo!)).toMatch(/^Buy SAMPLEALPHA in the pool/);
    expect(setupDiesIf(evo!)).not.toMatch(/25%/);
  });

  it("says dies-if, not invalid, on a live buy", () => {
    const gooby = fixtureSetups().find((s) => s.asset === "SAMPLEGAMMA")!;
    const dies = setupDiesIf(gooby);
    expect(dies).toMatch(/^Dies if /);
    expect(dies).toMatch(/8%/);
    expect(dies).not.toMatch(/25%/);
    expect(dies.toLowerCase()).not.toContain("invalid");
    expect(setupWindow(gooby)).toMatch(/^Do this while /);
    expect(setupDoThis(gooby)).toMatch(/1\.86/);
    expect(setupDoThis(gooby)).toMatch(/4 blocks/i);
  });

  it("hides the pair button label for sit_cash", () => {
    const sit = rankSetups({
      cashXcp: 14,
      tipBlock: TIP_BLOCK,
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
    })[0];
    expect(sit.rule).toBe("sit_cash");
    expect(setupHeadline(sit)).toBe("Sit in XCP · 2 XCP");
    expect(setupPairLabel(sit)).toBe("");
    expect(setupOrderLabel(sit)).toBe("");
  });
});
