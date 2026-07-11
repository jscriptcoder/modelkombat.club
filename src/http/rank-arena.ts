// The arena ranking decision — the pure heart of `/fight` crowning, extracted so the ranking
// logic is unit-testable in isolation (the PR #250 extract-to-pure lesson). Platform layer, no
// engine reach: `handle-fight` runs the round-robin, tallies each contestant's Copeland win-count
// and Σ net-points, and hands the standings here; this module is the total-order sort, the
// keep-top-N cut, and the relegation verdict.
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
  // The new arena, rank-ordered and cut to the top N (`[0]` is the King).
  members: ArenaMember[];
  // `crowned` = ranked #1; `entered` = ranked #2..N (a defender); `unplaced` = cleared but ranked
  // below every one of a FULL arena's N members (it joins no arena).
  outcome: "crowned" | "entered" | "unplaced";
  // The challenger's final 1-based arena rank, or `null` when it is `unplaced` (it has no rank).
  rank: number | null;
  // The member relegated to make room for the challenger — the (N+1)-th by the total order — or
  // `null` when nobody was relegated (the arena had room, or the challenger itself was the one cut
  // and so joined no arena and displaced no one).
  displaced: ArenaMember | null;
};

// The strict total order (D2): win-count desc → Σ net-points desc → seniority asc. Because every
// seniority stamp is unique per version, no two contestants can fully tie — the order (and the
// relegation choice built on it) is always unambiguous, and an exact win+net tie retains the
// longer-tenured (lower-seniority) incumbent.
const byRank = (a: Standing, b: Standing): number =>
  b.wins - a.wins || b.net - a.net || a.member.seniority - b.member.seniority;

// Rank a gauntlet-clearing challenger against the current arena and keep the top N. #1 is King.
// An empty arena crowns the lone challenger by default; with room to spare a challenger that LOSES
// its fights still enters at its true rank (C2 join-if-room); a FULL arena relegates its weakest
// (the (N+1)-th by the total order) to seat a higher-ranked challenger — unless the challenger is
// itself the weakest, in which case it is `unplaced` and the arena is untouched.
export const rankArena = (input: {
  defenders: readonly Standing[];
  challenger: Standing;
  n: number;
}): ArenaPlacement => {
  const ranked = [...input.defenders, input.challenger].sort(byRank);
  const members = ranked.slice(0, input.n).map((standing) => standing.member);
  const [relegated] = ranked.slice(input.n);
  const challengerIndex = ranked.indexOf(input.challenger);

  // The challenger fell outside the top N — cleared, but ranked below every defender of a full
  // arena. It joins no arena and relegates no one (the arena keeps its own top N unchanged).
  if (challengerIndex >= input.n) {
    return { members, outcome: "unplaced", rank: null, displaced: null };
  }

  const rank = challengerIndex + 1;

  return {
    members,
    outcome: rank === 1 ? "crowned" : "entered",
    rank,
    // The challenger survived the cut, so any relegated contestant is a displaced defender (at most
    // one — the contested set is the ≤ N current defenders plus a single challenger).
    displaced: relegated ? relegated.member : null,
  };
};
