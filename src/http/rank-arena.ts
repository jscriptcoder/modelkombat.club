// The arena ranking decision — the pure heart of `/fight` crowning, extracted so the N=1
// boundary logic is unit-testable in isolation (the PR #250 extract-to-pure lesson) and is the
// exact seam that widens to the win→net→seniority ranking of N>1 in S2. Platform layer, no engine
// reach: it takes the challenger's already-computed title-fight win rates and the current arena.
import type { ArenaMember } from "./throne-store.js";

export type ArenaRanking = {
  // The new arena after this submission, rank-ordered (`[0]` is the King), length ≤ N.
  members: ArenaMember[];
  // Did the challenger make the arena (crown at N=1)?
  placed: boolean;
  // The challenger's final 1-based arena rank, or `null` when it did not place.
  rank: number | null;
};

// Rank a gauntlet-clearing challenger against the current arena and keep the top N. At N=1 (the
// S1 skeleton) the decision is a single boundary: an empty arena crowns the challenger by default
// (the bootstrap — no fight was run), and an occupied arena crowns it iff it beat the sole
// defender strictly `> 0.5`; a level (`= 0.5`) or losing fight — including a mirror `benchmark`
// skips to `0` — retains the King. `winRates[i]` is the challenger's win rate vs `arena[i]`
// (empty when the arena is). S2 generalizes this to the win-count → net → seniority order.
export const rankArena = (input: {
  arena: readonly ArenaMember[];
  challenger: ArenaMember;
  winRates: readonly number[];
}): ArenaRanking => {
  if (input.arena.length === 0) {
    return { members: [input.challenger], placed: true, rank: 1 };
  }

  if (input.winRates[0] > 0.5) {
    return { members: [input.challenger], placed: true, rank: 1 };
  }

  return { members: [...input.arena], placed: false, rank: null };
};
