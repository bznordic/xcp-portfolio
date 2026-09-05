export type DepthSide = "bid" | "ask";
export type DepthSource = "dex" | "pool";

export type DepthOrder = {
  status: string;
  give_asset: string;
  get_asset: string;
  give_quantity_normalized?: string;
  get_quantity_normalized?: string;
  give_remaining_normalized?: string;
  get_remaining_normalized?: string;
};

export type DepthLevel = {
  side: DepthSide;
  priceXcp: number;
  tokenQty: number;
  xcpQty: number;
  source: DepthSource;
};

export type PoolRungs = {
  asks: DepthLevel[];
  bids: DepthLevel[];
};

export type DepthBook = {
  mark: number | null;
  asks: DepthLevel[];
  bids: DepthLevel[];
  bestAsk: number | null;
  bestBid: number | null;
};

const POOL_CLIPS = [0.5, 0.5, 1, 3, 5, 10];
const MAX_SIDE = 16;

function qty(raw: string | undefined): number {
  const n = Number(raw ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function remaining(order: DepthOrder, kind: "give" | "get"): number {
  if (kind === "give") {
    return qty(order.give_remaining_normalized) || qty(order.give_quantity_normalized);
  }
  return qty(order.get_remaining_normalized) || qty(order.get_quantity_normalized);
}

function priceKey(priceXcp: number): string {
  return priceXcp.toFixed(12);
}

function stack(levels: DepthLevel[]): DepthLevel[] {
  const byKey = new Map<string, DepthLevel>();
  for (const row of levels) {
    const key = `${row.side}:${row.source}:${priceKey(row.priceXcp)}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...row });
      continue;
    }
    prev.tokenQty += row.tokenQty;
    prev.xcpQty += row.xcpQty;
  }
  return [...byKey.values()];
}

export function dexLevels(asset: string, orders: DepthOrder[]): DepthLevel[] {
  const rows: DepthLevel[] = [];
  for (const order of orders) {
    if (order.status !== "open") continue;
    const give = remaining(order, "give");
    const get = remaining(order, "get");
    if (!(give > 0) || !(get > 0)) continue;
    if (order.give_asset === "XCP" && order.get_asset === asset) {
      rows.push({
        side: "bid",
        priceXcp: give / get,
        tokenQty: get,
        xcpQty: give,
        source: "dex",
      });
      continue;
    }
    if (order.give_asset === asset && order.get_asset === "XCP") {
      rows.push({
        side: "ask",
        priceXcp: get / give,
        tokenQty: give,
        xcpQty: get,
        source: "dex",
      });
    }
  }
  return stack(rows);
}

export function poolRungs(
  mark: number | null | undefined,
  poolXcp: number | null | undefined,
): PoolRungs {
  if (mark == null || !(mark > 0) || poolXcp == null || !(poolXcp > 0)) {
    return { asks: [], bids: [] };
  }
  let xcpAmt = poolXcp;
  let tokenAmt = poolXcp / mark;
  const k = xcpAmt * tokenAmt;
  const asks: DepthLevel[] = [];
  const bids: DepthLevel[] = [];

  for (const dx of POOL_CLIPS) {
    if (!(dx > 0) || !(tokenAmt > 0)) break;
    const x2 = xcpAmt + dx;
    const t2 = k / x2;
    const tokensOut = tokenAmt - t2;
    if (!(tokensOut > 0)) break;
    asks.push({
      side: "ask",
      priceXcp: dx / tokensOut,
      tokenQty: tokensOut,
      xcpQty: dx,
      source: "pool",
    });
    xcpAmt = x2;
    tokenAmt = t2;
  }

  xcpAmt = poolXcp;
  tokenAmt = poolXcp / mark;
  for (const dx of POOL_CLIPS) {
    if (!(dx > 0) || dx >= xcpAmt) break;
    const x2 = xcpAmt - dx;
    if (!(x2 > 0)) break;
    const t2 = k / x2;
    const tokensIn = t2 - tokenAmt;
    if (!(tokensIn > 0)) break;
    bids.push({
      side: "bid",
      priceXcp: dx / tokensIn,
      tokenQty: tokensIn,
      xcpQty: dx,
      source: "pool",
    });
    xcpAmt = x2;
    tokenAmt = t2;
  }

  return { asks, bids };
}

function byPriceDesc(a: DepthLevel, b: DepthLevel): number {
  return b.priceXcp - a.priceXcp;
}

export function toDepthBook(
  asset: string,
  orders: DepthOrder[],
  mark: number | null | undefined,
  poolXcp: number | null | undefined,
): DepthBook {
  const dex = dexLevels(asset, orders);
  const pool = poolRungs(mark ?? null, poolXcp ?? null);
  const asks = [...dex.filter((r) => r.side === "ask"), ...pool.asks]
    .sort((a, b) => a.priceXcp - b.priceXcp)
    .slice(0, MAX_SIDE)
    .sort(byPriceDesc);
  const bids = [...dex.filter((r) => r.side === "bid"), ...pool.bids]
    .sort(byPriceDesc)
    .slice(0, MAX_SIDE);
  const askPrices = asks.map((r) => r.priceXcp);
  const bidPrices = bids.map((r) => r.priceXcp);
  return {
    mark: mark != null && mark > 0 ? mark : null,
    asks,
    bids,
    bestAsk: askPrices.length ? Math.min(...askPrices) : null,
    bestBid: bidPrices.length ? Math.max(...bidPrices) : null,
  };
}
