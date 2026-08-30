import { describe, expect, it } from "vitest";
import {
  LANDING_BITCOINER_BULLETS,
  LANDING_BITCOINER_TITLE,
  LANDING_CLOSER,
  LANDING_DEGEN_BULLETS,
  LANDING_DEGEN_TITLE,
  LANDING_DOOR_ADDRESS,
  LANDING_DOOR_NEED_XCP,
  LANDING_FACTS,
  LANDING_FOOTER,
  LANDING_HEADLINE,
  LANDING_LOAD,
  LANDING_PLACEHOLDER,
  LANDING_SUBHEAD,
  LANDING_XCP_DEX_LABEL,
  LANDING_XCP_DEX_URL,
  LANDING_XCP_FUN_LABEL,
  LANDING_XCP_FUN_URL,
} from "../src/lib/landingCopy";

describe("landingCopy", () => {
  it("locks the dual-audience pitch", () => {
    expect(LANDING_HEADLINE).toBe("Tokens on Bitcoin. The quote is XCP.");
    expect(LANDING_SUBHEAD).toBe(
      "For people who only settle on Bitcoin, and people who already trade memes. Same protocol. Two ways in.",
    );
    expect(LANDING_BITCOINER_TITLE).toBe("You already have the chain.");
    expect([...LANDING_BITCOINER_BULLETS]).toEqual([
      "Assets issue on Bitcoin. No new ledger, no new validator set.",
      "XCP was created by burning BTC. Fixed supply. No 2024 team pile.",
      "Counterparty shipped this in 2014, DEX included.",
      "This page does not connect a wallet. Paste an address. Read the book.",
    ]);
    expect(LANDING_DEGEN_TITLE).toBe("The pair is not USD.");
    expect([...LANDING_DEGEN_BULLETS]).toEqual([
      "Fairmints (XCP-69) sell into a curve, then graduate to a TOKEN/XCP pool.",
      "Memes, dispensers, the DEX. The tape that other chains copied started here.",
      "USD is a spectator. If you want size in a mint or a pool, you need XCP.",
      "This desk ranks setups against mint. You can be late to the explanation without being late to the next name.",
    ]);
    expect([...LANDING_FACTS]).toEqual([
      "Protocol coin of Counterparty.",
      "Burn-issued and capped.",
      "The quote for mints and the DEX.",
    ]);
    expect(LANDING_CLOSER).toBe("Mints fill. Pools open. The quote stays XCP.");
    expect(LANDING_DOOR_ADDRESS).toBe("I have an address.");
    expect(LANDING_PLACEHOLDER).toBe("bc1p… or 1…");
    expect(LANDING_LOAD).toBe("Load");
    expect(LANDING_DOOR_NEED_XCP).toBe("I need XCP.");
    expect(LANDING_XCP_FUN_LABEL).toBe("Open xcp.fun");
    expect(LANDING_XCP_FUN_URL).toBe("https://xcp.fun");
    expect(LANDING_XCP_DEX_LABEL).toBe("Open XCP DEX");
    expect(LANDING_XCP_DEX_URL).toBe("https://xcpdex.com");
    expect(LANDING_FOOTER).toBe(
      "Read-only. Does not sign, compose, or broadcast. Marks are quotes, not fills. Not financial advice.",
    );
  });
});
