import { describe, expect, it } from "vitest";
import {
  labelIndices,
  nearestIndex,
  paddedRange,
  yTicks,
} from "../src/lib/chart";

describe("paddedRange", () => {
  it("adds headroom around min and max", () => {
    const { min, max } = paddedRange([20, 24.85]);
    expect(min).toBeLessThan(20);
    expect(max).toBeGreaterThan(24.85);
  });

  it("does not collapse when all points are equal", () => {
    const { min, max } = paddedRange([20, 20]);
    expect(max).toBeGreaterThan(min);
  });
});

describe("yTicks", () => {
  it("returns inclusive end ticks", () => {
    expect(yTicks(0, 10, 3)).toEqual([0, 5, 10]);
  });
});

describe("nearestIndex", () => {
  it("picks the closest x", () => {
    expect(nearestIndex(48, [10, 40, 90])).toBe(1);
  });
});

describe("labelIndices", () => {
  it("keeps every index when the series is short", () => {
    expect(labelIndices(5)).toEqual([0, 1, 2, 3, 4]);
  });

  it("always keeps first and last when thinning", () => {
    const idx = labelIndices(20, 5);
    expect(idx[0]).toBe(0);
    expect(idx.at(-1)).toBe(19);
    expect(idx).toHaveLength(5);
  });
});
