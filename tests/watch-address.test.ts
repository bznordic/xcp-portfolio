import { describe, expect, it } from "vitest";
import {
  parseWatchAddress,
  parseWatches,
  removeWatch,
  renameWatch,
  seedWatches,
  upsertWatch,
} from "../src/lib/watchAddress";

const SAMPLE = "bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297";
const SAMPLE2 = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";

describe("parseWatchAddress", () => {
  it("keeps a valid Bitcoin address", () => {
    expect(parseWatchAddress(SAMPLE)).toBe(SAMPLE);
  });

  it("trims whitespace", () => {
    expect(parseWatchAddress(`  ${SAMPLE}  `)).toBe(SAMPLE);
  });

  it("drops empty or invalid values", () => {
    expect(parseWatchAddress(null)).toBe("");
    expect(parseWatchAddress("")).toBe("");
    expect(parseWatchAddress("not-an-address")).toBe("");
    expect(parseWatchAddress("bc1pshort")).toBe("");
  });
});

describe("parseWatches", () => {
  it("reads named watches and drops junk", () => {
    expect(
      parseWatches(
        JSON.stringify([
          { name: "Mine", address: SAMPLE },
          { name: "Bad", address: "nope" },
          { name: "  ", address: SAMPLE2 },
        ]),
      ),
    ).toEqual([
      { name: "Mine", address: SAMPLE },
      { name: "bc1qw508d6qe…v8f3t4", address: SAMPLE2 },
    ]);
    expect(parseWatches(null)).toEqual([]);
    expect(parseWatches("{")).toEqual([]);
  });
});

describe("upsertWatch", () => {
  it("adds a named book and updates the name on the same address", () => {
    const one = upsertWatch([], SAMPLE, "Mine");
    expect(one).toEqual([{ name: "Mine", address: SAMPLE }]);
    expect(upsertWatch(one, SAMPLE, "Desk")).toEqual([
      { name: "Desk", address: SAMPLE },
    ]);
    expect(upsertWatch(one, SAMPLE2, "Other")).toEqual([
      { name: "Mine", address: SAMPLE },
      { name: "Other", address: SAMPLE2 },
    ]);
  });
});

describe("renameWatch / removeWatch", () => {
  it("renames and removes by address", () => {
    const list = [
      { name: "Mine", address: SAMPLE },
      { name: "Other", address: SAMPLE2 },
    ];
    expect(renameWatch(list, SAMPLE, "Home")).toEqual([
      { name: "Home", address: SAMPLE },
      { name: "Other", address: SAMPLE2 },
    ]);
    expect(removeWatch(list, SAMPLE)).toEqual([
      { name: "Other", address: SAMPLE2 },
    ]);
  });
});

describe("seedWatches", () => {
  it("promotes a leftover current address into the list", () => {
    expect(seedWatches([], SAMPLE)).toEqual([
      { name: "bc1p5d7rjq7g…xg3297", address: SAMPLE },
    ]);
    expect(seedWatches([{ name: "Mine", address: SAMPLE2 }], SAMPLE)).toEqual([
      { name: "Mine", address: SAMPLE2 },
    ]);
  });
});
