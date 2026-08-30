function xcpFunName(asset: string): string | null {
  const name = asset.trim().toUpperCase();
  if (!name || name === "XCP") return null;
  return name;
}

/** Outbound order page. The desk does not fetch this host in JS. */
export function xcpFunAssetUrl(asset: string): string | null {
  const name = xcpFunName(asset);
  if (!name) return null;
  return `https://xcp.fun/${encodeURIComponent(name)}`;
}

/** Token art CDN. Browser loads the img; monogram if it fails. */
export function xcpFunArtUrl(asset: string): string | null {
  const name = xcpFunName(asset);
  if (!name) return null;
  return `https://xcp.fun/i/${encodeURIComponent(name)}?fb=full&w=240`;
}

export function xcpFunOrderLabel(kind: "mint" | "buy" | "swap" | "open"): string {
  switch (kind) {
    case "mint":
      return "Mint on xcp.fun";
    case "buy":
      return "Buy on xcp.fun";
    case "swap":
      return "Swap on xcp.fun";
    case "open":
      return "Open on xcp.fun";
  }
}
