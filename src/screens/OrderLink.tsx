import { xcpFunAssetUrl } from "../lib/xcpFun";

export function OrderLink({
  asset,
  label,
  primary = false,
  className,
}: {
  asset: string;
  label: string;
  primary?: boolean;
  className?: string;
}) {
  const href = xcpFunAssetUrl(asset);
  if (!href || !label) return null;
  return (
    <a
      className={className ?? (primary ? "btn primary" : "btn")}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label}
    </a>
  );
}
