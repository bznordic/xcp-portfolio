import { useMemo, useState } from "react";
import { vsMintLabel } from "../lib/book";
import { fmtPrice, fmtXcp } from "../lib/format";
import { rankSetups, type Launch } from "../lib/setups";
import {
  FRESH_GRAD_BLOCKS,
  MIN_DIP_POOL_XCP,
  MINT_PRICE,
  THIN_POOL_XCP,
} from "../lib/xcp69";
import { SetupsRail } from "./SetupsRail";
import { TokenArt } from "./TokenArt";

type StatusTab =
  | "graduated"
  | "listed"
  | "minting"
  | "scheduled"
  | "mine"
  | "graveyard";
type ScanId =
  | "near_fill"
  | "fresh_grads"
  | "below_mint"
  | "thin_chase"
  | "my_overlap";

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: "graduated", label: "Graduated" },
  { id: "listed", label: "Pooled" },
  { id: "minting", label: "Minting" },
  { id: "scheduled", label: "Scheduled" },
  { id: "mine", label: "Mine" },
  { id: "graveyard", label: "Graveyard" },
];

const SCANS: { id: ScanId; label: string }[] = [
  { id: "near_fill", label: "Near fill" },
  { id: "fresh_grads", label: "Fresh grads" },
  { id: "below_mint", label: "Below mint" },
  { id: "thin_chase", label: "Thin chase" },
  { id: "my_overlap", label: "My overlap" },
];

function inStatusTab(launch: Launch, tab: StatusTab): boolean {
  if (tab === "mine") return launch.you === "held" || launch.you === "escrow";
  if (tab === "graveyard") return launch.status === "refunded";
  return launch.status === tab;
}

export function matchesScan(launch: Launch, scan: ScanId): boolean {
  switch (scan) {
    case "near_fill":
      return (
        launch.status === "minting" &&
        launch.fill != null &&
        launch.fill >= 0.5 &&
        launch.blocksLeft != null &&
        launch.blocksLeft <= 200
      );
    case "fresh_grads":
      return (
        launch.status === "graduated" &&
        launch.blocksSinceOpen != null &&
        launch.blocksSinceOpen <= FRESH_GRAD_BLOCKS
      );
    case "below_mint":
      return (
        launch.status === "graduated" &&
        launch.mark != null &&
        launch.mark < MINT_PRICE &&
        launch.poolXcp != null &&
        launch.poolXcp >= MIN_DIP_POOL_XCP
      );
    case "thin_chase":
      return (
        launch.mark != null &&
        launch.poolXcp != null &&
        launch.mark > 3 * MINT_PRICE &&
        launch.poolXcp < THIN_POOL_XCP
      );
    case "my_overlap":
      return launch.you === "held" || launch.you === "escrow";
  }
}

function clock(launch: Launch): string {
  if (launch.status === "minting" && launch.blocksLeft != null) {
    return `${launch.blocksLeft} left`;
  }
  if (launch.status === "graduated" && launch.blocksSinceOpen != null) {
    return `${launch.blocksSinceOpen} since open`;
  }
  if (launch.status === "scheduled" && launch.blocksLeft != null) {
    return `${launch.blocksLeft} to open`;
  }
  return "—";
}

function youLabel(launch: Launch): string {
  if (launch.you === "none") return "—";
  return launch.you;
}

function fillLabel(launch: Launch): string {
  if (launch.fill == null) return "—";
  return `${(launch.fill * 100).toFixed(1)}%`;
}

function vsMint(launch: Launch): string {
  if (launch.status === "listed" || launch.mark == null) return "—";
  return vsMintLabel(launch.mark, MINT_PRICE);
}

export function impactCell(
  launch: Launch,
  impactByAsset: Record<string, number>,
): string {
  if (launch.mark == null || launch.poolXcp == null) return "—";
  const impact = impactByAsset[launch.asset];
  if (impact == null) return "—";
  return `1 XCP → −${(impact * 100).toFixed(2)}%`;
}

export function MarketsScreen({
  onOpenPair,
  launches,
  tipBlock,
  impactByAsset,
  coreUnreachable,
  liveLoading,
  cashXcp,
}: {
  onOpenPair: (asset: string) => void;
  launches: Launch[];
  tipBlock: number;
  impactByAsset: Record<string, number>;
  coreUnreachable: boolean;
  liveLoading: boolean;
  cashXcp: number;
}) {
  const [statusTab, setStatusTab] = useState<StatusTab>("graduated");
  const [scan, setScan] = useState<ScanId | null>(null);

  const scores = useMemo(() => {
    const ranked = rankSetups({
      launches,
      cashXcp,
      tipBlock,
      impactByAsset,
    });
    return new Map(ranked.map((s) => [s.asset, s.score]));
  }, [launches, tipBlock, impactByAsset, cashXcp]);

  const rows = useMemo(() => {
    return launches
      .filter((l) => inStatusTab(l, statusTab))
      .filter((l) => (scan ? matchesScan(l, scan) : true))
      .sort((a, b) => {
        const ds = (scores.get(b.asset) ?? -1) - (scores.get(a.asset) ?? -1);
        if (ds !== 0) return ds;
        return (b.poolXcp ?? -1) - (a.poolXcp ?? -1);
      });
  }, [statusTab, scan, scores, launches]);

  return (
    <div className="markets">
      <div className="markets-table">
        {coreUnreachable ? (
          <div className="banner">Core unreachable. Showing last snapshot.</div>
        ) : liveLoading ? (
          <div className="banner">Loading live markets…</div>
        ) : null}
        <div className="pills">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              className={`pill ${statusTab === t.id ? "on" : ""}`}
              onClick={() => setStatusTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="pills scans">
          {SCANS.map((s) => (
            <button
              key={s.id}
              className={`pill ${scan === s.id ? "on" : ""}`}
              onClick={() => setScan((cur) => (cur === s.id ? null : s.id))}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Status</th>
                <th className="r">Mark</th>
                <th className="r">vs mint</th>
                <th className="r">Pool XCP</th>
                <th className="r">1% impact</th>
                <th className="r">Fill</th>
                <th>Clock</th>
                <th>You</th>
              </tr>
            </thead>
            <tbody>
              {liveLoading ? (
                <tr>
                  <td colSpan={9} className="muted">
                    Loading Core…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted">
                    No names in this scan.
                  </td>
                </tr>
              ) : (
                rows.map((l) => (
                  <tr
                    key={l.asset}
                    className="row"
                    onClick={() => onOpenPair(l.asset)}
                  >
                    <td>
                      <span className="asset-cell">
                        <TokenArt asset={l.asset} size="thumb" />
                        {l.asset}
                      </span>
                    </td>
                    <td>{l.status}</td>
                    <td className="r">
                      {l.mark == null ? "—" : fmtPrice(l.mark)}
                    </td>
                    <td className="r">{vsMint(l)}</td>
                    <td className="r">
                      {l.poolXcp == null ? "—" : fmtXcp(l.poolXcp, 2)}
                    </td>
                    <td className="r">{impactCell(l, impactByAsset)}</td>
                    <td className="r">{fillLabel(l)}</td>
                    <td>{clock(l)}</td>
                    <td>{youLabel(l)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <SetupsRail
        onOpenPair={onOpenPair}
        launches={launches}
        tipBlock={tipBlock}
        impactByAsset={impactByAsset}
        cashXcp={cashXcp}
      />
    </div>
  );
}
