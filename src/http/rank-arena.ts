// The arena ranking decision — the pure heart of `/fight` crowning, extracted so the ranking
// logic is unit-testable in isolation (the PR #250 extract-to-pure lesson). Platform layer, no
// engine reach: `handle-fight` runs the round-robin, tallies each contestant's Copeland win-count
// and Σ net-points, and hands the standings here; this module is the total-order sort + keep-top-N.
import type { ArenaMember } from "./throne-store.js";

// One contestant's standing over the contested set (the current defenders + the challenger, each
// pair fought once): the member itself + its Copeland win-count (opponents it beat) and Σ net-points.
// Seniority — the dead-even backstop — lives on the member (lower = longer unbroken arena tenure).
export type Standing = {
  member: ArenaMember;
  wins: number;
  net: number;
};

// The placement of a gauntlet-clearing challenger against the arena.
export type ArenaPlacement = {
  // The new arena, rank-ordered (`[0]` is the King). In S2.1 (filling only) every contestant is
  // kept, so length ≤ N follows from the caller (which never contests a full arena).
  members: ArenaMember[];
  // `crowned` = ranked #1; `entered` = ranked #2..N (a defender). (`unplaced` — cleared but ranked
  // below all N of a FULL arena — arrives with relegation in S2.2.)
  outcome: "crowned" | "entered";
  // The challenger's final 1-based arena rank.
  rank: number;
};

// The strict total order (D2): win-count desc → Σ net-points desc → seniority asc. Because every
// seniority stamp is unique per version, no two contestants can fully tie — the order (and any
// relegation choice built on it) is always unambiguous, and an exact win+net tie retains the
// longer-tenured (lower-seniority) incumbent.
const byRank = (a: Standing, b: Standing): number =>
  b.wins - a.wins || b.net - a.net || a.member.seniority - b.member.seniority;

// Rank a gauntlet-clearing challenger against the current (non-full) arena, keeping EVERY contestant.
// While the arena has room (the S2.1 filling case — `handle-fight` short-circuits a full arena to the
// D-D `unplaced` placeholder) nobody is relegated: an empty arena crowns the lone challenger by
// default, and a challenger that LOSES its fights still enters at its true rank (C2 join-if-room).
// #1 is King. The keep-top-N cut (and the `unplaced` outcome + `displaced` defender) arrive with
// relegation-once-full in S2.2.
export const rankArena = (input: {
  defenders: readonly Standing[];
  challenger: Standing;
}): ArenaPlacement => {
  const ranked = [...input.defenders, input.challenger].sort(byRank);
  const rank = ranked.indexOf(input.challenger) + 1;

  return {
    members: ranked.map((standing) => standing.member),
    outcome: rank === 1 ? "crowned" : "entered",
    rank,
  };
};
