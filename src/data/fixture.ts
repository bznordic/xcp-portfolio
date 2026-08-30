export type Timeframe = "1D" | "7D" | "30D" | "ALL";
export type Kind = "cash" | "token" | "escrow";
export type Action =
  | "buy"
  | "sell"
  | "mint_escrow"
  | "mint_lose"
  | "contribution"
  | "withdrawal";

export type Position = {
  asset: string;
  kind: Kind;
  qty: number;
  priceXcp: number | null;
  markXcp: number;
  costXcp: number;
  pnlXcp: number;
  pnlPct: number;
};

export type Fill = {
  id: string;
  block: number;
  time: string;
  action: Action;
  asset: string;
  detail: string;
  xcp: number;
  /** Token qty moved. Positive on the fill; sell/lose subtract it in the ledger. */
  qty?: number;
};

export type EquityPoint = { day: string; markXcp: number };

export const BLOCK = 0;
export const SNAPSHOT = "";

export const FX = { xcpPerBtc: 0.00003098, usdPerBtc: 79_902.63 };

/** Empty until Core loads the watched address. */
export const POSITIONS: Position[] = [
  {
    asset: "XCP",
    kind: "cash",
    qty: 0,
    priceXcp: 1,
    markXcp: 0,
    costXcp: 0,
    pnlXcp: 0,
    pnlPct: 0,
  },
];

export const FILLS: Fill[] = [];

export const TOTAL_XCP = POSITIONS.reduce((sum, p) => sum + p.markXcp, 0);
export const START_XCP = 0;
export const REALIZED_XCP = 0;

/** Remaining fill cost for names that are not on the recorded tape. */
export const FILL_COST_XCP: Record<string, number> = {};

function emptyWindow(
  label: string,
): { pnlXcp: number; startMark: number; label: string; curve: EquityPoint[] } {
  return {
    pnlXcp: 0,
    startMark: 0,
    label,
    curve: [
      { day: "open", markXcp: 0 },
      { day: "now", markXcp: TOTAL_XCP },
    ],
  };
}

export const WINDOWS: Record<
  Timeframe,
  { pnlXcp: number; startMark: number; label: string; curve: EquityPoint[] }
> = {
  "1D": emptyWindow("since yesterday"),
  "7D": emptyWindow("load an address"),
  "30D": emptyWindow("load an address"),
  ALL: emptyWindow("load an address"),
};

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 12)}…${addr.slice(-6)}`;
}

export function isBitcoinAddress(addr: string): boolean {
  return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,}$/i.test(addr);
}

export function assetMono(asset: string): string {
  return asset.replace(/[^A-Z]/gi, "").slice(0, 3);
}
