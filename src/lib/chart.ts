export function paddedRange(
  values: number[],
  pad = 0.14,
): { min: number; max: number } {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo;
  const extra = span === 0 ? Math.max(Math.abs(hi) * 0.04, 0.4) : span * pad;
  return { min: lo - extra, max: hi + extra };
}

export function yTicks(min: number, max: number, count = 4): number[] {
  const n = Math.max(count, 2);
  const step = (max - min) / (n - 1);
  return Array.from({ length: n }, (_, i) => min + i * step);
}

export function nearestIndex(x: number, xs: number[]): number {
  if (xs.length === 0) return 0;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < xs.length; i++) {
    const d = Math.abs(xs[i] - x);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function labelIndices(n: number, maxLabels = 5): number[] {
  if (n <= 0) return [];
  if (n <= maxLabels) return Array.from({ length: n }, (_, i) => i);
  const out = new Set<number>([0, n - 1]);
  const inner = maxLabels - 2;
  for (let k = 1; k <= inner; k++) {
    out.add(Math.round((k * (n - 1)) / (inner + 1)));
  }
  return [...out].sort((a, b) => a - b);
}
