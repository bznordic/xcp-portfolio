import { describe, expect, it } from "vitest";
import { isXcp69 } from "../src/lib/xcp69";

/** Canonical XCP-69 fairminter integers (pool 31M, soft 69M, price 1e6). */
const SAMPLE_XCP69 = {
  pool_quantity: 3100000000000000,
  soft_cap: 6900000000000000,
  hard_cap: 10000000000000000,
  quantity_by_price: 100000000000,
  price: 1000000,
  max_mint_per_address: 100000000000000,
  max_mint_per_tx: 100000000000000,
  premint_quantity: 0,
  minted_asset_commission_int: 0,
  lock_quantity: true,
  lock_description: true,
  divisible: true,
  burn_payment: false,
  asset: "SAMPLEESCROW",
  start_block: 100000,
  end_block: 0,
  soft_cap_deadline_block: 101000,
  status: "open",
};

describe("isXcp69", () => {
  it("accepts a fairminter row on the XCP-69 template", () => {
    expect(isXcp69(SAMPLE_XCP69)).toBe(true);
  });

  it("rejects a row that differs on a template integer", () => {
    expect(isXcp69({ ...SAMPLE_XCP69, price: 10000000 })).toBe(false);
    expect(isXcp69({ ...SAMPLE_XCP69, asset: "A95428956661682177" })).toBe(false);
  });
});
