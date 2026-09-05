import { type Fill, type Position } from "../data/fixture";
import { quotesFor } from "../data/universe-fixture";
import { assetIsXcp69, assetVsMint, mintPriceXcpFor, vsMintLabel } from "../lib/book";
import { toDepthBook, type DepthOrder } from "../lib/depth";
import {
  fmtPct,
  fmtPrice,
  fmtQty,
  fmtXcp,
} from "../lib/format";
import type { Launch } from "../lib/setups";
import { THIN_IMPACT, type Xcp69Fairminter } from "../lib/xcp69";
import { xcpFunOrderLabel } from "../lib/xcpFun";
import { DepthBook } from "./DepthBook";
import { OrderLink } from "./OrderLink";
import { SetupsRail } from "./SetupsRail";
import { TokenArt } from "./TokenArt";
import { TokenLedger } from "./TokenLedger";

function tone(n: number): string {
  if (n > 0) return "up";
  if (n < 0) return "down";
  return "muted";
}

export function PairScreen({
  asset,
  launches,
  tipBlock,
  impactByAsset,
  positions,
  fills,
  minters = {},
  pairOrders = [],
  pairOrdersLoading = false,
  onOpenPortfolio,
  onOpenPair,
}: {
  asset: string;
  launches: Launch[];
  tipBlock: number;
  impactByAsset: Record<string, number>;
  positions: Position[];
  fills: Fill[];
  minters?: Record<string, Xcp69Fairminter>;
  pairOrders?: DepthOrder[];
  pairOrdersLoading?: boolean;
  onOpenPortfolio: (asset: string) => void;
  onOpenPair: (asset: string) => void;
}) {
  const launch = launches.find((l) => l.asset === asset);
  const pos = positions.find((p) => p.asset === asset);
  const quotes = quotesFor(asset, launch);
  const thin = quotes.some((q) => q.impact > THIN_IMPACT);
  const quotePos =
    pos ??
    ({
      asset,
      kind: "token",
      qty: 1,
      priceXcp: launch?.mark ?? 0,
      markXcp: 0,
      costXcp: 0,
      pnlXcp: 0,
      pnlPct: 0,
    } satisfies Position);
  const mintPrice = mintPriceXcpFor(
    quotePos,
    launch,
    assetIsXcp69(launch, minters[asset]),
  );
  const mark = launch?.mark ?? null;
  const vsMint =
    mark != null && mintPrice != null ? assetVsMint(mark, mintPrice) : null;

  return (
    <div className="pair">
      <div className="pair-head">
        <TokenArt asset={asset} size="pair" />
        <div>
          <h2 className="pair-title">
            {asset}/XCP
          </h2>
          <div className="pair-mark">
            {mark != null ? `${fmtPrice(mark)} XCP` : "—"}
          </div>
          <div className="muted">
            {launch?.status === "listed" && mintPrice == null ? (
              "Core TOKEN/XCP pool · not an XCP-69 mint"
            ) : vsMint != null && mark != null && mintPrice != null ? (
              <>
                vs mint{" "}
                <span className={tone(vsMint.xcp)}>
                  {vsMintLabel(mark, mintPrice)}
                </span>
              </>
            ) : (
              "vs mint —"
            )}
            {pos && pos.kind === "token" ? (
              <>
                {" · "}vs your cost{" "}
                <span className={tone(pos.pnlPct)}>{fmtPct(pos.pnlPct)}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="pair-actions">
        <OrderLink
          asset={asset}
          label={
            launch?.status === "minting" || launch?.status === "scheduled" || pos?.kind === "escrow"
              ? xcpFunOrderLabel("mint")
              : xcpFunOrderLabel("swap")
          }
          primary
        />
        <button
          className="you-line"
          onClick={() => onOpenPortfolio(asset)}
          disabled={!pos}
        >
          {pos ? (
            <>
              you: {fmtQty(pos.qty)} @ {fmtXcp(pos.costXcp, 2)} cost · mark{" "}
              {fmtXcp(pos.markXcp, 3)}
            </>
          ) : (
            "you: —"
          )}
        </button>
        </div>
      </div>

      {launch?.status === "minting" ? (
        <p className="note">
          Fill {launch.fill != null ? `${(launch.fill * 100).toFixed(1)}%` : "—"}
          {launch.blocksLeft != null ? ` · ${launch.blocksLeft} blocks left` : ""}
          {pos?.kind === "escrow"
            ? ` · your escrow ${fmtXcp(pos.costXcp, 2)} XCP`
            : ""}
        </p>
      ) : null}

      {launch?.status === "scheduled" ? (
        <p className="note">
          Opens in {launch.blocksLeft ?? "—"} blocks. No quote yet.
        </p>
      ) : null}

      {launch?.mark != null ? (
        <>
          {thin ? (
            <div className="banner">Thin. Size down or skip.</div>
          ) : null}
          <div className="quote-strip">
            {quotes.map((q) => (
              <div key={q.xcpIn}>
                <div className="k">{q.xcpIn} XCP in</div>
                <div className="v sm">
                  {q.tokensOut != null ? fmtQty(q.tokensOut) : "—"}
                </div>
                <div className={`d ${q.impact > THIN_IMPACT ? "warn" : "muted"}`}>
                  impact {(q.impact * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <DepthBook
        book={toDepthBook(asset, pairOrders, launch?.mark, launch?.poolXcp)}
        loading={pairOrdersLoading}
      />

      <div className="grid-2 pair-body">
        <div className="panel">
          <h2>Ledger · {asset}</h2>
          <TokenLedger asset={asset} fills={fills} />
        </div>
        <SetupsRail
          onOpenPair={onOpenPair}
          assetFilter={asset}
          launches={launches}
          tipBlock={tipBlock}
          impactByAsset={impactByAsset}
          cashXcp={positions.find((p) => p.kind === "cash")?.markXcp ?? 0}
        />
      </div>
    </div>
  );
}
