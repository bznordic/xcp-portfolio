const SAT = 1e8;

export function paidInKey(address: string): string {
  return `xcp-book:paid-in:${address}`;
}

export function fmtPaidInBtc(sats: number): string {
  return (sats / SAT).toFixed(8);
}

export function parsePaidInToSats(raw: string): number | null {
  let t = raw.trim().replace(/\s/g, "");
  t = t.replace(/btc$/i, "");
  if (!t) return null;
  if (/^\d{1,3}(,\d{3})+$/.test(t) || /^\d+$/.test(t)) {
    const n = Number(t.replace(/,/g, ""));
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n);
  }
  if (t.includes(",") && !t.includes(".")) t = t.replace(",", ".");
  const btc = Number(t);
  if (!Number.isFinite(btc) || btc < 0) return null;
  return Math.round(btc * SAT);
}

export function parsePaidInStored(raw: string | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}

export function resolvedStartBtcSats(
  paidInSats: number | null,
  liveBtcSats: number | null,
): number | null {
  if (paidInSats != null) return paidInSats;
  return liveBtcSats;
}

export function loadPaidInSats(address: string): number | null {
  if (!address || typeof localStorage === "undefined") return null;
  try {
    return parsePaidInStored(localStorage.getItem(paidInKey(address)));
  } catch {
    return null;
  }
}

export function savePaidInSats(address: string, sats: number | null): void {
  if (!address || typeof localStorage === "undefined") return;
  try {
    if (sats == null) localStorage.removeItem(paidInKey(address));
    else localStorage.setItem(paidInKey(address), String(Math.round(sats)));
  } catch {
    /* private mode / quota */
  }
}
