import { describe, expect, it } from "vitest";

import { rankArena, type Standing } from "./rank-arena.js";
import type { BotDoc } from "../engine/dsl.js";

const champ = (name: string): BotDoc => ({
  version: 1,
  name,
  rules: [],
  default: { type: "idle" },
});

// A round-robin standing: the member + its Copeland win-count and Σ net-points over the
// contested set. Seniority lives on the member (lower = longer-tenured, the dead-even backstop).
const standing = (
  name: string,
  seniority: number,
  wins: number,
  net: number,
): Standing => ({
  member: { champion: champ(name), handle: null, seniority },
  wins,
  net,
});

describe("rankArena — total-order ranking of a non-full arena (win → net → seniority, keep top N)", () => {
  it("crowns the lone challenger on an empty arena (bootstrap, no fights)", () => {
    const challenger = standing("newcomer", 1, 0, 0);

    expect(rankArena({ defenders: [], challenger })).toEqual({
      members: [challenger.member],
      outcome: "crowned",
      rank: 1,
    });
  });

  it("enters at #2 when the challenger LOSES to the lone King but there is room", () => {
    const king = standing("king", 1, 1, 40); // beat the challenger
    const challenger = standing("usurper", 2, 0, -40); // lost the title fight

    expect(rankArena({ defenders: [king], challenger })).toEqual({
      members: [king.member, challenger.member],
      outcome: "entered",
      rank: 2,
    });
  });

  it("crowns the challenger over the King, keeping the deposed King as defender #2", () => {
    const king = standing("king", 1, 0, -40); // lost to the challenger
    const challenger = standing("usurper", 2, 1, 40); // won the title fight

    expect(rankArena({ defenders: [king], challenger })).toEqual({
      members: [challenger.member, king.member], // old King NOT removed — now #2
      outcome: "crowned",
      rank: 1,
    });
  });

  it("orders a three-way set by win-count first (the primary key)", () => {
    const a = standing("ace", 1, 2, 0); // beat both others
    const b = standing("bishop", 2, 1, 0); // beat one
    const challenger = standing("rookie", 3, 0, 0); // beat none

    expect(rankArena({ defenders: [a, b], challenger })).toEqual({
      members: [a.member, b.member, challenger.member],
      outcome: "entered",
      rank: 3,
    });
  });

  it("breaks a win-count tie by net points (net beats seniority)", () => {
    const king = standing("king", 1, 1, 5); // more senior, but lower net
    const challenger = standing("usurper", 2, 1, 40); // same wins, higher net

    expect(rankArena({ defenders: [king], challenger })).toEqual({
      members: [challenger.member, king.member],
      outcome: "crowned",
      rank: 1,
    });
  });

  it("breaks a win+net tie by seniority — an exact tie retains the longer-tenured incumbent", () => {
    const king = standing("king", 1, 1, 20); // longer tenure (lower seniority)
    const challenger = standing("twin", 2, 1, 20); // identical wins + net

    expect(rankArena({ defenders: [king], challenger })).toEqual({
      members: [king.member, challenger.member], // incumbent holds #1 on the tie
      outcome: "entered",
      rank: 2,
    });
  });

  it("orders an all-tied set purely by seniority ascending (longer tenure first)", () => {
    // three contestants dead-even on wins + net — only seniority separates them. Three (not two)
    // is required: a two-way tie can't distinguish `senA - senB` from `senA + senB` (the sort's
    // argument order makes them agree), but a three-way ordering does.
    const senior = standing("senior", 1, 1, 0);
    const middle = standing("middle", 2, 1, 0);
    const challenger = standing("junior", 3, 1, 0);

    expect(rankArena({ defenders: [middle, senior], challenger })).toEqual({
      members: [senior.member, middle.member, challenger.member],
      outcome: "entered",
      rank: 3,
    });
  });

  it("keeps every entrant when the contested set is within N (no premature cut)", () => {
    const king = standing("king", 1, 1, 10);
    const challenger = standing("second", 2, 0, -10);

    const result = rankArena({ defenders: [king], challenger });

    expect(result.members).toHaveLength(2);
  });
});
