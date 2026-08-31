import { useEffect, useState } from "react";
import {
  FILLS,
  FILL_COST_XCP,
  FX,
  POSITIONS,
  isBitcoinAddress,
  shortAddress,
  type Position,
  type Timeframe,
} from "./data/fixture";
import {
  CASH_XCP,
  IMPACT_BY_ASSET,
  TIP_BLOCK,
  UNIVERSE_FIXTURE,
} from "./data/universe-fixture";
import {
  applyCostOverrides,
  applyRemainingCost,
  applyLiveHoldings,
  applyLiveLaunchMarks,
  applyLiveMarks,
  archivedTokenNames,
  extraTokenPositions,
  escrowFills,
  escrowPositionsFromFairmints,
  markPrices,
  mergeBook,
  mergeTape,
  mintLoseFills,
  orderFills,
  overlayEscrows,
  overlayHoldings,
  qtyByAssetFromBalances,
  remainingCostByAsset,
  type CoreFairmint,
  type CoreOrder,
} from "./lib/book";
import {
  loadCostOverrides,
  saveCostOverrides,
} from "./lib/costOverrides";
import {
  clearWatchAddress,
  loadWatchAddress,
  loadWatches,
  removeWatch,
  renameWatch,
  sameAddress,
  saveWatchAddress,
  saveWatches,
  upsertWatch,
} from "./lib/watchAddress";
import { fetchAddressBtcSats, fetchFxSpot, forgetCachedXcpFloor } from "./lib/fx";
import { isDustQty } from "./lib/format";
import {
  loadPaidInSats,
  resolvedStartBtcSats,
  savePaidInSats,
} from "./lib/paidIn";
import type { Launch } from "./lib/setups";
import {
  fetchAddressBalances,
  fetchAddressFairmints,
  fetchAddressOrders,
  fetchFairmintersForAssets,
  fetchPooledLaunches,
  fetchPoolMarks,
  fetchTipBlock,
  fetchUniverse,
  impactMapFromLaunches,
  mergeLaunches,
  overlayBook,
  type CoreFairminter,
  type PoolMark,
} from "./lib/universe";
import { Landing } from "./screens/Landing";
import { MarketsScreen } from "./screens/MarketsScreen";
import { PairScreen } from "./screens/PairScreen";
import { PortfolioScreen } from "./screens/PortfolioScreen";
import { WatchesRail } from "./screens/WatchesRail";

export type DeskTab = "portfolio" | "markets" | "pair";

const TABS: { id: DeskTab; label: string }[] = [
  { id: "portfolio", label: "Portfolio" },
  { id: "markets", label: "Markets" },
  { id: "pair", label: "Pair" },
];

const POOL_POLL_MS = 8_000;
const FIXTURE_ASSETS = UNIVERSE_FIXTURE.map((row) => row.asset);
const FIXTURE_TOKEN_NAMES = POSITIONS.filter((p) => p.kind === "token").map(
  (p) => p.asset,
);

type LiveUniverse = {
  launches: Launch[];
  tipBlock: number;
};

export function App() {
  const [input, setInput] = useState(loadWatchAddress);
  const [loaded, setLoaded] = useState(loadWatchAddress);
  const [watches, setWatches] = useState(loadWatches);
  const [timeframe, setTimeframe] = useState<Timeframe>("ALL");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DeskTab>("portfolio");
  const [pairAsset, setPairAsset] = useState<string | null>(null);
  const [live, setLive] = useState<LiveUniverse | null>(null);
  const [tipBlock, setTipBlock] = useState<number | null>(null);
  const [coreUnreachable, setCoreUnreachable] = useState(false);
  const [fairmints, setFairmints] = useState<CoreFairmint[]>([]);
  const [orders, setOrders] = useState<CoreOrder[]>([]);
  const [minterByAsset, setMinterByAsset] = useState<
    Record<string, CoreFairminter>
  >({});
  const [liveCash, setLiveCash] = useState<number | null>(null);
  const [extraTokens, setExtraTokens] = useState<Position[]>([]);
  const [liveQty, setLiveQty] = useState<Record<string, number> | null>(null);
  const [costOverrides, setCostOverrides] = useState<Record<string, number>>(
    {},
  );
  const [liveFx, setLiveFx] = useState(FX);
  const [liveBtcSats, setLiveBtcSats] = useState<number | null>(null);
  const [paidInSats, setPaidInSats] = useState<number | null>(null);
  const [liveMarks, setLiveMarks] = useState<Record<string, PoolMark>>({});
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const liveLoading = live === null && !coreUnreachable;
  const displayTip = tipBlock ?? TIP_BLOCK;
  const startBtcSats = resolvedStartBtcSats(paidInSats, liveBtcSats);
  const heldTokens = new Set(
    Object.entries(liveQty ?? {})
      .filter(([asset, qty]) => asset !== "XCP" && !isDustQty(qty))
      .map(([asset]) => asset),
  );
  const tokenAssets = new Set([
    ...POSITIONS.filter((p) => p.kind === "token").map((p) => p.asset),
    ...heldTokens,
  ]);
  const escrows =
    fairmints.length > 0
      ? escrowPositionsFromFairmints(fairmints, tokenAssets, minterByAsset)
      : POSITIONS.filter((p) => p.kind === "escrow");
  const fills = mergeTape(FILLS, [
    ...escrowFills(fairmints),
    ...mintLoseFills(fairmints, minterByAsset, heldTokens),
    ...orderFills(orders),
  ]);
  const positions = applyCostOverrides(
    applyRemainingCost(
      applyLiveMarks(
        applyLiveHoldings(
          mergeBook(POSITIONS, escrows, liveCash ?? undefined, extraTokens),
          liveQty,
        ),
        markPrices(liveMarks),
      ),
      remainingCostByAsset(fills),
    ),
    costOverrides,
  );
  const cashXcp = liveCash ?? CASH_XCP;
  const baseLaunches = live?.launches ?? UNIVERSE_FIXTURE;
  const tokenRows = positions.filter((p) => p.kind === "token");
  const launches = applyLiveLaunchMarks(
    overlayHoldings(overlayEscrows(baseLaunches, escrows), tokenRows),
    liveMarks,
  );
  const impactByAsset = {
    ...IMPACT_BY_ASSET,
    ...impactMapFromLaunches(launches),
  };
  const archive = archivedTokenNames(
    [
      ...POSITIONS.filter((p) => p.kind === "token").map((p) => p.asset),
      ...extraTokens.map((p) => p.asset),
    ],
    liveQty,
  );

  useEffect(() => {
    if (!loaded) return;
    setCostOverrides(loadCostOverrides(loaded));
    setPaidInSats(loadPaidInSats(loaded));
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    void fetchFxSpot(FX).then((spot) => {
      if (!cancelled) setLiveFx(spot);
    });
    void fetchAddressBtcSats(loaded)
      .then((sats) => {
        if (!cancelled) setLiveBtcSats(sats);
      })
      .catch(() => {
        /* keep last wallet BTC until mempool answers */
      });
    const retryFx = window.setTimeout(() => {
      void fetchFxSpot(FX).then((spot) => {
        if (!cancelled) setLiveFx(spot);
      });
    }, 4000);
    void (async () => {
      setCoreUnreachable(false);
      let tip = TIP_BLOCK;
      try {
        tip = await fetchTipBlock();
        if (!cancelled) setTipBlock(tip);
      } catch {
        /* keep snapshot tip until Core answers */
      }

      try {
        const firstMarks = await fetchPoolMarks(FIXTURE_ASSETS);
        if (!cancelled) {
          setLiveMarks((prev) => ({ ...prev, ...firstMarks }));
        }
      } catch {
        /* fixture names stay recorded until a later poll */
      }

      try {
        const [mints, bals, liveOrders] = await Promise.all([
          fetchAddressFairmints(loaded),
          fetchAddressBalances(loaded),
          fetchAddressOrders(loaded),
        ]);
        if (cancelled) return;
        const cash = bals.find((row) => row.asset === "XCP")?.qty;
        const known = new Set(FIXTURE_TOKEN_NAMES);
        const held = bals.filter((row) => row.asset !== "XCP" && row.qty > 0);
        const minters = await fetchFairmintersForAssets([
          ...mints.map((m) => m.asset),
          ...held.map((row) => row.asset),
          pairAsset ?? "",
        ]);
        if (cancelled) return;
        const marks = await fetchPoolMarks([
          ...FIXTURE_ASSETS,
          ...FIXTURE_TOKEN_NAMES,
          ...held.map((row) => row.asset),
        ]);
        if (cancelled) return;
        setFairmints(mints);
        setOrders(liveOrders);
        setMinterByAsset((prev) => ({ ...prev, ...minters }));
        if (cash != null) setLiveCash(cash);
        setLiveQty(qtyByAssetFromBalances(bals));
        setLiveMarks((prev) => ({ ...prev, ...marks }));
        setExtraTokens(
          extraTokenPositions(bals, known, markPrices(marks), FILL_COST_XCP),
        );
      } catch {
        if (!cancelled) setCoreUnreachable(true);
      }

      try {
        const [xcp69, pooled] = await Promise.all([
          fetchUniverse(tip),
          fetchPooledLaunches().catch(() => [] as Launch[]),
        ]);
        const universe = overlayBook(
          mergeLaunches(xcp69, pooled),
          UNIVERSE_FIXTURE,
        );
        if (cancelled) return;
        setLive({ launches: universe, tipBlock: tip });
        setCoreUnreachable(false);
      } catch {
        if (!cancelled) setLive(null);
      }
      if (!cancelled) setRefreshing(false);
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(retryFx);
    };
  }, [loaded, tick]);

  useEffect(() => {
    if (!loaded) return;
    let ticks = 0;
    const id = window.setInterval(() => {
      ticks += 1;
      void fetchTipBlock()
        .then((tip) => setTipBlock(tip))
        .catch(() => {
          /* keep last tip */
        });
      void fetchAddressBalances(loaded)
        .then(async (bals) => {
          const cash = bals.find((row) => row.asset === "XCP")?.qty;
          if (cash != null) setLiveCash(cash);
          setLiveQty(qtyByAssetFromBalances(bals));
          const held = bals
            .filter((row) => row.asset !== "XCP" && !isDustQty(row.qty))
            .map((row) => row.asset);
          try {
            const marks = await fetchPoolMarks([
              ...FIXTURE_ASSETS,
              ...held,
              ...(pairAsset ? [pairAsset] : []),
            ]);
            if (Object.keys(marks).length > 0) {
              setLiveMarks((prev) => ({ ...prev, ...marks }));
            }
            setExtraTokens(
              extraTokenPositions(
                bals,
                new Set(FIXTURE_TOKEN_NAMES),
                markPrices(marks),
                FILL_COST_XCP,
              ),
            );
          } catch {
            setExtraTokens(
              extraTokenPositions(
                bals,
                new Set(FIXTURE_TOKEN_NAMES),
                {},
                FILL_COST_XCP,
              ),
            );
          }
          try {
            const [mints, liveOrders] = await Promise.all([
              fetchAddressFairmints(loaded),
              fetchAddressOrders(loaded),
            ]);
            const minters = await fetchFairmintersForAssets([
              ...mints.map((m) => m.asset),
              ...bals
                .filter((row) => row.asset !== "XCP" && row.qty > 0)
                .map((row) => row.asset),
              pairAsset ?? "",
            ]);
            setFairmints(mints);
            setOrders(liveOrders);
            setMinterByAsset((prev) => ({ ...prev, ...minters }));
          } catch {
            /* keep last mints until Core answers */
          }
        })
        .catch(() => {
          /* keep last live qty until Core answers */
        });
      if (ticks % 3 === 0) {
        void fetchFxSpot(FX).then(setLiveFx);
      }
      void fetchAddressBtcSats(loaded)
        .then(setLiveBtcSats)
        .catch(() => {
          /* keep last wallet BTC */
        });
    }, POOL_POLL_MS);
    return () => window.clearInterval(id);
  }, [loaded, live, pairAsset]);

  function reloadPrices() {
    if (!loaded || refreshing) return;
    forgetCachedXcpFloor();
    setRefreshing(true);
    setTick((n) => n + 1);
  }

  function persistWatches(next: typeof watches) {
    saveWatches(next);
    setWatches(next);
  }

  function rememberWatch(addr: string, name?: string) {
    const existing = watches.find((w) => sameAddress(w.address, addr));
    persistWatches(upsertWatch(watches, addr, name ?? existing?.name ?? ""));
  }

  function openBook(addr: string) {
    saveWatchAddress(addr);
    setInput(addr);
    setError(null);
    setLoaded(addr);
    setSelected(null);
    setTab("portfolio");
    setPairAsset(null);
    setLive(null);
    setFairmints([]);
    setOrders([]);
    setMinterByAsset({});
    setLiveCash(null);
    setExtraTokens([]);
    setLiveQty(null);
    setLiveMarks({});
    setLiveBtcSats(null);
    setPaidInSats(null);
    setTick((n) => n + 1);
  }

  function load() {
    const addr = input.trim();
    if (!addr) {
      setError("Paste a Bitcoin address.");
      setLoaded("");
      return;
    }
    if (!isBitcoinAddress(addr)) {
      setError("Not a Bitcoin address.");
      setLoaded("");
      return;
    }
    rememberWatch(addr);
    openBook(addr);
  }

  function addWatch(address: string, name: string): string | null {
    const addr = address.trim();
    if (!addr) return "Paste a Bitcoin address.";
    if (!isBitcoinAddress(addr)) return "Not a Bitcoin address.";
    const existing = watches.find((w) => sameAddress(w.address, addr));
    const next = upsertWatch(watches, addr, name || existing?.name || "");
    if (!next.some((w) => sameAddress(w.address, addr))) {
      return "Watch list is full (24).";
    }
    persistWatches(next);
    openBook(addr);
    return null;
  }

  function editWatchName(address: string, name: string) {
    persistWatches(renameWatch(watches, address, name));
  }

  function dropWatch(address: string) {
    const next = removeWatch(watches, address);
    persistWatches(next);
    if (!loaded || !sameAddress(loaded, address)) return;
    const fallback = next[0];
    if (fallback) {
      openBook(fallback.address);
      return;
    }
    clearWatchAddress();
    setLoaded("");
    setInput("");
  }

  function toggleAsset(asset: string) {
    setSelected((cur) => (cur === asset ? null : asset));
  }

  function openPair(asset: string) {
    setPairAsset(asset);
    setTab("pair");
  }

  function openSetups() {
    setTab("markets");
  }

  function setAssetCost(asset: string, costXcp: number | null) {
    if (!loaded) return;
    setCostOverrides((prev) => {
      const next = { ...prev };
      if (costXcp == null) delete next[asset];
      else next[asset] = costXcp;
      saveCostOverrides(loaded, next);
      return next;
    });
  }

  function setPaidIn(sats: number | null) {
    if (!loaded) return;
    savePaidInSats(loaded, sats);
    setPaidInSats(sats);
  }

  function openPortfolio(asset: string) {
    setSelected(asset);
    setTab("portfolio");
  }

  function goTab(next: DeskTab) {
    if (next === "pair" && !pairAsset) {
      const fallback = tokenRows[0]?.asset ?? launches[0]?.asset;
      if (fallback) setPairAsset(fallback);
    }
    setTab(next);
  }

  const rail = (
    <WatchesRail
      watches={watches}
      loaded={loaded}
      error={error}
      onOpen={(addr) => {
        rememberWatch(addr);
        openBook(addr);
      }}
      onAdd={addWatch}
      onRename={editWatchName}
      onRemove={dropWatch}
    />
  );

  if (!loaded) {
    return (
      <div className="shell">
        {rail}
        <div className="app">
          <Landing
            input={input}
            error={error}
            onChange={setInput}
            onLoad={load}
          />
        </div>
      </div>
    );
  }

  const activePair = pairAsset ?? "";

  return (
    <div className="shell">
      {rail}
      <div className="app">
      <div className="top">
        <div>
          <div className="brand">XCP Book</div>
          <h1>
            {tab === "pair" ? `${activePair}/XCP` : TABS.find((t) => t.id === tab)?.label}
          </h1>
        </div>
        <div className="meta">
          <div>
            {shortAddress(loaded)} · blk {displayTip.toLocaleString()} ·{" "}
            {Object.keys(liveMarks).length > 0 ? "live pools" : "recorded"}
            {coreUnreachable ? " · book fallback" : liveLoading ? " · loading markets" : ""}
            {refreshing ? " · reloading" : ""}
          </div>
          <button
            type="button"
            className="btn"
            disabled={refreshing}
            onClick={reloadPrices}
          >
            {refreshing ? "Reloading…" : "Reload prices"}
          </button>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? "on" : ""}`}
            onClick={() => goTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="address-bar">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          spellCheck={false}
        />
        <button className="btn primary" onClick={load}>
          Load
        </button>
        <button
          className="btn"
          onClick={() => {
            clearWatchAddress();
            setLoaded("");
            setInput("");
            setSelected(null);
            setTab("portfolio");
            setPairAsset(null);
          }}
        >
          Clear
        </button>
      </div>

      {tab === "portfolio" ? (
        <PortfolioScreen
          timeframe={timeframe}
          selected={selected}
          positions={positions}
          archive={archive}
          fills={fills}
          fx={liveFx}
          liveBtcSats={liveBtcSats}
          paidInSats={paidInSats}
          startBtcSats={startBtcSats}
          onTimeframe={setTimeframe}
          onToggleAsset={toggleAsset}
          onOpenPair={openPair}
          onOpenSetups={openSetups}
          onCostOverride={setAssetCost}
          onPaidIn={setPaidIn}
          launches={launches}
          minters={minterByAsset}
        />
      ) : null}
      {tab === "markets" ? (
        <MarketsScreen
          onOpenPair={openPair}
          launches={launches}
          tipBlock={displayTip}
          impactByAsset={impactByAsset}
          coreUnreachable={coreUnreachable}
          liveLoading={liveLoading}
          cashXcp={cashXcp}
        />
      ) : null}
      {tab === "pair" ? (
        <PairScreen
          asset={activePair}
          launches={launches}
          tipBlock={displayTip}
          impactByAsset={impactByAsset}
          positions={positions}
          fills={fills}
          minters={minterByAsset}
          onOpenPortfolio={openPortfolio}
          onOpenPair={openPair}
        />
      ) : null}
      </div>
    </div>
  );
}
