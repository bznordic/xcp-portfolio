import { describe, expect, it } from "vitest";
import { parseCostOverrides } from "../src/lib/costOverrides";

describe("parseCostOverrides", () => {
  it("reads a SAMPLEDEEP 2 XCP overwrite", () => {
    expect(parseCostOverrides('{"SAMPLEDEEP":2}')).toEqual({ SAMPLEDEEP: 2 });
  });

  it("drops invalid and empty values", () => {
    expect(parseCostOverrides(null)).toEqual({});
    expect(parseCostOverrides("{")).toEqual({});
    expect(parseCostOverrides('{"SAMPLEGAMMA":-1,"SEIS":"x","OK":1.5}')).toEqual({
      OK: 1.5,
    });
  });
});
