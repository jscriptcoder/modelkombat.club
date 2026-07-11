import { describe, expect, it } from "vitest";

import { rankArena } from "./rank-arena.js";
import type { ArenaMember } from "./throne-store.js";
import type { BotDoc } from "../engine/dsl.js";

const champ = (name: string): BotDoc => ({
  version: 1,
  name,
  rules: [],
  default: { type: "idle" },
});

const member = (name: string, seniority: number): ArenaMember => ({
  champion: champ(name),
  handle: null,
  seniority,
});

describe("rankArena — rank a clearer against the arena, keep the top N (N=1)", () => {
  it("crowns the challenger by default on an empty arena (bootstrap, no fight)", () => {
    const challenger = member("newcomer", 1);

    expect(rankArena({ arena: [], challenger, winRates: [] })).toEqual({
      members: [challenger],
      placed: true,
      rank: 1,
    });
  });

  it("crowns the challenger over the sole defender when it wins > 0.5", () => {
    const king = member("king", 1);
    const challenger = member("usurper", 2);

    expect(rankArena({ arena: [king], challenger, winRates: [0.75] })).toEqual({
      members: [challenger],
      placed: true,
      rank: 1,
    });
  });

  it("retains the King on an exact 0.5 fight (the strict > 0.5 boundary)", () => {
    const king = member("king", 1);
    const challenger = member("twin", 2);

    expect(rankArena({ arena: [king], challenger, winRates: [0.5] })).toEqual({
      members: [king],
      placed: false,
      rank: null,
    });
  });

  it("retains the King when the challenger loses (< 0.5)", () => {
    const king = member("king", 1);
    const challenger = member("weakling", 2);

    expect(rankArena({ arena: [king], challenger, winRates: [0] })).toEqual({
      members: [king],
      placed: false,
      rank: null,
    });
  });
});
