import { useState } from "react";
import { assetMono } from "../data/fixture";
import { xcpFunArtUrl } from "../lib/xcpFun";

export function TokenArt({
  asset,
  size = "tile",
}: {
  asset: string;
  size?: "tile" | "thumb" | "pair";
}) {
  const [failed, setFailed] = useState(false);
  const src = xcpFunArtUrl(asset);
  if (!src || failed) {
    return (
      <div className={`art ${size} mono`} aria-hidden="true">
        {assetMono(asset)}
      </div>
    );
  }
  return (
    <div className={`art ${size}`}>
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
