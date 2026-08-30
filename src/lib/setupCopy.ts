import type { Setup } from "./setups";

const DIES_IMPACT = "1 XCP impact > 8%";

function sizeLabel(sizeXcp: number): string {
  const n = Number.isInteger(sizeXcp) ? String(sizeXcp) : sizeXcp.toFixed(1);
  return `${n} XCP`;
}

export function setupHeadline(setup: Setup): string {
  const size = sizeLabel(setup.sizeXcp);
  switch (setup.action) {
    case "BUY_POOL":
      return `Buy ${setup.asset} in the pool · ${size}`;
    case "MINT":
      return `Mint ${setup.asset} · ${size}`;
    case "AVOID":
      return `Don't chase ${setup.asset}`;
    case "WAIT":
      return setup.rule === "sit_cash"
        ? `Sit in XCP · ${size}`
        : `Wait on ${setup.asset} · ${size}`;
  }
}

function humanWhyLine(line: string): string {
  const mark = line.match(/^Mark (.+)\.$/);
  if (mark) return `Still ${mark[1]}`;
  const room = line.match(/^Mark (.+) — room left to 2× mint\.$/);
  if (room) return `Still ${room[1]}. Room left before 2× mint`;
  const blk = line.match(/^(\d+) blk since open\.$/);
  if (blk) return `${blk[1]} blocks after the pool opened`;
  const pool = line.match(/^Pool (.+) XCP\.$/);
  if (pool) return `Pool has ${pool[1]} XCP`;
  if (line === "No rule hit. XCP is the position.") {
    return "No buy or mint setup is live. XCP is the position.";
  }
  if (line === "No size. Need XCP.") {
    return "No size. Need XCP first.";
  }
  return line.replace(/\.$/, "");
}

export function setupDoThis(setup: Setup): string {
  return setup.why.map(humanWhyLine).join(". ") + ".";
}

export function setupWindow(setup: Setup): string {
  const byRule: Record<Setup["rule"], string> = {
    post_open_dump:
      "the first 72 blocks after the pool opened, and the price is still under 2× mint",
    dip_below_mint:
      "the price is under mint and the pool still has at least 300 XCP",
    room_to_run: "the price is under 2× mint and the pool still has ≥ 300 XCP",
    last_lots: "the last 200 blocks and the mint is at least 80% filled",
    thin_chase: "this name is more than 3× mint with a thin pool",
    sit_cash: "no buy or mint setup is live",
  };
  return `Do this while ${byRule[setup.rule]}.`;
}

function diesClause(line: string): string | null {
  if (line === DIES_IMPACT) {
    return "1 XCP would move the pool more than 8%";
  }
  return line || null;
}

export function setupDiesIf(setup: Setup): string {
  const clauses = setup.invalidIf
    .map(diesClause)
    .filter((c): c is string => c != null);
  if (clauses.length === 0) return "";
  return `Dies if ${clauses.join(", or ")}.`;
}

export function setupPairLabel(setup: Setup): string {
  if (setup.asset === "XCP") return "";
  return `Open ${setup.asset}/XCP`;
}

export function setupOrderLabel(setup: Setup): string {
  if (setup.asset === "XCP") return "";
  switch (setup.action) {
    case "BUY_POOL":
      return "Buy on xcp.fun";
    case "MINT":
      return "Mint on xcp.fun";
    default:
      return "Open on xcp.fun";
  }
}
