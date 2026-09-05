import { describe, expect, it } from "vitest";
import { CORE_POLL_MS } from "../src/lib/poll";

describe("CORE_POLL_MS", () => {
  it("refreshes Core no more than once per two minutes", () => {
    expect(CORE_POLL_MS).toBe(120_000);
  });
});
