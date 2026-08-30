import type { Launch } from "../lib/setups";

/** Demo cash sleeve used when Core has not answered yet. */
export const CASH_XCP = 0;
export const TIP_BLOCK = 0;

export const QUOTE_STRIP = [
  { xcpIn: 0.5, impact: 0.02 },
  { xcpIn: 1, impact: 0.04 },
  { xcpIn: 2, impact: 0.08 },
] as const;

export const UNIVERSE_FIXTURE: Launch[] = [];

export type SizeQuote = {
  xcpIn: number;
  impact: number;
  tokensOut: number | null;
};

export function quotesFor(
  asset: string,
  launch?: Launch | null,
): SizeQuote[] {
  const row = launch ?? UNIVERSE_FIXTURE.find((l) => l.asset === asset) ?? null;
  const mark = row?.mark ?? null;
  const poolXcp = row?.poolXcp;
  const liveImpact = launch != null && poolXcp != null && poolXcp > 0;
  return QUOTE_STRIP.map((q) => {
    const impact = liveImpact ? q.xcpIn / poolXcp : q.impact;
    return {
      xcpIn: q.xcpIn,
      impact,
      tokensOut:
        mark != null && mark > 0 ? (q.xcpIn / mark) * (1 - impact) : null,
    };
  });
}

/** 1 XCP impact from the recorded strip (0.04). */
export const IMPACT_BY_ASSET: Record<string, number> = Object.fromEntries(
  UNIVERSE_FIXTURE.filter((l) => l.mark != null).map((l) => [l.asset, 0.04]),
);
