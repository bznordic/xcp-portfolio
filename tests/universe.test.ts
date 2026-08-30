import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_UNIVERSE as UNIVERSE_FIXTURE } from "./sample-desk";
import type { Launch } from "../src/lib/setups";
import {
  fetchAddressOrders,
  fetchPooledLaunches,
  fetchPoolMarks,
  fetchFairminter,
  fetchTipBlock,
  fetchUniverse,
  impactFromPool,
  launchFromPoolRow,
  mergeLaunches,
  overlayBook,
  poolMarkFromRow,
  poolRowFromCoreResult,
  toLaunch,
  type CoreFairminter,
  type PoolRow,
} from "../src/lib/universe";

const TIP = 964404;

const XCP69_FAIRMINTER: CoreFairminter = {
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
  asset: "SAMPLEGAMMA",
  status: "closed",
  earned_quantity: 6900000000000000,
};

const GRAD_POOL: PoolRow = {
  reserve_a: 1e15,
  reserve_b: 633_35e8,
};

function fairminterPage(rows: CoreFairminter[]) {
  return { ok: true, json: async () => ({ result: rows }) };
}

function emptyFairminterPage() {
  return fairminterPage([]);
}

describe("toLaunch blocksSinceOpen", () => {
  it("leaves blocksSinceOpen null when graduated with no settlement block", () => {
    const launch = toLaunch(XCP69_FAIRMINTER, GRAD_POOL, TIP);
    expect(launch.status).toBe("graduated");
    expect(launch.blocksSinceOpen).toBeNull();
  });

  it("computes blocksSinceOpen from pool block_index", () => {
    const pool: PoolRow = { ...GRAD_POOL, block_index: 964400 };
    const launch = toLaunch(XCP69_FAIRMINTER, pool, TIP);
    expect(launch.blocksSinceOpen).toBe(4);
  });

  it("computes blocksSinceOpen from fairminter block_index when pool lacks it", () => {
    const fm: CoreFairminter = { ...XCP69_FAIRMINTER, block_index: 964401 };
    const launch = toLaunch(fm, GRAD_POOL, TIP);
    expect(launch.blocksSinceOpen).toBe(3);
  });
});

describe("fetchUniverse", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects when pending fetch fails", async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.includes("status=pending")) {
        return Promise.resolve({ ok: false, status: 503 } as Response);
      }
      if (url.includes("status=open") || url.includes("status=closed")) {
        return Promise.resolve(emptyFairminterPage() as Response);
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    await expect(fetchUniverse(TIP)).rejects.toThrow(/core.*pending/i);
  });

  it("rejects when open fetch fails", async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.includes("status=open")) {
        return Promise.resolve({ ok: false, status: 503 } as Response);
      }
      if (url.includes("status=closed") || url.includes("status=pending")) {
        return Promise.resolve(emptyFairminterPage() as Response);
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    await expect(fetchUniverse(TIP)).rejects.toThrow(/core.*open/i);
  });

  it("rejects when closed fetch fails", async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.includes("status=closed")) {
        return Promise.resolve({ ok: false, status: 503 } as Response);
      }
      if (url.includes("status=open") || url.includes("status=pending")) {
        return Promise.resolve(emptyFairminterPage() as Response);
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    await expect(fetchUniverse(TIP)).rejects.toThrow(/core.*closed/i);
  });

  it("maps XCP-69 fairminters when all Core fetches succeed", async () => {
    const openRow: CoreFairminter = {
      ...XCP69_FAIRMINTER,
      asset: "SAMPLEESCROW",
      status: "open",
      earned_quantity: 540_000_000_000_000,
      soft_cap_deadline_block: 965378,
    };

    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.includes("status=open")) {
        return Promise.resolve(fairminterPage([openRow]) as Response);
      }
      if (url.includes("status=closed") || url.includes("status=pending")) {
        return Promise.resolve(emptyFairminterPage() as Response);
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    const launches = await fetchUniverse(TIP);
    expect(launches).toHaveLength(1);
    expect(launches[0]?.asset).toBe("SAMPLEESCROW");
    expect(launches[0]?.status).toBe("minting");
  });
});

describe("fetchFairminter", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the latest row for an asset", async () => {
    const closed: CoreFairminter = {
      ...XCP69_FAIRMINTER,
      asset: "LEECHES",
      status: "closed",
      block_index: 964526,
      end_block: 0,
    };
    vi.mocked(fetch).mockResolvedValue(fairminterPage([closed]) as Response);
    const row = await fetchFairminter("LEECHES");
    expect(row?.asset).toBe("LEECHES");
    expect(row?.status).toBe("closed");
    expect(row?.block_index).toBe(964526);
  });

  it("returns null on 404", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await fetchFairminter("MISSING")).toBeNull();
  });
});

function coreLaunch(asset: string, overrides: Partial<Launch> = {}): Launch {
  return {
    asset,
    status: "graduated",
    mark: 0.00001,
    poolXcp: 500,
    fill: 1,
    blocksLeft: null,
    blocksSinceOpen: 1,
    issuer: "unknown",
    you: "none",
    youSleeveWt: 0,
    youMintPaidXcp: 0,
    ...overrides,
  };
}

describe("overlayBook", () => {
  it("copies fixture you fields onto a matching Core name", () => {
    const [overlaid] = overlayBook(
      [coreLaunch("SAMPLEALPHA")],
      UNIVERSE_FIXTURE,
    );
    expect(overlaid?.you).toBe("held");
    expect(overlaid?.youSleeveWt).toBe(0.419);
    expect(overlaid?.youMintPaidXcp).toBe(0);
  });

  it("leaves unknown Core names as none/0", () => {
    const [overlaid] = overlayBook(
      [coreLaunch("LIVEONLY")],
      UNIVERSE_FIXTURE,
    );
    expect(overlaid?.you).toBe("none");
    expect(overlaid?.youSleeveWt).toBe(0);
    expect(overlaid?.youMintPaidXcp).toBe(0);
  });
});

describe("launchFromPoolRow", () => {
  it("lists PEPECASH from a TOKEN/XCP pool, not as an XCP-69 mint", () => {
    const launch = launchFromPoolRow({
      asset_a: "PEPECASH",
      asset_b: "XCP",
      reserve_a: 42941031344044,
      reserve_b: 67065655475,
      block_index: 964603,
    });
    expect(launch).toMatchObject({
      asset: "PEPECASH",
      status: "listed",
      fill: null,
      blocksSinceOpen: null,
    });
    expect(launch?.mark).toBeCloseTo(67065655475 / 42941031344044, 16);
    expect(launch?.poolXcp).toBeCloseTo(670.65655475, 8);
  });

  it("skips non-XCP pools", () => {
    expect(
      launchFromPoolRow({
        asset_a: "PEPECASH",
        asset_b: "BTC",
        reserve_a: 1,
        reserve_b: 1,
      }),
    ).toBeNull();
  });
});

describe("mergeLaunches", () => {
  it("keeps the XCP-69 row and adds PEPECASH from the pool list", () => {
    const gooby = coreLaunch("SAMPLEGAMMA");
    const pepe = launchFromPoolRow({
      asset_a: "PEPECASH",
      asset_b: "XCP",
      reserve_a: 42941031344044,
      reserve_b: 67065655475,
    })!;
    const merged = mergeLaunches([gooby], [pepe, { ...gooby, mark: 9 }]);
    expect(merged.find((l) => l.asset === "SAMPLEGAMMA")?.mark).toBe(gooby.mark);
    expect(merged.some((l) => l.asset === "PEPECASH" && l.status === "listed")).toBe(
      true,
    );
  });
});

describe("poolMarkFromRow", () => {
  it("prices SAMPLEGAMMA from live Core reserves, not the recorded fixture", () => {
    const mark = poolMarkFromRow({
      reserve_a: 3339978198630078,
      reserve_b: 64435441794,
      block_index: 964444,
    });
    expect(mark).not.toBeNull();
    expect(mark!.priceXcp).toBeCloseTo(64435441794 / 3339978198630078, 16);
    expect(mark!.poolXcp).toBeCloseTo(644.35441794, 8);
    expect(mark!.block).toBe(964444);
    expect(mark!.priceXcp).not.toBeCloseTo(0.00001864, 8);
  });

  it("returns null when token reserve is empty", () => {
    expect(poolMarkFromRow({ reserve_a: 0, reserve_b: 1e8 })).toBeNull();
  });
});

describe("fetchPooledLaunches", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps Core /v2/pools pages into listed launches", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: [
          {
            asset_a: "PEPECASH",
            asset_b: "XCP",
            reserve_a: 42941031344044,
            reserve_b: 67065655475,
          },
        ],
      }),
    } as Response);

    const launches = await fetchPooledLaunches();
    expect(launches.map((l) => l.asset)).toEqual(["PEPECASH"]);
    expect(launches[0]?.status).toBe("listed");
    expect(fetch).toHaveBeenCalledWith("/core/v2/pools?verbose=true");
  });

  it("still lists SAMPLEDEEP/XCP when meme-meme and empty sibling pools come first", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: [
          {
            asset_a: "SAMPLEDEEP",
            asset_b: "SAMPLEPEER",
            reserve_a: 2500000000000,
            reserve_b: 6717500000000,
          },
          {
            asset_a: "SAMPLEDEEP",
            asset_b: "SAMPLESIBLING",
            reserve_a: 0,
            reserve_b: 0,
          },
          {
            asset_a: "SAMPLEDEEP",
            asset_b: "XCP",
            reserve_a: 3239873177403147,
            reserve_b: 470907234834,
          },
        ],
      }),
    } as Response);

    const launches = await fetchPooledLaunches();
    expect(launches.map((l) => l.asset)).toEqual(["SAMPLEDEEP"]);
    expect(launches[0]?.mark).toBeCloseTo(
      470907234834 / 3239873177403147,
      16,
    );
  });
});

describe("poolRowFromCoreResult", () => {
  it("picks the TOKEN/XCP pool, not an empty or meme-meme sibling", () => {
    const row = poolRowFromCoreResult([
      {
        asset_a: "SAMPLEDEEP",
        asset_b: "SAMPLEPEER",
        reserve_a: 2500000000000,
        reserve_b: 6717500000000,
      },
      {
        asset_a: "SAMPLEDEEP",
        asset_b: "SAMPLESIBLING",
        reserve_a: 0,
        reserve_b: 0,
      },
      {
        asset_a: "SAMPLEDEEP",
        asset_b: "XCP",
        reserve_a: 3239873177403147,
        reserve_b: 470907234834,
      },
    ]);
    expect(row).toMatchObject({
      asset_a: "SAMPLEDEEP",
      asset_b: "XCP",
      reserve_b: 470907234834,
    });
  });
});

describe("fetchPoolMarks", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps a good pool when a sibling fetch fails", async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/pools/SAMPLEGAMMA/XCP")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            result: {
              reserve_a: 3339978198630078,
              reserve_b: 64435441794,
              block_index: 964444,
            },
          }),
        } as Response);
      }
      if (url.includes("/pools/MISSING/XCP")) {
        return Promise.resolve({ ok: false, status: 500 } as Response);
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    const marks = await fetchPoolMarks(["SAMPLEGAMMA", "MISSING"]);
    expect(marks.SAMPLEGAMMA?.poolXcp).toBeCloseTo(644.35441794, 8);
    expect(marks.MISSING).toBeUndefined();
  });
});

describe("impactFromPool", () => {
  it("is 1 XCP / pool XCP and omits names with no pool", () => {
    expect(impactFromPool(633.35)).toBeCloseTo(0.00158, 5);
    expect(impactFromPool(null)).toBeUndefined();
    expect(impactFromPool(0)).toBeUndefined();
  });
});

describe("fetchTipBlock", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps block_index from GET /v2/blocks?limit=1", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ result: [{ block_index: 964500 }] }),
    } as Response);

    await expect(fetchTipBlock()).resolves.toBe(964500);
    expect(fetch).toHaveBeenCalledWith("/core/v2/blocks?limit=1");
  });

  it("rejects on HTTP error", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);

    await expect(fetchTipBlock()).rejects.toThrow(/core.*blocks/i);
  });

  it("rejects when block_index is missing", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ result: [] }),
    } as Response);

    await expect(fetchTipBlock()).rejects.toThrow(/block_index/i);
  });
});

describe("fetchAddressOrders", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pages filled TOKEN/XCP orders from Core", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: [
          {
            tx_hash: "sell-naka",
            block_index: 964603,
            status: "filled",
            give_asset: "NAKAMOTOFUN",
            get_asset: "XCP",
            give_quantity_normalized: "200000.00000000",
            get_quantity_normalized: "3.00000000",
          },
        ],
      }),
    } as Response);

    const rows = await fetchAddressOrders("bc1p1");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.give_asset).toBe("NAKAMOTOFUN");
    expect(fetch).toHaveBeenCalledWith(
      "/core/v2/addresses/bc1p1/orders?verbose=true",
    );
  });
});
