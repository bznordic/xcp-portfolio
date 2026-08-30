import { useMemo } from "react";
import {
  CASH_XCP,
  IMPACT_BY_ASSET,
  TIP_BLOCK,
  UNIVERSE_FIXTURE,
} from "../data/universe-fixture";
import {
  setupDiesIf,
  setupDoThis,
  setupHeadline,
  setupOrderLabel,
  setupPairLabel,
  setupWindow,
} from "../lib/setupCopy";
import { rankSetups, type Launch, type Setup } from "../lib/setups";
import { OrderLink } from "./OrderLink";
import { TokenArt } from "./TokenArt";

export function SetupsRail({
  onOpenPair,
  assetFilter,
  launches = UNIVERSE_FIXTURE,
  tipBlock = TIP_BLOCK,
  impactByAsset = IMPACT_BY_ASSET,
  cashXcp = CASH_XCP,
}: {
  onOpenPair: (asset: string) => void;
  assetFilter?: string;
  launches?: Launch[];
  tipBlock?: number;
  impactByAsset?: Record<string, number>;
  cashXcp?: number;
}) {
  const setups = useMemo(() => {
    const scoped = assetFilter
      ? launches.filter((l) => l.asset === assetFilter)
      : launches;
    const ranked = rankSetups({
      launches: scoped,
      cashXcp,
      tipBlock,
      impactByAsset,
    });
    if (!assetFilter) return ranked;
    return ranked.filter((s) => s.asset === assetFilter);
  }, [assetFilter, launches, tipBlock, impactByAsset, cashXcp]);

  return (
    <div className="setups-rail">
      <h2>What to buy · block {tipBlock.toLocaleString()}</h2>
      <p className="rail-sub">
        Ranked by upside vs mint. Bag size does not matter. Not an order.
      </p>
      {setups.length === 0 ? (
        <p className="empty-setup">No setup. Sit in XCP.</p>
      ) : (
        <div className="setup-cards">
          {setups.map((s) => (
            <SetupCard key={s.id} setup={s} onOpenPair={onOpenPair} />
          ))}
        </div>
      )}
    </div>
  );
}

function SetupCard({
  setup,
  onOpenPair,
}: {
  setup: Setup;
  onOpenPair: (asset: string) => void;
}) {
  const pair = setupPairLabel(setup);
  const dies = setupDiesIf(setup);

  return (
    <div className={`setup-card ${setup.action.toLowerCase()}`}>
      <div className="setup-score" title="Priority">
        {Math.round(setup.score)}
      </div>
      <div className={`setup-verb ${setup.action.toLowerCase()}`}>
        {verbChip(setup)}
      </div>
      <div className="setup-title">
        {setup.asset !== "XCP" ? (
          <TokenArt asset={setup.asset} size="thumb" />
        ) : null}
        <h3 className="setup-headline">{setupHeadline(setup)}</h3>
      </div>
      <p className="setup-do">{setupDoThis(setup)}</p>
      <p className="setup-window">{setupWindow(setup)}</p>
      {dies ? <p className="setup-dies">{dies}</p> : null}
      <div className="cta-row">
        {pair ? (
          <button className="btn" onClick={() => onOpenPair(setup.asset)}>
            {pair}
          </button>
        ) : null}
        <OrderLink
          asset={setup.asset}
          label={setupOrderLabel(setup)}
          primary={setup.action === "BUY_POOL" || setup.action === "MINT"}
        />
      </div>
    </div>
  );
}

function verbChip(setup: Setup): string {
  switch (setup.action) {
    case "BUY_POOL":
      return "Buy";
    case "MINT":
      return "Mint";
    case "AVOID":
      return "Don't chase";
    case "WAIT":
      return "Sit";
  }
}
