import { useEffect, useState, type MouseEvent } from "react";
import {
  WINDOWS,
  type EquityPoint,
  type Fill,
  type Position,
  type Timeframe,
} from "../data/fixture";
import {
  holdingQuote,
  liveEquityWindow,
  assetIsXcp69,
  mintPriceXcpFor,
  vsMintLabel,
  realizedFromFills,
  tradingPnlXcp,
} from "../lib/book";
import type { Launch } from "../lib/setups";
import {
  labelIndices,
  nearestIndex,
  paddedRange,
  yTicks,
} from "../lib/chart";
import {
  feeSatsBurned,
  liquidationSats,
  netSatsAfterFees,
  satsToUsd,
  type FxSpot,
} from "../lib/fx";
import {
  fmtBtc,
  fmtPct,
  fmtPrice,
  fmtQty,
  fmtSats,
  fmtSigned,
  fmtSignedSats,
  fmtUsd,
  fmtXcp,
  isDustQty,
} from "../lib/format";
import { CASH_BUFFER_XCP, type Xcp69Fairminter } from "../lib/xcp69";
import { fmtPaidInBtc, parsePaidInToSats } from "../lib/paidIn";
import { xcpFunOrderLabel } from "../lib/xcpFun";
import { OrderLink } from "./OrderLink";
import { TokenArt } from "./TokenArt";
import { TokenLedger } from "./TokenLedger";

function tone(n: number): string {
  if (n > 0) return "up";
  if (n < 0) return "down";
  return "muted";
}

function CostEdit({
  asset,
  costXcp,
  display,
  onSave,
}: {
  asset: string;
  costXcp: number;
  display: React.ReactNode;
  onSave: (asset: string, costXcp: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function start(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(String(costXcp));
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const t = draft.trim();
    if (t === "") {
      onSave(asset, null);
      return;
    }
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return;
    onSave(asset, n);
  }

  if (editing) {
    return (
      <input
        className="cost-edit"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        aria-label={`${asset} cost in XCP`}
      />
    );
  }

  return (
    <button
      type="button"
      className="cost-btn"
      title={`Total cost ${fmtXcp(costXcp)} XCP. Click to overwrite.`}
      onClick={start}
    >
      {display}
    </button>
  );
}

function PaidInField({
  paidInSats,
  liveBtcSats,
  onPaidIn,
}: {
  paidInSats: number | null;
  liveBtcSats: number | null;
  onPaidIn: (sats: number | null) => void;
}) {
  const [draft, setDraft] = useState(
    paidInSats == null ? "" : fmtPaidInBtc(paidInSats),
  );

  useEffect(() => {
    setDraft(paidInSats == null ? "" : fmtPaidInBtc(paidInSats));
  }, [paidInSats]);

  function commit() {
    const t = draft.trim();
    if (t === "") {
      onPaidIn(null);
      return;
    }
    const sats = parsePaidInToSats(t);
    if (sats == null) {
      setDraft(paidInSats == null ? "" : fmtPaidInBtc(paidInSats));
      return;
    }
    onPaidIn(sats);
  }

  return (
    <label className="paid-in-label">
      Paid in
      <input
        className="paid-in"
        inputMode="decimal"
        spellCheck={false}
        placeholder={
          liveBtcSats == null ? "wallet BTC" : fmtPaidInBtc(liveBtcSats)
        }
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(paidInSats == null ? "" : fmtPaidInBtc(paidInSats));
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label="Paid-in BTC. Empty uses the watched address UTXO."
      />
    </label>
  );
}

function EquityChart({
  points,
  basisXcp,
}: {
  points: EquityPoint[];
  basisXcp?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 640;
  const h = 220;
  const pad = { l: 52, r: 58, t: 18, b: 34 };
  const last = points[points.length - 1];
  const first = points[0];
  if (!first || !last) return null;

  const values = points.map((p) => p.markXcp);
  if (basisXcp != null) values.push(basisXcp);
  const { min, max } = paddedRange(values);
  const span = max - min || 1;
  const x = (i: number) =>
    pad.l + (i / Math.max(points.length - 1, 1)) * (w - pad.l - pad.r);
  const y = (v: number) =>
    pad.t + (1 - (v - min) / span) * (h - pad.t - pad.b);
  const xs = points.map((_, i) => x(i));
  const line = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.markXcp).toFixed(1)}`,
    )
    .join(" ");
  const area = `${line} L ${x(points.length - 1).toFixed(1)} ${h - pad.b} L ${x(0).toFixed(1)} ${h - pad.b} Z`;
  const delta = last.markXcp - first.markXcp;
  const up = delta >= 0;
  const stroke = up ? "#3dd68c" : "#f07178";
  const ticks = yTicks(min, max, 4);
  const shown = new Set(labelIndices(points.length, 5));
  const active = hover ?? points.length - 1;
  const focus = points[active];
  const vsOpenPct =
    first.markXcp !== 0 ? (delta / first.markXcp) * 100 : null;

  function onMove(e: MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * w;
    setHover(nearestIndex(mx, xs));
  }

  return (
    <div className="chart-wrap">
      <div className="chart-head">
        <div>
          <div className="chart-last">{fmtXcp(last.markXcp)} XCP</div>
          <div className={`chart-delta ${tone(delta)}`}>
            {fmtSigned(delta)}
            {vsOpenPct == null ? "" : ` · ${fmtPct(vsOpenPct)}`} vs open
          </div>
        </div>
        {basisXcp != null ? (
          <div className="chart-basis">cost {fmtXcp(basisXcp)} XCP</div>
        ) : null}
      </div>
      <svg
        className="chart"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`Equity ${fmtXcp(last.markXcp)} XCP`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={pad.l}
              x2={w - pad.r}
              y1={y(t)}
              y2={y(t)}
              stroke="#2a2b2e"
              strokeDasharray="3 4"
            />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end">
              {t.toFixed(2)}
            </text>
          </g>
        ))}
        {basisXcp != null ? (
          <g>
            <line
              x1={pad.l}
              x2={w - pad.r}
              y1={y(basisXcp)}
              y2={y(basisXcp)}
              stroke="#8b8d92"
              strokeDasharray="5 4"
              strokeWidth="1"
            />
            <text
              x={w - pad.r + 4}
              y={y(basisXcp) + 3}
              className="chart-ref"
            >
              cost
            </text>
          </g>
        ) : null}
        <path d={area} fill="url(#eq-fill)" />
        <path d={line} fill="none" stroke={stroke} strokeWidth="1.8" />
        {points.map((p, i) => (
          <circle
            key={`${p.day}-${i}`}
            cx={x(i)}
            cy={y(p.markXcp)}
            r={i === active ? 4 : 2.6}
            fill={stroke}
          />
        ))}
        <text
          x={x(points.length - 1) + 8}
          y={y(last.markXcp) + 4}
          className="chart-end"
        >
          {last.markXcp.toFixed(2)}
        </text>
        {hover != null && focus ? (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={pad.t}
            y2={h - pad.b}
            stroke="#c8cdd6"
            strokeOpacity="0.35"
          />
        ) : null}
        {points.map((p, i) =>
          shown.has(i) ? (
            <text
              key={`x-${p.day}-${i}`}
              x={x(i)}
              y={h - 8}
              textAnchor={
                i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"
              }
            >
              {p.day}
            </text>
          ) : null,
        )}
      </svg>
      {hover != null && focus ? (
        <div
          className="chart-tip"
          style={{
            left: `${Math.min(88, Math.max(12, (x(hover) / w) * 100))}%`,
          }}
        >
          <div className="k">{focus.day}</div>
          <div>{fmtXcp(focus.markXcp)} XCP</div>
          {basisXcp != null ? (
            <div className={tone(focus.markXcp - basisXcp)}>
              {fmtSigned(focus.markXcp - basisXcp)} vs cost
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PortfolioScreen({
  timeframe,
  selected,
  positions,
  archive = [],
  fills,
  fx,
  liveBtcSats = null,
  paidInSats = null,
  startBtcSats = null,
  onTimeframe,
  onToggleAsset,
  onOpenPair,
  onOpenSetups,
  onCostOverride,
  onPaidIn,
  launches = [],
  minters = {},
}: {
  timeframe: Timeframe;
  selected: string | null;
  positions: Position[];
  archive?: string[];
  fills: Fill[];
  fx: FxSpot;
  liveBtcSats?: number | null;
  paidInSats?: number | null;
  startBtcSats?: number | null;
  onTimeframe: (tf: Timeframe) => void;
  onToggleAsset: (asset: string) => void;
  onOpenPair: (asset: string) => void;
  onOpenSetups: () => void;
  onCostOverride: (asset: string, costXcp: number | null) => void;
  onPaidIn: (sats: number | null) => void;
  launches?: Launch[];
  minters?: Record<string, Xcp69Fairminter>;
}) {
  const totalXcp = positions.reduce((s, p) => s + p.markXcp, 0);
  const window = liveEquityWindow(
    WINDOWS[timeframe],
    totalXcp,
    tradingPnlXcp(positions, realizedFromFills(fills)),
  );
  const visible = positions.filter(
    (p) => p.kind !== "cash" && !isDustQty(p.qty),
  );
  const launchByAsset = new Map(launches.map((l) => [l.asset, l]));
  const rows = selected
    ? positions.filter((p) => p.asset === selected)
    : positions.filter((p) => p.kind === "cash" || !isDustQty(p.qty));
  const tape: Fill[] = selected
    ? fills.filter((f) => f.asset === selected || (selected === "XCP" && f.asset === "XCP"))
    : fills;

  const selectedPos = positions.find((p) => p.asset === selected);
  const cashPos = positions.find((p) => p.kind === "cash");
  const cashXcp = cashPos?.markXcp ?? 0;

  const cashMark = positions.filter((p) => p.kind === "cash").reduce(
    (s, p) => s + p.markXcp,
    0,
  );
  const tokenMark = positions.filter((p) => p.kind === "token").reduce(
    (s, p) => s + p.markXcp,
    0,
  );
  const escrowMark = positions.filter((p) => p.kind === "escrow").reduce(
    (s, p) => s + p.markXcp,
    0,
  );
  const cashPct = totalXcp > 0 ? Math.round((cashMark / totalXcp) * 100) : 0;
  const tokenPct = totalXcp > 0 ? Math.round((tokenMark / totalXcp) * 100) : 0;
  const escrowPct = totalXcp > 0 ? Math.round((escrowMark / totalXcp) * 100) : 0;

  const realized = realizedFromFills(fills);
  const tokenRowsForAttr = positions.filter((p) => p.kind === "token");
  const focusToken = [...tokenRowsForAttr].sort(
    (a, b) => Math.abs(b.pnlXcp) - Math.abs(a.pnlXcp),
  )[0];
  const focusRealized = realizedFromFills(
    fills.filter((f) => f.asset === focusToken?.asset),
  );
  const focusAttr = (focusToken?.pnlXcp ?? 0) + focusRealized;
  const otherAttr =
    tokenRowsForAttr
      .filter((p) => p.asset !== focusToken?.asset)
      .reduce((s, p) => s + p.pnlXcp, 0) + (realized - focusRealized);
  const escrowAttr = positions
    .filter((p) => p.kind === "escrow")
    .reduce((s, p) => s + p.pnlXcp, 0);

  const agg = {
    xcp: totalXcp,
    dXcp: window.pnlXcp,
  };
  const intoXcp =
    liveBtcSats == null || startBtcSats == null
      ? 0
      : feeSatsBurned(startBtcSats, liveBtcSats);
  const soldSats =
    liveBtcSats == null
      ? 0
      : liquidationSats({ liveBtcSats, xcp: totalXcp, fx });
  const vsPaidIn =
    liveBtcSats == null || startBtcSats == null
      ? 0
      : netSatsAfterFees({
          liveBtcSats,
          xcp: totalXcp,
          fx,
          startBtcSats,
        });

  return (
    <>
      <div className="pills">
        {(["1D", "7D", "30D", "ALL"] as Timeframe[]).map((tf) => (
          <button
            key={tf}
            className={`pill ${timeframe === tf ? "on" : ""}`}
            onClick={() => onTimeframe(tf)}
          >
            {tf}
          </button>
        ))}
        {selected ? (
          <button className="pill on" onClick={() => onToggleAsset(selected)}>
            {selected} · clear
          </button>
        ) : null}
      </div>

      <div className="hero">
        <div>
          <div className="k">Total · XCP</div>
          <div className="v">{fmtXcp(agg.xcp)} XCP</div>
          <div className={`d ${tone(agg.dXcp)}`}>
            {fmtSigned(agg.dXcp)} · {window.label}
          </div>
        </div>
        <div>
          <div className="k">Wallet BTC</div>
          <div className="v sm">
            {liveBtcSats == null ? "—" : `${fmtBtc(liveBtcSats / 1e8)} BTC`}
          </div>
          <PaidInField
            paidInSats={paidInSats}
            liveBtcSats={liveBtcSats}
            onPaidIn={onPaidIn}
          />
          <div className={`d ${intoXcp > 0 ? "down" : "muted"}`}>
            {liveBtcSats == null || startBtcSats == null
              ? "mempool UTXOs"
              : paidInSats == null
                ? "start = wallet UTXO"
                : `${fmtSignedSats(-intoXcp)} into XCP · ${fmtSats(startBtcSats)}`}
          </div>
        </div>
        <div>
          <div className="k">If sold to BTC</div>
          <div className="v sm">
            {liveBtcSats == null ? "—" : fmtSats(soldSats)}
          </div>
          <div className={`d ${liveBtcSats == null ? "muted" : tone(vsPaidIn)}`}>
            {liveBtcSats == null
              ? "wallet BTC + book at floor"
              : `${fmtSignedSats(vsPaidIn)} vs paid in`}
          </div>
        </div>
        <div>
          <div className="k">Fiat (whole wallet)</div>
          <div className="v sm">
            {liveBtcSats == null
              ? "—"
              : fmtUsd(satsToUsd(soldSats, fx.usdPerBtc))}
          </div>
          <div className={`d ${liveBtcSats == null ? "muted" : tone(vsPaidIn)}`}>
            {liveBtcSats == null
              ? "wallet BTC + book · live USD"
              : `${vsPaidIn >= 0 ? "+" : ""}${fmtUsd(satsToUsd(vsPaidIn, fx.usdPerBtc))} vs paid in`}
          </div>
        </div>
      </div>

      <div className="strip">
        <div className="k">Exposure</div>
        <div className="strip-row">
          cash {cashPct}% <span className="muted">|</span> tokens {tokenPct}%{" "}
          <span className="muted">|</span> escrow {escrowPct}%
        </div>
      </div>

      <div className="strip">
        <div className="k">Attribution</div>
        <div className="strip-row chips">
          {focusToken ? (
            <button className="chip" onClick={() => onOpenPair(focusToken.asset)}>
              {focusToken.asset}{" "}
              <span className={tone(focusAttr)}>{fmtSigned(focusAttr, 2)}</span>
            </button>
          ) : null}
          <span>
            other <span className={tone(otherAttr)}>{fmtSigned(otherAttr, 2)}</span>
          </span>
          <span>
            escrow <span className={tone(escrowAttr)}>{fmtSigned(escrowAttr, 2)}</span>
          </span>
        </div>
      </div>

      {cashXcp > CASH_BUFFER_XCP ? (
        <div className="cta-row">
          <button className="btn primary" onClick={onOpenSetups}>
            Setups for free cash
          </button>
        </div>
      ) : null}

      <div className="grid-2">
        <div className="panel">
          <h2>Equity · XCP · {timeframe}</h2>
          <EquityChart
            points={window.curve}
            basisXcp={totalXcp - window.pnlXcp}
          />
        </div>
        <div className="panel">
          <h2>{selected ? selected : "Sleeve"}</h2>
          {selectedPos ? (
            <>
              <div className="v sm">{fmtXcp(selectedPos.markXcp)} XCP</div>
              <div className={`d ${tone(selectedPos.pnlXcp)}`}>
                {fmtSigned(selectedPos.pnlXcp)} vs cost · {fmtPct(selectedPos.pnlPct)}
              </div>
              <p className="note">
                {selectedPos.kind === "escrow"
                  ? `${fmtXcp(selectedPos.costXcp, 2)} XCP locked in the ${selectedPos.asset} fairmint. Back as XCP if the sale misses, or you get the tokens if it fills.`
                  : selectedPos.kind === "cash"
                    ? "Free XCP on the address after fills and escrow."
                    : selectedPos.costXcp === selectedPos.markXcp &&
                        selectedPos.pnlXcp === 0
                      ? "Marked from the TOKEN/XCP pool. Fill cost not on the tape yet — shown at mark."
                      : "Marked from the TOKEN/XCP pool. Cost is the actual fill, not mint price."}
              </p>
              <div className="cta-row">
                {selectedPos.kind !== "cash" ? (
                  <button className="btn" onClick={() => onOpenPair(selectedPos.asset)}>
                    Open pair
                  </button>
                ) : null}
                {selectedPos.kind !== "cash" ? (
                  <OrderLink
                    asset={selectedPos.asset}
                    label={
                      selectedPos.kind === "escrow"
                        ? xcpFunOrderLabel("mint")
                        : xcpFunOrderLabel("swap")
                    }
                    primary
                  />
                ) : null}
                <button className="btn" onClick={() => onToggleAsset(selectedPos.asset)}>
                  Back to book
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="v sm">{fmtXcp(totalXcp - cashXcp)} XCP</div>
              <div className="d muted">tokens + escrow</div>
              <p className="note">
                Click a tile or blotter row to isolate one name. Memes stay in
                XCP. BTC and USD only live in the strip above.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="section">
        <h2>Holdings · XCP</h2>
        <div className="mosaic">
          {visible.map((p) => {
            const launch = launchByAsset.get(p.asset);
            const q = holdingQuote(
              p,
              mintPriceXcpFor(
                p,
                launch,
                assetIsXcp69(launch, minters[p.asset]),
              ),
            );
            return (
            <div key={p.asset} className={`tile ${selected === p.asset ? "on" : ""}`}>
              <button type="button" className="tile-hit" onClick={() => onToggleAsset(p.asset)}>
                <TokenArt asset={p.asset} size="tile" />
                <div className="cap">
                  <div className="name">
                    {p.asset}
                    {p.kind === "escrow" ? " · escrow" : ""}
                  </div>
                  <div className="stats">
                    <div className="stat">
                      <span className="k">Owned</span>
                      <span>{fmtQty(p.qty)}</span>
                    </div>
                    <div className="stat">
                      <span className="k">Value</span>
                      <span className="mark">{fmtXcp(q.valueXcp)} XCP</span>
                    </div>
                    <div className="stat">
                      <span className="k">Market</span>
                      <span>
                        {q.marketPriceXcp == null
                          ? "—"
                          : `${fmtPrice(q.marketPriceXcp)} XCP / token`}
                      </span>
                    </div>
                    <div className="stat">
                      <span className="k">Paid</span>
                      <CostEdit
                        asset={p.asset}
                        costXcp={p.costXcp}
                        display={
                          q.purchasePriceXcp == null ? (
                            "—"
                          ) : (
                            <>
                              {fmtPrice(q.purchasePriceXcp)} XCP / token
                              <span className="cost-total">
                                {" "}
                                · {fmtXcp(p.costXcp)}
                              </span>
                            </>
                          )
                        }
                        onSave={onCostOverride}
                      />
                    </div>
                    <div className="stat">
                      <span className="k">Mint</span>
                      <span>
                        {q.mintPriceXcp == null
                          ? "—"
                          : `${fmtPrice(q.mintPriceXcp)} XCP / token`}
                      </span>
                    </div>
                    <div className="stat">
                      <span className="k">ROI</span>
                      <span className={tone(q.roiXcp)}>
                        {p.kind === "escrow"
                          ? "—"
                          : `${fmtSigned(q.roiXcp)} XCP · ${fmtPct(q.roiPct)}`}
                      </span>
                    </div>
                    <div className="stat">
                      <span className="k">vs mint</span>
                      <span
                        className={
                          q.vsMintXcp == null ? "muted" : tone(q.vsMintXcp)
                        }
                      >
                        {q.vsMintXcp == null || q.vsMintPct == null
                          ? "—"
                          : vsMintLabel(q.marketPriceXcp!, q.mintPriceXcp!)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
              <button
                type="button"
                className="tile-pair"
                onClick={() => onOpenPair(p.asset)}
              >
                Open pair
              </button>
              <OrderLink
                asset={p.asset}
                className="tile-pair"
                label={
                  p.kind === "escrow"
                    ? xcpFunOrderLabel("mint")
                    : xcpFunOrderLabel("swap")
                }
              />
            </div>
            );
          })}
        </div>
      </div>

      {archive.length > 0 ? (
        <div className="strip">
          <div className="k">Archive</div>
          <div className="strip-row chips">
            {archive.map((asset) => (
              <button
                key={asset}
                className="chip"
                onClick={() => onOpenPair(asset)}
              >
                {asset}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="blotter">
        <div className="panel">
          <h2>Positions</h2>
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th className="r">Qty</th>
                <th className="r">Mark</th>
                <th className="r">Cost</th>
                <th className="r">uPnL</th>
                <th className="r">Wt</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.asset}
                  className={`row ${selected === p.asset ? "on" : ""}`}
                  onClick={() => onToggleAsset(p.asset)}
                >
                  <td>
                    {p.asset}
                    {p.kind === "escrow" ? " · escrow" : ""}
                  </td>
                  <td className="r">{fmtQty(p.qty)}</td>
                  <td className="r">
                    {p.priceXcp === null ? "—" : fmtXcp(p.markXcp)}
                  </td>
                  <td className="r" onClick={(e) => e.stopPropagation()}>
                    {p.kind === "cash" ? (
                      fmtXcp(p.costXcp)
                    ) : (
                      <CostEdit
                        asset={p.asset}
                        costXcp={p.costXcp}
                        display={fmtXcp(p.costXcp)}
                        onSave={onCostOverride}
                      />
                    )}
                  </td>
                  <td className={`r ${tone(p.pnlXcp)}`}>
                    {p.kind === "token" ? fmtPct(p.pnlPct) : "—"}
                  </td>
                  <td className="r">
                    {totalXcp > 0
                      ? `${((p.markXcp / totalXcp) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">
            Mark is the live TOKEN/XCP pool. Paid is XCP / token; the figure
            after · is total XCP paid. Mint and vs mint are the live TOKEN/XCP
            pool versus the XCP-69 mint (0.00001 XCP / token), as a multiple
            and an XCP percent — not xcp.fun’s USD “% since mint”. ROI is vs
            what you paid.
            Click Paid or Cost to overwrite; blank clears to the tape.
          </p>
        </div>

        <div className="panel">
          <h2>
            {selected && selected !== "XCP"
              ? `Ledger · ${selected}`
              : "Tape"}
          </h2>
          {selected && selected !== "XCP" ? (
            <TokenLedger asset={selected} fills={fills} />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Blk</th>
                  <th>Action</th>
                  <th className="r">XCP</th>
                </tr>
              </thead>
              <tbody>
                {tape.map((f) => (
                  <tr
                    key={f.id}
                    className={`tape-row ${selected === f.asset ? "on" : ""}`}
                    onClick={() => onToggleAsset(f.asset)}
                  >
                    <td>{f.block.toLocaleString()}</td>
                    <td>
                      <div>{f.detail}</div>
                      <div className="muted">{f.time}</div>
                    </td>
                    <td className={`r ${tone(f.xcp)}`}>{fmtSigned(f.xcp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <p className="note">
        Cash, escrow, token marks, and market status come from Counterparty
        Core. Orders go out to xcp.fun — this desk does not fetch that host.
        Per-token price for selected:{" "}
        {selectedPos?.priceXcp != null ? fmtPrice(selectedPos.priceXcp) : "—"} XCP.
      </p>
    </>
  );
}
