export function costOverrideKey(address: string): string {
  return `xcp-book:cost:${address}`;
}

export function parseCostOverrides(raw: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, number> = {};
    for (const [asset, value] of Object.entries(parsed)) {
      const n = typeof value === "number" ? value : Number(value);
      if (!asset || !Number.isFinite(n) || n < 0) continue;
      out[asset] = n;
    }
    return out;
  } catch {
    return {};
  }
}

export function loadCostOverrides(address: string): Record<string, number> {
  if (!address || typeof localStorage === "undefined") return {};
  try {
    return parseCostOverrides(localStorage.getItem(costOverrideKey(address)));
  } catch {
    return {};
  }
}

export function saveCostOverrides(
  address: string,
  map: Record<string, number>,
): void {
  if (!address || typeof localStorage === "undefined") return;
  localStorage.setItem(costOverrideKey(address), JSON.stringify(map));
}
