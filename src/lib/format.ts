import { FX } from "../data/fixture";
import type { FxSpot } from "./fx";

export function fmtXcp(n: number, digits = 4): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtQty(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Qty that the blotter shows as 0.00 — leftover dust after a sell. */
export function isDustQty(qty: number): boolean {
  return Math.round(qty * 100) === 0;
}

export function fmtPrice(n: number): string {
  if (n >= 1) return fmtXcp(n, 2);
  return n.toFixed(10).replace(/0+$/, "").replace(/\.$/, "");
}

export function fmtPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function fmtSigned(n: number, digits = 4): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${fmtXcp(n, digits)}`;
}

export function toBtc(xcp: number, fx: FxSpot = FX): number {
  return xcp * fx.xcpPerBtc;
}

export function toUsd(xcp: number, fx: FxSpot = FX): number {
  return toBtc(xcp, fx) * fx.usdPerBtc;
}

export function fmtSats(n: number): string {
  return `${n.toLocaleString("en-US")} sats`;
}

export function fmtSignedSats(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("en-US")} sats`;
}

export function fmtBtc(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  });
}

export function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}
