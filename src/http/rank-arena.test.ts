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

// The frozen arena cap under test — the live version's N (D4). The contested set is ranked and
// cut to the top N; a fuller set relegates its weakest.
const N = 3;

describe("rankArena — total-order ranking, keep top N (win → net → seniority)", () => {
  it("crowns the lone challenger on an empty arena (bootstrap, no fights)", () => {
    const challenger = standing("newcomer", 1, 0, 0);

    expect(rankArena({ defenders: [], challenger, n: N })).toEqual({
      members: [challenger.member],
      outcome: "crowned",
      rank: 1,
      displaced: null,
    });
  });

  it("enters at #2 when the challenger LOSES to the lone King but there is room", () => {
    const king = standing("king", 1, 1, 40); // beat the challenger
    const challenger = standing("usurper", 2, 0, -40); // lost the title fight

    expect(rankArena({ defenders: [king], challenger, n: N })).toEqual({
      members: [king.member, challenger.member],
      outcome: "entered",
      rank: 2,
      displaced: null,
    });
  });

  it("crowns the challenger over the King, keeping the deposed King as defender #2", () => {
    const king = standing("king", 1, 0, -40); // lost to the challenger
    const challenger = standing("usurper", 2, 1, 40); // won the title fight

    expect(rankArena({ defenders: [king], challenger, n: N })).toEqual({
      members: [challenger.member, king.member], // old King NOT removed — now #2
      outcome: "crowned",
      rank: 1,
      displaced: null,
    });
  });

  it("orders a three-way set by win-count first (the primary key)", () => {
    const a = standing("ace", 1, 2, 0); // beat both others
    const b = standing("bishop", 2, 1, 0); // beat one
    const challenger = standing("rookie", 3, 0, 0); // beat none

    expect(rankArena({ defenders: [a, b], challenger, n: N })).toEqual({
      members: [a.member, b.member, challenger.member],
      outcome: "entered",
      rank: 3,
      displaced: null,
    });
  });

  it("breaks a win-count tie by net points (net beats seniority)", () => {
    const king = standing("king", 1, 1, 5); // more senior, but lower net
    const challenger = standing("usurper", 2, 1, 40); // same wins, higher net

    expect(rankArena({ defenders: [king], challenger, n: N })).toEqual({
      members: [challenger.member, king.member],
      outcome: "crowned",
      rank: 1,
      displaced: null,
    });
  });

  it("breaks a win+net tie by seniority — an exact tie retains the longer-tenured incumbent", () => {
    const king = standing("king", 1, 1, 20); // longer tenure (lower seniority)
    const challenger = standing("twin", 2, 1, 20); // identical wins + net

    expect(rankArena({ defenders: [king], challenger, n: N })).toEqual({
      members: [king.member, challenger.member], // incumbent holds #1 on the tie
      outcome: "entered",
      rank: 2,
      displaced: null,
    });
  });

  it("orders an all-tied set purely by seniority ascending (longer tenure first)", () => {
    // three contestants dead-even on wins + net — only seniority separates them. Three (not two)
    // is required: a two-way tie can't distinguish `senA - senB` from `senA + senB` (the sort's
    // argument order makes them agree), but a three-way ordering does.
    const senior = standing("senior", 1, 1, 0);
    const middle = standing("middle", 2, 1, 0);
    const challenger = standing("junior", 3, 1, 0);

    expect(
      rankArena({ defenders: [middle, senior], challenger, n: N }),
    ).toEqual({
      members: [senior.member, middle.member, challenger.member],
      outcome: "entered",
      rank: 3,
      displaced: null,
    });
  });

  it("keeps every entrant and relegates no one when the contested set is within N", () => {
    const king = standing("king", 1, 1, 10);
    const challenger = standing("second", 2, 0, -10);

    const result = rankArena({ defenders: [king], challenger, n: N });

    expect(result.members).toHaveLength(2);
    expect(result.displaced).toBeNull();
  });
});

describe("rankArena — a FULL arena relegates its weakest (S2.2)", () => {
  it("enters a challenger that out-ranks the two lowest, relegating the weakest defender", () => {
    // Full arena [king, mid, weak] + challenger. Challenger beats mid + weak but not king.
    const king = standing("king", 1, 3, 30);
    const challenger = standing("usurper", 4, 2, 20);
    const mid = standing("mid", 2, 1, 10);
    const weak = standing("weak", 3, 0, 0);

    expect(
      rankArena({ defenders: [king, mid, weak], challenger, n: N }),
    ).toEqual({
      members: [king.member, challenger.member, mid.member], // challenger #2, mid shifts to #3
      outcome: "entered",
      rank: 2,
      displaced: weak.member, // the previous #3 relegates
    });
  });

  it("crowns a challenger that beats the whole arena, relegating the weakest defender", () => {
    const challenger = standing("usurper", 4, 3, 30);
    const king = standing("king", 1, 2, 20);
    const mid = standing("mid", 2, 1, 10);
    const weak = standing("weak", 3, 0, 0);

    expect(
      rankArena({ defenders: [king, mid, weak], challenger, n: N }),
    ).toEqual({
      members: [challenger.member, king.member, mid.member],
      outcome: "crowned",
      rank: 1,
      displaced: weak.member,
    });
  });

  it("leaves a challenger ranked below the whole arena UNPLACED — it relegates no one", () => {
    const king = standing("king", 1, 3, 30);
    const mid = standing("mid", 2, 2, 20);
    const weak = standing("weak", 3, 1, 10);
    const challenger = standing("hopeful", 4, 0, 0); // loses to all three

    expect(
      rankArena({ defenders: [king, mid, weak], challenger, n: N }),
    ).toEqual({
      members: [king.member, mid.member, weak.member], // the arena's own top N, unchanged set
      outcome: "unplaced",
      rank: null,
      displaced: null, // the challenger never joined; it relegated no one
    });
  });

  it("relegates the weakest by the FULL total order — a seniority tiebreak picks the victim, not the challenger", () => {
    // king is clear #1; a, challenger, b all tie on win+net, so seniority orders them
    // a < challenger < b. The most-junior (b) is the one cut — NOT the challenger, which shares
    // the very same tie but is longer-tenured than b.
    const king = standing("king", 1, 2, 0);
    const a = standing("a", 2, 1, 0);
    const b = standing("b", 4, 1, 0);
    const challenger = standing("challenger", 3, 1, 0);

    expect(rankArena({ defenders: [king, a, b], challenger, n: N })).toEqual({
      members: [king.member, a.member, challenger.member],
      outcome: "entered",
      rank: 3,
      displaced: b.member, // most-junior of the tied trio relegates
    });
  });
});
