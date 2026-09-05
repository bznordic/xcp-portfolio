import type { CoreFairmint, CoreOrder } from "./book";
import type { Launch } from "./setups";
import { isXcp69, type Xcp69Fairminter } from "./xcp69";

export type CoreFairminter = Xcp69Fairminter & {
  status: string;
  source?: string;
  earned_quantity?: number;
  block_index?: number;
  start_block?: number;
  end_block?: number;
  soft_cap_deadline_block?: number;
};

export type PoolRow = {
  reserve_a: number;
  reserve_b: number;
  block_index?: number;
  asset_a?: string;
  asset_b?: string;
};

export type PoolMark = {
  priceXcp: number;
  poolXcp: number;
  block: number | null;
};

export function launchFromPoolRow(row: PoolRow): Launch | null {
  const assetA = row.asset_a;
  const assetB = row.asset_b;
  if (!assetA || !assetB) return null;
  let asset: string;
  let tokenRes: number;
  let xcpRes: number;
  if (assetB === "XCP" && assetA !== "XCP") {
    asset = assetA;
    tokenRes = Number(row.reserve_a);
    xcpRes = Number(row.reserve_b);
  } else if (assetA === "XCP" && assetB !== "XCP") {
    asset = assetB;
    tokenRes = Number(row.reserve_b);
    xcpRes = Number(row.reserve_a);
  } else {
    return null;
  }
  if (asset.startsWith("A")) return null;
  const priced = poolMarkFromRow({
    reserve_a: tokenRes,
    reserve_b: xcpRes,
    block_index: row.block_index,
  });
  if (!priced) return null;
  return {
    asset,
    status: "listed",
    mark: priced.priceXcp,
    poolXcp: priced.poolXcp,
    fill: null,
    blocksLeft: null,
    blocksSinceOpen: null,
    issuer: "unknown",
    you: "none",
    youSleeveWt: 0,
    youMintPaidXcp: 0,
  };
}

export function mergeLaunches(primary: Launch[], extra: Launch[]): Launch[] {
  const byAsset = new Map(primary.map((row) => [row.asset, row]));
  for (const row of extra) {
    if (!byAsset.has(row.asset)) byAsset.set(row.asset, row);
  }
  return [...byAsset.values()];
}

export function poolMarkFromRow(row: PoolRow): PoolMark | null {
  const reserveA = Number(row.reserve_a);
  const reserveB = Number(row.reserve_b);
  if (!(reserveA > 0) || !(reserveB > 0)) return null;
  return {
    priceXcp: reserveB / reserveA,
    poolXcp: reserveB / SAT,
    block: row.block_index ?? null,
  };
}

function isTokenXcpPool(row: PoolRow): boolean {
  const a = row.asset_a;
  const b = row.asset_b;
  if (a == null && b == null) {
    return Number(row.reserve_a) > 0 && Number(row.reserve_b) > 0;
  }
  if (b === "XCP" && a != null && a !== "XCP") {
    return Number(row.reserve_a) > 0 && Number(row.reserve_b) > 0;
  }
  if (a === "XCP" && b != null && b !== "XCP") {
    return Number(row.reserve_a) > 0 && Number(row.reserve_b) > 0;
  }
  return false;
}

/** Pick the live TOKEN/XCP pool from a Core /pools payload. */
export function poolRowFromCoreResult(
  result: PoolRow | PoolRow[] | null | undefined,
): PoolRow | null {
  const rows = Array.isArray(result) ? result : result ? [result] : [];
  return rows.find(isTokenXcpPool) ?? null;
}

type CorePage<T> = {
  result?: T | T[];
  next_cursor?: string | null;
};

const SAT = 1e8;

export const LIVE_FETCH: RequestInit = { cache: "no-store" };

function retryAfterMs(res: Response): number {
  const raw = res.headers?.get?.("retry-after");
  const sec = raw != null && raw !== "" ? Number(raw) : NaN;
  if (Number.isFinite(sec) && sec >= 0) return sec * 1000;
  return 1000;
}

async function coreFetch(path: string): Promise<Response> {
  let last = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`/core${path}`, LIVE_FETCH);
    if (res.status === 429 && attempt < 3) {
      last = 429;
      await new Promise((r) => setTimeout(r, retryAfterMs(res)));
      continue;
    }
    return res;
  }
  throw new Error(`core ${path} ${last}`);
}

async function coreGet<T>(path: string): Promise<T> {
  const res = await coreFetch(path);
  if (!res.ok) throw new Error(`core ${path} ${res.status}`);
  return (await res.json()) as T;
}

async function fetchFairminters(status: string): Promise<CoreFairminter[]> {
  const rows: CoreFairminter[] = [];
  let cursor: string | undefined;
  for (;;) {
    const qs = new URLSearchParams({ status, verbose: "true" });
    if (cursor) qs.set("cursor", cursor);
    const page = await coreGet<CorePage<CoreFairminter>>(
      `/v2/fairminters?${qs}`,
    );
    const result = page.result;
    const batch = Array.isArray(result) ? result : result ? [result] : [];
    rows.push(...batch);
    if (!page.next_cursor) break;
    cursor = page.next_cursor;
  }
  return rows;
}

async function fetchPool(asset: string): Promise<PoolRow | null> {
  const res = await coreFetch(
    `/v2/pools/${encodeURIComponent(asset)}/XCP`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`core pool ${asset} ${res.status}`);
  const body = (await res.json()) as CorePage<PoolRow>;
  return poolRowFromCoreResult(body.result);
}

export function overlayBook(core: Launch[], book: Launch[]): Launch[] {
  const byAsset = new Map(book.map((row) => [row.asset, row]));
  return core.map((launch) => {
    const held = byAsset.get(launch.asset);
    if (!held) return launch;
    return {
      ...launch,
      you: held.you,
      youSleeveWt: held.youSleeveWt,
      youMintPaidXcp: held.youMintPaidXcp,
    };
  });
}

export function impactFromPool(
  poolXcp: number | null | undefined,
): number | undefined {
  if (poolXcp == null || poolXcp <= 0) return undefined;
  return 1 / poolXcp;
}

export function impactMapFromLaunches(
  launches: Launch[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const launch of launches) {
    const impact = impactFromPool(launch.poolXcp);
    if (impact != null) map[launch.asset] = impact;
  }
  return map;
}

export async function fetchTipBlock(): Promise<number> {
  const page = await coreGet<CorePage<{ block_index?: number }>>(
    "/v2/blocks?limit=1",
  );
  const result = page.result;
  const row = Array.isArray(result) ? result[0] : result;
  if (row == null || row.block_index == null) {
    throw new Error("core /v2/blocks missing block_index");
  }
  return Number(row.block_index);
}

export function toLaunch(
  fairminter: CoreFairminter,
  pool: PoolRow | null,
  tipBlock: number,
): Launch {
  const status = launchStatus(fairminter, pool);
  const priced = pool ? poolMarkFromRow(pool) : null;
  const mark = priced?.priceXcp ?? null;
  const poolXcp = priced?.poolXcp ?? null;
  const earned = Number(fairminter.earned_quantity ?? 0);
  const soft = Number(fairminter.soft_cap ?? 0);
  let fill: number | null = null;
  if (status === "minting" && soft > 0) fill = earned / soft;
  else if (status === "graduated") fill = soft > 0 ? earned / soft : 1;

  let blocksLeft: number | null = null;
  if (status === "minting" && fairminter.soft_cap_deadline_block != null) {
    blocksLeft = Number(fairminter.soft_cap_deadline_block) - tipBlock;
  } else if (status === "scheduled" && fairminter.start_block != null) {
    blocksLeft = Number(fairminter.start_block) - tipBlock;
  }

  let blocksSinceOpen: number | null = null;
  if (status === "graduated") {
    const settled = pool?.block_index ?? fairminter.block_index;
    if (settled != null) {
      blocksSinceOpen = tipBlock - Number(settled);
    }
  }

  return {
    asset: fairminter.asset,
    status,
    mark,
    poolXcp,
    fill,
    blocksLeft,
    blocksSinceOpen,
    issuer: fairminter.source ?? "unknown",
    you: "none",
    youSleeveWt: 0,
    youMintPaidXcp: 0,
  };
}

function launchStatus(
  fairminter: CoreFairminter,
  pool: PoolRow | null,
): Launch["status"] {
  if (fairminter.status === "pending") return "scheduled";
  if (fairminter.status === "open") return "minting";
  if (fairminter.status === "closed" && pool) return "graduated";
  return "refunded";
}

export async function fetchFairminter(
  asset: string,
): Promise<CoreFairminter | null> {
  const res = await coreFetch(
    `/v2/assets/${encodeURIComponent(asset)}/fairminters?verbose=true`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`core fairminter ${asset} ${res.status}`);
  const page = (await res.json()) as CorePage<CoreFairminter>;
  const result = page.result;
  const batch = Array.isArray(result) ? result : result ? [result] : [];
  if (batch.length === 0) return null;
  return batch.reduce((best, row) =>
    Number(row.block_index ?? 0) >= Number(best.block_index ?? 0) ? row : best,
  );
}

export async function fetchFairmintersForAssets(
  assets: string[],
): Promise<Record<string, CoreFairminter>> {
  const unique = [...new Set(assets.filter(Boolean))];
  const rows = await Promise.all(
    unique.map(async (asset) => {
      try {
        const row = await fetchFairminter(asset);
        return row ? ([asset, row] as const) : null;
      } catch {
        return null;
      }
    }),
  );
  const out: Record<string, CoreFairminter> = {};
  for (const row of rows) {
    if (row) out[row[0]] = row[1];
  }
  return out;
}

export async function fetchAddressFairmints(
  address: string,
): Promise<CoreFairmint[]> {
  const rows: CoreFairmint[] = [];
  let cursor: string | undefined;
  for (;;) {
    const qs = new URLSearchParams({ verbose: "true" });
    if (cursor) qs.set("cursor", cursor);
    const page = await coreGet<CorePage<CoreFairmint>>(
      `/v2/addresses/${encodeURIComponent(address)}/fairmints?${qs}`,
    );
    const result = page.result;
    const batch = Array.isArray(result) ? result : result ? [result] : [];
    rows.push(...batch);
    if (!page.next_cursor) break;
    cursor = page.next_cursor;
  }
  return rows;
}

export async function fetchAddressBalances(
  address: string,
): Promise<{ asset: string; qty: number }[]> {
  const rows: { asset: string; qty: number }[] = [];
  let cursor: string | undefined;
  for (;;) {
    const qs = new URLSearchParams({ verbose: "true" });
    if (cursor) qs.set("cursor", cursor);
    const page = await coreGet<
      CorePage<{
        asset: string;
        quantity_normalized?: string;
        utxo?: string | null;
      }>
    >(`/v2/addresses/${encodeURIComponent(address)}/balances?${qs}`);
    const result = page.result;
    const batch = Array.isArray(result) ? result : result ? [result] : [];
    for (const row of batch) {
      if (row.utxo) continue;
      rows.push({ asset: row.asset, qty: Number(row.quantity_normalized ?? 0) });
    }
    if (!page.next_cursor) break;
    cursor = page.next_cursor;
  }
  return rows;
}

export async function fetchAddressOrders(
  address: string,
): Promise<CoreOrder[]> {
  const rows: CoreOrder[] = [];
  let cursor: string | undefined;
  for (;;) {
    const qs = new URLSearchParams({ verbose: "true" });
    if (cursor) qs.set("cursor", cursor);
    const page = await coreGet<CorePage<CoreOrder>>(
      `/v2/addresses/${encodeURIComponent(address)}/orders?${qs}`,
    );
    const result = page.result;
    const batch = Array.isArray(result) ? result : result ? [result] : [];
    rows.push(...batch);
    if (!page.next_cursor) break;
    cursor = page.next_cursor;
  }
  return rows;
}

export async function fetchOpenPairOrders(asset: string): Promise<CoreOrder[]> {
  const rows: CoreOrder[] = [];
  let cursor: string | undefined;
  const pair = `${encodeURIComponent(asset)}/XCP`;
  for (;;) {
    const qs = new URLSearchParams({ status: "open", verbose: "true" });
    if (cursor) qs.set("cursor", cursor);
    const page = await coreGet<CorePage<CoreOrder>>(`/v2/orders/${pair}?${qs}`);
    const result = page.result;
    const batch = Array.isArray(result) ? result : result ? [result] : [];
    rows.push(...batch);
    if (!page.next_cursor) break;
    cursor = String(page.next_cursor);
  }
  return rows;
}

export async function fetchXcpCash(address: string): Promise<number> {
  const bals = await fetchAddressBalances(address);
  const xcp = bals.find((row) => row.asset === "XCP");
  if (xcp == null) throw new Error("core balances missing XCP");
  return xcp.qty;
}

export async function fetchPoolMark(asset: string): Promise<PoolMark | null> {
  const pool = await fetchPool(asset);
  if (!pool) return null;
  return poolMarkFromRow(pool);
}

export async function fetchPoolMarks(
  assets: string[],
): Promise<Record<string, PoolMark>> {
  const unique = [...new Set(assets.filter((asset) => asset && asset !== "XCP"))];
  const rows = await Promise.all(
    unique.map(async (asset) => {
      try {
        const mark = await fetchPoolMark(asset);
        return mark ? ([asset, mark] as const) : null;
      } catch {
        return null;
      }
    }),
  );
  const marks: Record<string, PoolMark> = {};
  for (const row of rows) {
    if (row) marks[row[0]] = row[1];
  }
  return marks;
}

export async function fetchPooledLaunches(): Promise<Launch[]> {
  const rows: PoolRow[] = [];
  let cursor: string | undefined;
  for (;;) {
    const qs = new URLSearchParams({ verbose: "true" });
    if (cursor) qs.set("cursor", cursor);
    const page = await coreGet<CorePage<PoolRow>>(`/v2/pools?${qs}`);
    const result = page.result;
    const batch = Array.isArray(result) ? result : result ? [result] : [];
    rows.push(...batch);
    if (!page.next_cursor) break;
    cursor = page.next_cursor;
  }
  const launches: Launch[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const launch = launchFromPoolRow(row);
    if (!launch || seen.has(launch.asset)) continue;
    seen.add(launch.asset);
    launches.push(launch);
  }
  return launches;
}

export async function fetchUniverse(tipBlock: number): Promise<Launch[]> {
  const [open, closed, pending] = await Promise.all([
    fetchFairminters("open"),
    fetchFairminters("closed"),
    fetchFairminters("pending"),
  ]);
  const xcp69 = [...pending, ...open, ...closed].filter(isXcp69);
  const pools = await Promise.all(
    xcp69.map((fm) =>
      fm.status === "closed" ? fetchPool(fm.asset) : Promise.resolve(null),
    ),
  );
  return xcp69.map((fm, i) => toLaunch(fm, pools[i] ?? null, tipBlock));
}
