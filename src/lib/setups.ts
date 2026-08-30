import {
  CASH_BUFFER_XCP,
  LAST_LOTS_BLOCKS,
  LAST_LOTS_FILL,
  MAX_SETUPS,
  MINT_PRICE,
  MIN_DIP_POOL_XCP,
  POST_OPEN_BLOCKS,
  THIN_IMPACT,
  THIN_POOL_XCP,
} from "./xcp69";

export type Launch = {
  asset: string;
  status: "scheduled" | "minting" | "graduated" | "refunded" | "listed";
  mark: number | null;
  poolXcp: number | null;
  fill: number | null;
  blocksLeft: number | null;
  blocksSinceOpen: number | null;
  issuer: string;
  you: "held" | "escrow" | "none";
  youSleeveWt: number;
  youMintPaidXcp: number;
};

export type SetupInput = {
  launches: Launch[];
  cashXcp: number;
  tipBlock: number;
  impactByAsset: Record<string, number>;
};

export type SetupAction = "MINT" | "BUY_POOL" | "WAIT" | "AVOID";

export type SetupRule =
  | "dip_below_mint"
  | "post_open_dump"
  | "room_to_run"
  | "last_lots"
  | "sit_cash"
  | "thin_chase";

export type Setup = {
  id: string;
  rule: SetupRule;
  action: SetupAction;
  asset: string;
  score: number;
  sizeXcp: number;
  why: string[];
  when: string;
  invalidIf: string[];
};

const INVALID_IMPACT = "1 XCP impact > 8%";

function suggestedSize(cashXcp: number): number {
  const budget =
    cashXcp >= CASH_BUFFER_XCP
      ? cashXcp - CASH_BUFFER_XCP
      : Math.max(0, cashXcp);
  if (budget >= 2) return 2;
  if (budget >= 1) return 1;
  if (budget >= 0.5) return 0.5;
  return 0;
}

function makeSitCash(sizeXcp: number, why: string[]): Setup {
  return {
    id: "sit_cash:XCP",
    rule: "sit_cash",
    action: "WAIT",
    asset: "XCP",
    score: 10,
    sizeXcp,
    why,
    when: "When no BUY_POOL or MINT setup fires and cash remains.",
    invalidIf: [],
  };
}

function markVsMint(mark: number): string {
  const mult = mark / MINT_PRICE;
  return `${mult.toFixed(2)}× mint`;
}

/** Extra points for how much room is left before 2× mint. */
function upsideKicker(mark: number): number {
  return Math.max(0, 2 - mark / MINT_PRICE) * 10;
}

function isBuy(setup: Setup): boolean {
  return setup.action === "BUY_POOL" || setup.action === "MINT";
}

function applyImpactPenalty(setup: Setup, impact: number): Setup {
  if (setup.action !== "BUY_POOL" || impact <= THIN_IMPACT) {
    return setup;
  }

  return {
    ...setup,
    score: Math.max(setup.score - 25, 0),
    why: [...setup.why, "Size down; 1 XCP moves > 8%"],
    invalidIf: [...setup.invalidIf, INVALID_IMPACT],
  };
}

function evaluateLaunch(
  launch: Launch,
  sizeXcp: number,
  impactByAsset: Record<string, number>,
): Setup | null {
  if (launch.status === "listed") return null;
  const { asset } = launch;
  const impact = impactByAsset[asset] ?? 0;
  const candidates: Setup[] = [];

  if (
    launch.mark != null &&
    launch.poolXcp != null &&
    launch.mark > 3 * MINT_PRICE &&
    launch.poolXcp < THIN_POOL_XCP
  ) {
    candidates.push({
      id: `thin_chase:${asset}`,
      rule: "thin_chase",
      action: "AVOID",
      asset,
      score: 40,
      sizeXcp,
      why: [
        `Mark ${markVsMint(launch.mark)} with thin pool ${launch.poolXcp} XCP.`,
      ],
      when: "Anytime this is true.",
      invalidIf: [],
    });
  }

  if (
    launch.status === "graduated" &&
    launch.mark != null &&
    launch.poolXcp != null &&
    launch.mark < MINT_PRICE &&
    launch.poolXcp >= MIN_DIP_POOL_XCP
  ) {
    const dipScore =
      70 + Math.min(20, ((MINT_PRICE - launch.mark) / MINT_PRICE) * 100);
    candidates.push({
      id: `dip_below_mint:${asset}`,
      rule: "dip_below_mint",
      action: "BUY_POOL",
      asset,
      score: dipScore + upsideKicker(launch.mark),
      sizeXcp,
      why: [
        `Mark ${launch.mark} below mint ${MINT_PRICE}.`,
        `Pool ${launch.poolXcp} XCP.`,
      ],
      when: "While mark is under mint and pool still has ≥ 300 XCP.",
      invalidIf: [INVALID_IMPACT],
    });
  }

  if (
    launch.status === "graduated" &&
    launch.mark != null &&
    launch.poolXcp != null &&
    launch.blocksSinceOpen != null &&
    launch.blocksSinceOpen <= POST_OPEN_BLOCKS &&
    launch.mark < 2.0 * MINT_PRICE &&
    launch.poolXcp >= MIN_DIP_POOL_XCP
  ) {
    const rawScore = 60 + (POST_OPEN_BLOCKS - launch.blocksSinceOpen);
    candidates.push({
      id: `post_open_dump:${asset}`,
      rule: "post_open_dump",
      action: "BUY_POOL",
      asset,
      score: Math.min(rawScore, 85) + upsideKicker(launch.mark),
      sizeXcp,
      why: [
        `Mark ${markVsMint(launch.mark)}.`,
        `${launch.blocksSinceOpen} blk since open.`,
        `Pool ${launch.poolXcp} XCP.`,
      ],
      when: "First 72 blocks after OPEN_POOL, before mark reclaims 2× mint.",
      invalidIf: [INVALID_IMPACT],
    });
  }

  if (
    launch.status === "graduated" &&
    launch.mark != null &&
    launch.poolXcp != null &&
    launch.mark < 2.0 * MINT_PRICE &&
    launch.poolXcp >= MIN_DIP_POOL_XCP &&
    (launch.blocksSinceOpen == null ||
      launch.blocksSinceOpen > POST_OPEN_BLOCKS)
  ) {
    candidates.push({
      id: `room_to_run:${asset}`,
      rule: "room_to_run",
      action: "BUY_POOL",
      asset,
      score: 55 + upsideKicker(launch.mark),
      sizeXcp,
      why: [
        `Mark ${markVsMint(launch.mark)} — room left to 2× mint.`,
        `Pool ${launch.poolXcp} XCP.`,
      ],
      when: "While mark is under 2× mint and the pool still has ≥ 300 XCP.",
      invalidIf: [INVALID_IMPACT],
    });
  }

  if (
    launch.status === "minting" &&
    launch.fill != null &&
    launch.blocksLeft != null &&
    launch.fill >= LAST_LOTS_FILL &&
    launch.blocksLeft <= LAST_LOTS_BLOCKS &&
    launch.youMintPaidXcp < 10
  ) {
    candidates.push({
      id: `last_lots:${asset}`,
      rule: "last_lots",
      action: "MINT",
      asset,
      score: 50 + launch.fill * 30,
      sizeXcp,
      why: [
        `Fill ${Math.round(launch.fill * 100)}%.`,
        `${launch.blocksLeft} blocks left.`,
        `You paid ${launch.youMintPaidXcp} XCP on this mint.`,
      ],
      when:
        "Last 200 blocks and ≥ 80% filled — mint before resolve, or wait for refund.",
      invalidIf: [],
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  const best = candidates.reduce((a, b) => (b.score > a.score ? b : a));
  return applyImpactPenalty(best, impact);
}

export function rankSetups(input: SetupInput): Setup[] {
  const sizeXcp = suggestedSize(input.cashXcp);

  if (sizeXcp === 0) {
    return [makeSitCash(0, ["No size. Need XCP."])];
  }

  const bestByAsset = new Map<string, Setup>();
  for (const launch of input.launches) {
    const setup = evaluateLaunch(launch, sizeXcp, input.impactByAsset);
    if (!setup) continue;
    const existing = bestByAsset.get(setup.asset);
    if (!existing || setup.score > existing.score) {
      bestByAsset.set(setup.asset, setup);
    }
  }

  const ranked = Array.from(bestByAsset.values())
    .sort((a, b) => {
      const buy = Number(isBuy(b)) - Number(isBuy(a));
      if (buy !== 0) return buy;
      return b.score - a.score;
    })
    .slice(0, MAX_SETUPS);

  const hasActionable = ranked.some(isBuy);

  if (!hasActionable && input.cashXcp > 0 && ranked.length === 0) {
    return [makeSitCash(sizeXcp, ["No rule hit. XCP is the position."])];
  }

  return ranked;
}
