import type { Fill } from "../data/fixture";
import { tokenLedger } from "../lib/book";
import { fmtPrice, fmtQty, fmtSigned, fmtXcp } from "../lib/format";

function tone(n: number): string {
  if (n > 0) return "up";
  if (n < 0) return "down";
  return "muted";
}

function actionLabel(action: Fill["action"]): string {
  if (action === "mint_escrow") return "Mint";
  if (action === "mint_lose") return "Mint lost";
  if (action === "buy") return "Buy";
  if (action === "sell") return "Sell";
  return action;
}

export function TokenLedger({
  asset,
  fills,
}: {
  asset: string;
  fills: Fill[];
}) {
  const rows = tokenLedger(fills, asset);
  const last = rows[rows.length - 1];

  if (rows.length === 0) {
    return <p className="muted">No ledger lines for {asset}.</p>;
  }

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Blk</th>
            <th>Action</th>
            <th className="r">Qty</th>
            <th className="r">XCP</th>
            <th className="r">Qty left</th>
            <th className="r">Still in</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.fill.id}>
              <td>{row.fill.block.toLocaleString()}</td>
              <td>
                <div>{actionLabel(row.fill.action)}</div>
                <div className="muted">{row.fill.time}</div>
              </td>
              <td className={`r ${tone(row.qtyDelta)}`}>
                {row.qtyDelta === 0 ? "—" : fmtQty(row.qtyDelta)}
              </td>
              <td className={`r ${tone(row.fill.xcp)}`}>
                {fmtSigned(row.fill.xcp)}
              </td>
              <td className="r">{fmtQty(row.qtyAfter)}</td>
              <td className="r">{fmtXcp(row.investedAfter)} XCP</td>
            </tr>
          ))}
        </tbody>
      </table>
      {last ? (
        <p className="note">
          Leftover {fmtQty(last.qtyAfter)} {asset} still has{" "}
          {fmtXcp(last.investedAfter)} XCP in
          {last.paidPriceAfter != null
            ? ` · ${fmtPrice(last.paidPriceAfter)} XCP / token`
            : ""}
          .
        </p>
      ) : null}
    </>
  );
}
