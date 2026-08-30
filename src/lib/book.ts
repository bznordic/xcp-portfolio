import type { EquityPoint, Fill, Position } from "../data/fixture";
import { isDustQty } from "./format";
import type { Launch } from "./setups";
import type { PoolMark } from "./universe";

export type CoreFairmint = {
  asset: string;
  status: string;
  paid_quantity_normalized?: string;
  earn_quantity_normalized?: string;
  block_index?: number;
  tx_hash?: string;
};

export type MinterStatus = {
  status: string;
  end_block?: number;
  block_index?: number;
};

function paidXcp(mint: CoreFairmint): number {
  return Number(mint.paid_quantity_normalized ?? 0);
}

function earnQty(mint: CoreFairmint): number {
  return Number(mint.earn_quantity_normalized ?? 0);
}

function closeBlock(minter: MinterStatus, mint: CoreFairmint): number {
  if (minter.end_block != null && minter.end_block > 0) return minter.end_block;
  if (minter.block_index != null && minter.block_index > 0) {
    return minter.block_index;
  }
  return mint.block_index ?? 0;
}

export function isOpenEscrowMint(
  mint: CoreFairmint,
  minter?: MinterStatus,
): boolean {
  if (mint.status !== "valid") return false;
  if (!minter) return true;
  return minter.status === "open" || minter.status === "pending";
}

export function toEscrowPosition(mint: CoreFairmint): Position {
  const cost = paidXcp(mint);
  const qty = earnQty(mint);
  return {
    asset: mint.asset,
    kind: "escrow",
    qty,
    priceXcp: qty > 0 ? cost / qty : 0.00001,
    markXcp: cost,
    costXcp: cost,
    pnlXcp: 0,
    pnlPct: 0,
  };
}

export function escrowPositionsFromFairmints(
  mints: CoreFairmint[],
  tokenAssets: Set<string>,
  minterByAsset: Record<string, MinterStatus> = {},
): Position[] {
  return mints
    .filter((m) => isOpenEscrowMint(m, minterByAsset[m.asset]))
    .filter((m) => !tokenAssets.has(m.asset))
    .map(toEscrowPosition);
}

export function extraTokenPositions(
  balances: { asset: string; qty: number }[],
  existingAssets: Set<string>,
  marks: Record<string, number>,
  fillCostXcp: Record<string, number> = {},
): Position[] {
  const rows: Position[] = [];
  for (const bal of balances) {
    if (
      bal.asset === "XCP" ||
      existingAssets.has(bal.asset) ||
      isDustQty(bal.qty)
    ) {
      continue;
    }
    const price = marks[bal.asset];
    const priced = price != null && price > 0;
    const markXcp = priced ? bal.qty * price : 0;
    const costXcp = fillCostXcp[bal.asset] ?? markXcp;
    rows.push({
      asset: bal.asset,
      kind: "token",
      qty: bal.qty,
      priceXcp: priced ? price : null,
      markXcp,
      costXcp,
      pnlXcp: markXcp - costXcp,
      pnlPct: costXcp !== 0 ? ((markXcp - costXcp) / costXcp) * 100 : 0,
    });
  }
  return rows;
}

export type CoreOrder = {
  tx_hash?: string;
  block_index?: number;
  status: string;
  give_asset: string;
  get_asset: string;
  give_quantity_normalized?: string;
  get_quantity_normalized?: string;
};

export function orderToFill(order: CoreOrder): Fill | null {
  if (order.status !== "filled") return null;
  const give = Number(order.give_quantity_normalized ?? 0);
  const get = Number(order.get_quantity_normalized ?? 0);
  if (!(give > 0) || !(get > 0)) return null;
  if (order.give_asset === "XCP" && order.get_asset !== "XCP") {
    return {
      id: order.tx_hash ?? `buy:${order.get_asset}:${order.block_index ?? 0}`,
      block: order.block_index ?? 0,
      time: "live order",
      action: "buy",
      asset: order.get_asset,
      detail: `${get.toLocaleString("en-US")} ${order.get_asset} · pool`,
      xcp: -give,
      qty: get,
    };
  }
  if (order.get_asset === "XCP" && order.give_asset !== "XCP") {
    return {
      id: order.tx_hash ?? `sell:${order.give_asset}:${order.block_index ?? 0}`,
      block: order.block_index ?? 0,
      time: "live order",
      action: "sell",
      asset: order.give_asset,
      detail: `${give.toLocaleString("en-US")} ${order.give_asset} · pool`,
      xcp: get,
      qty: give,
    };
  }
  return null;
}

export function orderFills(orders: CoreOrder[]): Fill[] {
  return orders
    .map(orderToFill)
    .filter((row): row is Fill => row != null);
}

function paidRecovered(fills: Fill[]): {
  paid: Record<string, number>;
  recovered: Record<string, number>;
} {
  const paid: Record<string, number> = {};
  const recovered: Record<string, number> = {};
  for (const fill of fills) {
    if (fill.action === "buy" || fill.action === "mint_escrow") {
      paid[fill.asset] = (paid[fill.asset] ?? 0) + Math.abs(fill.xcp);
    } else if (fill.action === "sell" || fill.action === "mint_lose") {
      recovered[fill.asset] = (recovered[fill.asset] ?? 0) + Math.max(0, fill.xcp);
    }
  }
  return { paid, recovered };
}

export type LedgerRow = {
  fill: Fill;
  qtyDelta: number;
  qtyAfter: number;
  investedAfter: number;
  paidPriceAfter: number | null;
};

function qtyDeltaOf(fill: Fill): number {
  const qty = Math.abs(fill.qty ?? 0);
  if (fill.action === "sell" || fill.action === "mint_lose") return -qty;
  if (fill.action === "buy" || fill.action === "mint_escrow") return qty;
  return 0;
}

export function tokenLedger(fills: Fill[], asset: string): LedgerRow[] {
  let qty = 0;
  let invested = 0;
  return fills
    .filter((fill) => fill.asset === asset)
    .filter(
      (fill) =>
        fill.action === "buy" ||
        fill.action === "sell" ||
        fill.action === "mint_escrow" ||
        fill.action === "mint_lose",
    )
    .sort((a, b) => a.block - b.block || a.id.localeCompare(b.id))
    .map((fill) => {
      const qtyDelta = qtyDeltaOf(fill);
      qty = Math.max(0, qty + qtyDelta);
      if (fill.action === "buy" || fill.action === "mint_escrow") {
        invested += Math.abs(fill.xcp);
      } else {
        invested = Math.max(0, invested - Math.max(0, fill.xcp));
      }
      return {
        fill,
        qtyDelta,
        qtyAfter: qty,
        investedAfter: invested,
        paidPriceAfter: qty > 0 ? invested / qty : null,
      };
    });
}

export function remainingCostByAsset(fills: Fill[]): Record<string, number> {
  const { paid, recovered } = paidRecovered(fills);
  const out: Record<string, number> = {};
  for (const asset of new Set([...Object.keys(paid), ...Object.keys(recovered)])) {
    out[asset] = Math.max(0, (paid[asset] ?? 0) - (recovered[asset] ?? 0));
  }
  return out;
}

export function realizedFromFills(fills: Fill[]): number {
  const { paid, recovered } = paidRecovered(fills);
  let realized = 0;
  for (const asset of new Set([...Object.keys(paid), ...Object.keys(recovered)])) {
    realized += Math.max(0, (recovered[asset] ?? 0) - (paid[asset] ?? 0));
  }
  return realized;
}

export function applyRemainingCost(
  positions: Position[],
  remainingByAsset: Record<string, number>,
): Position[] {
  return positions.map((pos) => {
    if (pos.kind !== "token") return pos;
    const cost = remainingByAsset[pos.asset];
    if (cost == null || !Number.isFinite(cost) || cost < 0) return pos;
    const pnlXcp = pos.markXcp - cost;
    return {
      ...pos,
      costXcp: cost,
      pnlXcp,
      pnlPct: cost !== 0 ? (pnlXcp / cost) * 100 : 0,
    };
  });
}

export function applyCostOverrides(
  positions: Position[],
  costXcpByAsset: Record<string, number>,
): Position[] {
  return positions.map((pos) => {
    if (pos.kind === "cash") return pos;
    const cost = costXcpByAsset[pos.asset];
    if (cost == null || !Number.isFinite(cost) || cost < 0) return pos;
    if (pos.kind === "escrow") {
      return { ...pos, costXcp: cost, markXcp: cost, pnlXcp: 0, pnlPct: 0 };
    }
    const pnlXcp = pos.markXcp - cost;
    return {
      ...pos,
      costXcp: cost,
      pnlXcp,
      pnlPct: cost !== 0 ? (pnlXcp / cost) * 100 : 0,
    };
  });
}

export function applyLiveLaunchMarks(
  launches: Launch[],
  marks: Record<string, PoolMark>,
): Launch[] {
  return launches.map((launch) => {
    const mark = marks[launch.asset];
    if (!mark) return launch;
    return {
      ...launch,
      mark: mark.priceXcp,
      poolXcp: mark.poolXcp,
    };
  });
}

export function tradingPnlXcp(
  positions: Position[],
  realizedXcp: number,
): number {
  const uPnL = positions
    .filter((p) => p.kind === "token")
    .reduce((s, p) => s + p.pnlXcp, 0);
  return uPnL + realizedXcp;
}

export function liveEquityWindow<
  T extends {
    pnlXcp: number;
    startMark: number;
    label: string;
    curve: EquityPoint[];
  },
>(window: T, totalXcp: number, pnlXcp: number): T {
  return {
    ...window,
    pnlXcp,
    label: "vs cost",
    curve: window.curve.map((point, i) =>
      i === window.curve.length - 1 ? { ...point, markXcp: totalXcp } : point,
    ),
  };
}

export function markPrices(marks: Record<string, PoolMark>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(marks).map(([asset, mark]) => [asset, mark.priceXcp]),
  );
}

export type HoldingQuote = {
  valueXcp: number;
  marketPriceXcp: number | null;
  purchasePriceXcp: number | null;
  roiXcp: number;
  roiPct: number;
};

export function holdingQuote(pos: Position): HoldingQuote {
  return {
    valueXcp: pos.markXcp,
    marketPriceXcp: pos.priceXcp,
    purchasePriceXcp: pos.qty > 0 ? pos.costXcp / pos.qty : null,
    roiXcp: pos.pnlXcp,
    roiPct: pos.pnlPct,
  };
}

export function qtyByAssetFromBalances(
  bals: { asset: string; qty: number }[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of bals) {
    if (row.asset === "XCP") continue;
    map[row.asset] = (map[row.asset] ?? 0) + row.qty;
  }
  return map;
}

export function applyLiveHoldings(
  positions: Position[],
  qtyByAsset: Record<string, number> | null,
): Position[] {
  if (qtyByAsset == null) return positions;
  return positions.flatMap((pos) => {
    if (pos.kind !== "token") return [pos];
    const qty = qtyByAsset[pos.asset] ?? 0;
    if (isDustQty(qty)) return [];
    const costXcp = pos.qty > 0 ? pos.costXcp * (qty / pos.qty) : pos.costXcp;
    return [{ ...pos, qty, costXcp }];
  });
}

export function archivedTokenNames(
  tracked: string[],
  qtyByAsset: Record<string, number> | null,
): string[] {
  if (qtyByAsset == null) return [];
  return [...new Set(tracked)].filter((asset) =>
    isDustQty(qtyByAsset[asset] ?? 0),
  );
}

export function applyLiveMarks(
  positions: Position[],
  marks: Record<string, number>,
): Position[] {
  return positions.map((pos) => {
    if (pos.kind !== "token") return pos;
    const price = marks[pos.asset];
    if (price == null || price <= 0) return pos;
    const markXcp = pos.qty * price;
    return {
      ...pos,
      priceXcp: price,
      markXcp,
      pnlXcp: markXcp - pos.costXcp,
      pnlPct: pos.costXcp !== 0 ? ((markXcp - pos.costXcp) / pos.costXcp) * 100 : 0,
    };
  });
}

export function mergeBook(
  base: Position[],
  escrows: Position[],
  cashXcp?: number,
  extraTokens: Position[] = [],
): Position[] {
  const kept = base.filter((p) => p.kind !== "escrow").map((p) => {
    if (p.kind === "cash" && cashXcp != null) {
      return { ...p, qty: cashXcp, markXcp: cashXcp, costXcp: cashXcp };
    }
    return p;
  });
  return [...kept, ...extraTokens, ...escrows];
}

export function overlayHoldings(
  launches: Launch[],
  tokens: Position[],
): Launch[] {
  const sleeve = tokens.reduce((sum, p) => sum + p.markXcp, 0);
  const byAsset = new Map(tokens.map((p) => [p.asset, p]));
  return launches.map((launch) => {
    const pos = byAsset.get(launch.asset);
    if (!pos) return launch;
    return {
      ...launch,
      you: "held",
      youSleeveWt: sleeve > 0 ? pos.markXcp / sleeve : 0,
    };
  });
}

export function overlayEscrows(
  launches: Launch[],
  escrows: Position[],
): Launch[] {
  const paid = new Map(escrows.map((e) => [e.asset, e.costXcp]));
  const seen = new Set<string>();
  const next = launches.map((launch) => {
    const cost = paid.get(launch.asset);
    if (cost == null) return launch;
    seen.add(launch.asset);
    return {
      ...launch,
      you: launch.you === "held" ? ("held" as const) : ("escrow" as const),
      youMintPaidXcp: cost,
    };
  });
  for (const escrow of escrows) {
    if (seen.has(escrow.asset)) continue;
    next.push({
      asset: escrow.asset,
      status: "minting",
      mark: null,
      poolXcp: null,
      fill: null,
      blocksLeft: null,
      blocksSinceOpen: null,
      issuer: "unknown",
      you: "escrow",
      youSleeveWt: 0,
      youMintPaidXcp: escrow.costXcp,
    });
  }
  return next;
}

export function escrowFills(mints: CoreFairmint[]): Fill[] {
  return mints
    .filter((m) => m.status === "valid")
    .map((m) => {
      const qty = earnQty(m);
      const paid = paidXcp(m);
      return {
        id: m.tx_hash ?? `escrow:${m.asset}`,
        block: m.block_index ?? 0,
        time: "live mint",
        action: "mint_escrow" as const,
        asset: m.asset,
        detail: `${qty.toLocaleString("en-US")} ${m.asset} · escrow`,
        xcp: -paid,
        qty,
      };
    });
}

export function mintLoseFills(
  mints: CoreFairmint[],
  minterByAsset: Record<string, MinterStatus>,
  heldTokens: Set<string>,
): Fill[] {
  return mints
    .filter((m) => m.status === "valid")
    .filter((m) => !heldTokens.has(m.asset))
    .filter((m) => minterByAsset[m.asset]?.status === "closed")
    .map((m) => {
      const minter = minterByAsset[m.asset]!;
      const qty = earnQty(m);
      const paid = paidXcp(m);
      return {
        id: `lose:${m.tx_hash ?? m.asset}`,
        block: closeBlock(minter, m),
        time: "mint lost",
        action: "mint_lose" as const,
        asset: m.asset,
        detail: `${qty.toLocaleString("en-US")} ${m.asset} · mint lost`,
        xcp: paid,
        qty,
      };
    });
}

function similarFill(a: Fill, b: Fill): boolean {
  return (
    a.asset === b.asset &&
    a.action === b.action &&
    Math.abs(a.xcp - b.xcp) < 0.05
  );
}

export function mergeTape(base: Fill[], live: Fill[]): Fill[] {
  const ids = new Set(base.map((f) => f.id));
  const extra = live.filter((f) => {
    if (ids.has(f.id)) return false;
    if (
      f.action === "mint_escrow" &&
      base.some((b) => b.asset === f.asset && b.action === "mint_escrow")
    ) {
      return false;
    }
    if (base.some((b) => similarFill(b, f))) return false;
    return true;
  });
  return [...base, ...extra].sort((a, b) => a.block - b.block);
}
