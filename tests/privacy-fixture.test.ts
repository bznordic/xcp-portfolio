import { describe, expect, it } from "vitest";
import { FILL_COST_XCP, FILLS, POSITIONS } from "../src/data/fixture";
import { UNIVERSE_FIXTURE } from "../src/data/universe-fixture";

describe("shipped fixtures", () => {
  it("does not bake a personal token book into the client", () => {
    expect(POSITIONS.filter((p) => p.kind !== "cash")).toEqual([]);
    expect(FILLS).toEqual([]);
    expect(FILL_COST_XCP).toEqual({});
  });

  it("does not bake held names into the markets snapshot", () => {
    expect(UNIVERSE_FIXTURE).toEqual([]);
    expect(UNIVERSE_FIXTURE.every((l) => l.you === "none")).toBe(true);
  });
});
