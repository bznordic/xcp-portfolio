import { isBitcoinAddress, shortAddress } from "../data/fixture";

export const WATCH_ADDRESS_KEY = "xcp-book:watch-address";
export const WATCHES_KEY = "xcp-book:watches";
export const MAX_WATCHES = 24;
export const MAX_NAME = 40;

export type Watch = {
  name: string;
  address: string;
};

export function parseWatchAddress(raw: string | null): string {
  const addr = raw?.trim() ?? "";
  return isBitcoinAddress(addr) ? addr : "";
}

export function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

export function displayWatchName(address: string, name: string): string {
  const trimmed = name.trim().slice(0, MAX_NAME);
  return trimmed || shortAddress(address);
}

export function parseWatches(raw: string | null): Watch[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: Watch[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const address = parseWatchAddress(
        "address" in row ? String(row.address) : "",
      );
      if (!address) continue;
      if (out.some((w) => sameAddress(w.address, address))) continue;
      const name =
        "name" in row && typeof row.name === "string" ? row.name : "";
      out.push({ name: displayWatchName(address, name), address });
      if (out.length >= MAX_WATCHES) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function upsertWatch(
  list: Watch[],
  address: string,
  name: string,
): Watch[] {
  const addr = parseWatchAddress(address);
  if (!addr) return list;
  const label = displayWatchName(addr, name);
  const idx = list.findIndex((w) => sameAddress(w.address, addr));
  if (idx >= 0) {
    return list.map((w, i) =>
      i === idx ? { name: label, address: addr } : w,
    );
  }
  if (list.length >= MAX_WATCHES) return list;
  return [...list, { name: label, address: addr }];
}

export function renameWatch(
  list: Watch[],
  address: string,
  name: string,
): Watch[] {
  const addr = parseWatchAddress(address);
  if (!addr) return list;
  return list.map((w) =>
    sameAddress(w.address, addr)
      ? { ...w, name: displayWatchName(addr, name) }
      : w,
  );
}

export function removeWatch(list: Watch[], address: string): Watch[] {
  return list.filter((w) => !sameAddress(w.address, address));
}

export function seedWatches(list: Watch[], currentAddress: string): Watch[] {
  if (list.length > 0) return list;
  const addr = parseWatchAddress(currentAddress);
  if (!addr) return list;
  return [{ name: displayWatchName(addr, ""), address: addr }];
}

function readStorage(key: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / quota */
  }
}

export function loadWatchAddress(): string {
  return parseWatchAddress(readStorage(WATCH_ADDRESS_KEY));
}

export function saveWatchAddress(address: string): void {
  const addr = parseWatchAddress(address);
  if (!addr) return;
  writeStorage(WATCH_ADDRESS_KEY, addr);
}

export function loadWatches(): Watch[] {
  const stored = parseWatches(readStorage(WATCHES_KEY));
  const seeded = seedWatches(stored, loadWatchAddress());
  if (stored.length === 0 && seeded.length > 0) saveWatches(seeded);
  return seeded;
}

export function clearWatchAddress(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(WATCH_ADDRESS_KEY);
  } catch {
    /* private mode */
  }
}

export function saveWatches(list: Watch[]): void {
  writeStorage(WATCHES_KEY, JSON.stringify(list));
}
