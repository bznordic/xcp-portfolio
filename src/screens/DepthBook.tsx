import { fmtPrice, fmtQty, fmtXcp } from "../lib/format";
import type { DepthBook, DepthLevel } from "../lib/depth";

function barPct(qty: number, max: number): number {
  if (!(max > 0) || !(qty > 0)) return 0;
  return Math.min(100, (qty / max) * 100);
}

function LevelRow({
  row,
  maxXcp,
}: {
  row: DepthLevel;
  maxXcp: number;
}) {
  return (
    <div className={`depth-row ${row.side}`}>
      <i
        className="depth-bar"
        style={{ width: `${barPct(row.xcpQty, maxXcp)}%` }}
      />
      <span className="depth-src">{row.source}</span>
      <span className="r">{fmtQty(row.tokenQty)}</span>
      <span className="r">{fmtPrice(row.priceXcp)}</span>
      <span className="r">{fmtXcp(row.xcpQty, 2)}</span>
    </div>
  );
}

export function DepthBook({
  book,
  loading,
}: {
  book: DepthBook;
  loading: boolean;
}) {
  const maxXcp = Math.max(
    0,
    ...book.asks.map((r) => r.xcpQty),
    ...book.bids.map((r) => r.xcpQty),
  );
  const dex =
    book.asks.some((r) => r.source === "dex") ||
    book.bids.some((r) => r.source === "dex");
  const empty = book.asks.length === 0 && book.bids.length === 0;
  let note: string | null = null;
  if (loading && empty) note = "Loading rest…";
  else if (empty) note = "No DEX lots and no pool to ladder.";
  else if (!dex) note = "No DEX lots. Pool rungs only.";

  return (
    <div className="depth">
      <div className="depth-head">
        <span>Supply / demand · XCP</span>
        <span>
          {book.bestBid != null ? fmtPrice(book.bestBid) : "—"} bid ·{" "}
          {book.bestAsk != null ? fmtPrice(book.bestAsk) : "—"} ask
        </span>
      </div>
      <div className="depth-cols">
        <span>src</span>
        <span className="r">tokens</span>
        <span className="r">XCP / token</span>
        <span className="r">XCP</span>
      </div>
      {book.asks.map((row, i) => (
        <LevelRow
          key={`ask:${row.source}:${row.priceXcp}:${i}`}
          row={row}
          maxXcp={maxXcp}
        />
      ))}
      <div className="depth-mark">
        <span>pool mark</span>
        <span>{book.mark != null ? `${fmtPrice(book.mark)} XCP` : "—"}</span>
      </div>
      {book.bids.map((row, i) => (
        <LevelRow
          key={`bid:${row.source}:${row.priceXcp}:${i}`}
          row={row}
          maxXcp={maxXcp}
        />
      ))}
      {note ? <p className="depth-note">{note}</p> : null}
    </div>
  );
}
