import type { ReplaySummary } from "./replay-contract";

// A card is ambiguous when another watchable fight pits the identically-named challenger against the
// identically-named King (models aside) — a spectator can't tell the two apart by name alone. This
// pure pass flags exactly those, so the list can disambiguate only the colliding cards with a short
// id fragment. web/ is not Stryker-reachable, so it is exhaustively unit-tested with exact cases.
export type MarkedSummary = ReplaySummary & { collides: boolean };

// The pair identity: challenger name + King name, keyed as a JSON pair so two distinct pairs that
// would otherwise concatenate to the same string ("a"+"bc" vs "ab"+"c") never conflate, and any
// quotes/specials in a name are escaped rather than colliding.
const namePairKey = (summary: ReplaySummary): string =>
  JSON.stringify([summary.fighters[0].name, summary.fighters[1].name]);

export const markCollisions = (
  summaries: readonly ReplaySummary[],
): MarkedSummary[] =>
  summaries.map((summary) => ({
    ...summary,
    collides:
      summaries.filter((other) => namePairKey(other) === namePairKey(summary))
        .length > 1,
  }));
