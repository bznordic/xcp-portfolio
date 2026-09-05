# XCP Book

Read-only Counterparty trade desk. It sits next to the wallet and [XCP DEX](https://xcpdex.com/): live marks, remaining cost after sales, a per-token ledger, and a Core-backed meme finder.

Not a wallet. It does not sign, compose, or broadcast. Marks are pool and dispenser quotes, not fills. Nothing here is financial advice.

v0 runs on **localhost**. The Vite dev proxy is what reaches Counterparty Core and mempool.space. A static host has no proxy, so `npm run build` alone will not load a live book.

## Run

```bash
npm install
npm run dev
```

Opens [http://localhost:5173](http://localhost:5173). Add named watches in the left rail, or paste a Bitcoin address to load a book. The shipped client has an empty book until Core answers — no sample holdings.

```bash
npm test
npm run build
```

Requires Node 20+. Source: [github.com/bznordic/xcp-portfolio](https://github.com/bznordic/xcp-portfolio).

## What it does

- Marks TOKEN/XCP from Counterparty Core pool reserves (XCP-69 grads and classic names like PEPECASH)
- Pair screen: DEX bid/ask lots plus pool rungs at XCP-per-token, from Core `/v2/orders/{asset}/XCP`
- Rebuilds cost from fairmints and filled orders; a sale withdraws XCP from remaining investment
- Per-token ledger: mint / buy / sell → qty left and XCP still in
- Markets: XCP-69 minting/graduated plus every TOKEN/XCP pool; setups rank upside vs mint (XCP-69 only)
- Wallet BTC from mempool.space; optional **Paid in** stack per address (empty = current UTXO). Whole-wallet fiat uses leftover BTC plus the book at today’s XCP/BTC floor and BTC/USD
- Orders leave the desk via links to [xcp.fun](https://xcp.fun)

Memes stay in **XCP**. BTC and USD appear only on the portfolio total.

## Data

The browser talks to Core through the Vite proxy (`/core` → `https://api.counterparty.io:4000`). BTC/USD and address UTXOs go through `/fx` and `/mempool` → [mempool.space](https://mempool.space).

Do not scrape xcp.io, xcp.fun APIs, or other Cloudflare-fronted JSON. The exception is **images** (`xcp.fun/i/…`) and **opening an order page**. JS must not fetch those hosts.

## Status

Prototype. Named watches, the last open address, cost overrides, and paid-in BTC stay in `localStorage`. Dust leftovers that display as 0.00 are hidden on the blotter; the wallet will still show them.

MIT licensed. Issues and PRs welcome. Run `npm test` before opening a pull request.
