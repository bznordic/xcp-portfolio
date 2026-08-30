import { FX } from "../data/fixture";

export type FxSpot = { xcpPerBtc: number; usdPerBtc: number };

const SAT = 1e8;

export function btcToSats(btc: number): number {
  return Math.round(btc * SAT);
}

export function xcpToSats(xcp: number, fx: FxSpot): number {
  return Math.round(xcp * fx.xcpPerBtc * SAT);
}

export function satsToUsd(sats: number, usdPerBtc: number): number {
  return (sats / SAT) * usdPerBtc;
}

export function feeSatsBurned(startBtcSats: number, liveBtcSats: number): number {
  return startBtcSats - liveBtcSats;
}

export function liquidationSats(input: {
  liveBtcSats: number;
  xcp: number;
  fx: FxSpot;
}): number {
  return input.liveBtcSats + xcpToSats(input.xcp, input.fx);
}

export function netSatsAfterFees(input: {
  liveBtcSats: number;
  xcp: number;
  fx: FxSpot;
  startBtcSats: number;
}): number {
  return liquidationSats(input) - input.startBtcSats;
}

export type MempoolAddressStats = {
  chain_stats?: { funded_txo_sum?: number; spent_txo_sum?: number };
  mempool_stats?: { funded_txo_sum?: number; spent_txo_sum?: number };
};

export function btcSatsFromMempoolAddress(row: MempoolAddressStats): number {
  const chain =
    (row.chain_stats?.funded_txo_sum ?? 0) -
    (row.chain_stats?.spent_txo_sum ?? 0);
  const mem =
    (row.mempool_stats?.funded_txo_sum ?? 0) -
    (row.mempool_stats?.spent_txo_sum ?? 0);
  return chain + mem;
}

export async function fetchAddressBtcSats(address: string): Promise<number> {
  const res = await fetch(
    `/mempool/address/${encodeURIComponent(address)}`,
  );
  if (!res.ok) throw new Error(`mempool address ${res.status}`);
  const body = (await res.json()) as MempoolAddressStats;
  return btcSatsFromMempoolAddress(body);
}

export type DispenserRow = {
  status: number | string;
  satoshirate: number;
  give_remaining: number;
  give_quantity?: number;
};

type CorePage<T> = {
  result?: T | T[];
  next_cursor?: string | null;
};

const XCP_VEND = 100_000_000;

let cachedFloor: number | null = null;

export function dispenserFloorXcpPerBtc(rows: DispenserRow[]): number | null {
  let bestSats: number | null = null;
  for (const d of rows) {
    const open = d.status === 0 || d.status === "open";
    if (!open || Number(d.give_remaining) <= 0) continue;
    if (Number(d.give_quantity) !== XCP_VEND) continue;
    const sats = Number(d.satoshirate);
    if (!(sats > 0)) continue;
    if (bestSats == null || sats < bestSats) bestSats = sats;
  }
  if (bestSats == null) return null;
  return bestSats / 1e8;
}

export function toAggregateFiat(
  xcp: number,
  fx: FxSpot,
): { xcp: number; btc: number; usd: number } {
  const btc = xcp * fx.xcpPerBtc;
  return { xcp, btc, usd: btc * fx.usdPerBtc };
}

async function coreDispensersPage(
  cursor?: string,
): Promise<CorePage<DispenserRow>> {
  const qs = new URLSearchParams({ status: "open", limit: "100" });
  if (cursor) qs.set("cursor", cursor);
  const res = await fetch(`/core/v2/assets/XCP/dispensers?${qs}`);
  if (!res.ok) throw new Error(`core dispensers ${res.status}`);
  return (await res.json()) as CorePage<DispenserRow>;
}

export async function fetchXcpBtcFloor(): Promise<number> {
  if (cachedFloor != null && cachedFloor < 1000 / 1e8) cachedFloor = null;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const page = await coreDispensersPage();
      const result = page.result;
      const batch = Array.isArray(result) ? result : result ? [result] : [];
      const floor = dispenserFloorXcpPerBtc(batch);
      if (floor == null) throw new Error("no open XCP dispensers");
      cachedFloor = floor;
      return floor;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  if (cachedFloor != null) return cachedFloor;
  throw lastError instanceof Error ? lastError : new Error("XCP floor failed");
}

export async function fetchUsdPerBtc(): Promise<number> {
  const res = await fetch("/fx");
  if (!res.ok) throw new Error(`fx ${res.status}`);
  const body = (await res.json()) as { USD?: number };
  if (body.USD == null || !(body.USD > 0)) throw new Error("fx missing USD");
  return body.USD;
}

export async function fetchFxSpot(fallback: FxSpot = FX): Promise<FxSpot> {
  const [xcpPerBtc, usdPerBtc] = await Promise.all([
    fetchXcpBtcFloor().catch(() => fallback.xcpPerBtc),
    fetchUsdPerBtc().catch(() => fallback.usdPerBtc),
  ]);
  return { xcpPerBtc, usdPerBtc };
}
