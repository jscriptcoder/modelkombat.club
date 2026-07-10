# KotH ladder — story split (story-splitting record)

**Source of truth:** `plans/koth-ladder-decisions.md` (D1–D7, C1–C7, find-gaps-tightened).
**Date:** 2026-07-10. Feeds `planning` (one slice at a time) → TDD, **PR per slice**.

## Parent (reframed)

> **A bot author's fighter competes against a bounded, ranked arena of past champions — not just
> the single last King — placing among them or taking the crown; deposed champions stay reachable;
> and every clearing fight is reproducible.**

Actor: the bot author (via the human courier) at `POST /fight`, plus the `/king`+podium viewer.
Current constraint: today's single-throne KotH deletes a deposed King from contention and hides the
non-transitive richness; making it a ranked arena is a **stateful store re-architecture** (C6) far
too big for one PR.

**The slicing lever:** N is a per-version constant that dials from **1 (≡ today's single throne)** to
∞. So the first slice can re-architect the store to the arena shape **at N=1**, changing _no observable
behavior_, and let the entire existing test suite prove the scary re-arch. Every later slice turns on a
real, user-visible increment of the multi-champion capability.

---

## Recommended first slice

**S1 — the arena walking skeleton (N=1, behavior-preserving).** Re-architect the single-champion
throne into a top-N _arena record_ + generation-guarded atomic commit, configured at **N=1** so the
`/fight` + `/king` behavior is byte-for-byte today's.

**Why first:** it burns down the biggest risk (C6, the stateful core) in isolation, using the full
existing `/fight`+`/king` suites as a characterization harness — green tests == the re-arch preserved
behavior. It's a steel thread through the real production path (submit → rank → arena CAS → `/king` →
response), not throwaway: it's the permanent foundation every later slice builds on. Matches this repo's
walking-skeleton culture. **Value is architecture/validation, stated explicitly** — no new user feature.

---

## Split candidates

| Slice                                             | Value                                                                                                                                                  | Includes                                                                                                                                                                                                                                                                                  | Defers                                                                                                 | Release                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| **S1 — Arena skeleton (N=1)**                     | Architecture/validation: proves the arena data model + gen-guarded commit end-to-end with **zero behavior change**                                     | Arena record (ranked list, ≤N docs) + entry-seniority counter + arena-generation CAS; `handle-fight` reworked to "rank the N+1, keep top N, #1 is King" **at N=1**; `ThroneStore` port + in-memory fake + Upstash adapter + shared contract all extended together; `/king` reads arena[0] | N>1, ranking texture, relegation-when-full, C4 mirror-reject, archive, richer telemetry, podium change | Shippable — identical observable behavior                                                            |
| **S2 — The ranked arena becomes real (N=3)**      | **New capability:** a clearer competes against up to 3 champions; #1 = King, 2..N = defenders who **stay reachable**; full arena relegates its weakest | Flip N→3; win→net→seniority ranking (strict total order); crown/enter/relegate; C4 mirror-reject; C2 bootstrap "join if room"; D3 re-entry (fresh junior seniority); response says crowned/entered/unplaced + rank                                                                        | Podium still shows only King; full per-defender telemetry board; archive/replay                        | Shippable — multi-champion ladder live (visible via `/fight` placement + that deposed kings persist) |
| **S3 — The podium shows the ranked arena**        | **Viewers** see the top-N defenders publicly, ranked (King + challengers-in-waiting), not last-N-by-time                                               | `/king` returns the ranked arena (`current`=arena[0], `recent`=arena[1..] **by rank**); web podium renders top-N in rank order (gold/silver/bronze), identity-only; sparse/empty states reused                                                                                            | Full telemetry board; archive/replay                                                                   | Shippable — user-visible                                                                             |
| **S4 — Arena-placement telemetry board**          | A clearer (placer **or** non-placer) can diagnose how to place/crown without regressing its 6/6 — generalizes PR #250 from 1 King to N defenders       | Per-defender gauntlet-fidelity board (identity + winRate/W-L-D/net/endReasons/degrade vs each), final rank, `crowned`/`entered`/`unplaced`, displaced identity; docs never exposed                                                                                                        | Archive/replay                                                                                         | Shippable — high value for the LLM authoring loop                                                    |
| **S5 — Fights are reproducible (last-K archive)** | Every clearing fight becomes replayable raw material for the future `/replay` + viewer                                                                 | Reproduction record `{challenger doc, defender docs, seeds, version}` appended **atomically with the arena commit**; last-K count eviction; current-arena records **pinned** (un-pin on relegation); fake + Upstash + contract extended                                                   | The `/replay` endpoint + Pixi viewer (separate roadmap items)                                          | Shippable — archive populated; no read surface yet, nothing breaks                                   |

**Dependencies:** S1 → S2 → {S3, S4, S5 independent of each other}. After the arena is real (S2), the
podium (S3), telemetry (S4), and archive (S5) can ship in any order / be reprioritized or dropped.

---

## Acceptance examples (per slice)

**S1 — Arena skeleton (N=1)**

- Given an empty v19 throne, when a gauntlet-clearer submits, then it is crowned at arena[0]
  seniority 1 — identical to today's `throne-empty-crowned`.
- Given an occupied N=1 arena, when a clearer out-ranks the King, then it takes the crown and the old
  King is removed (N=1 full) — identical to today's dethrone; a level/losing fight retains the King.
- Given the full existing `/fight` + `/king` + throne-store-contract suites, when run against the
  arena-backed store, then all pass unchanged.
- Given two concurrent crowns, when both commit, then one lands and the other gets
  `409 /problems/throne-moved` (CAS preserved on the arena record).

**S2 — Ranked arena real (N=3)** — the core new behavior

- Given N=3 and arena `[King]`, when a clearer beats the King, then it is crowned #1 **and the old King
  becomes defender #2** (not removed — stays reachable).
- Given a full arena `[#1,#2,#3]`, when a clearer out-ranks #2 but not #1, then it enters at #2, the
  rest shift, and the previous #3 relegates.
- Given a full arena, when a clearer ranks below all three, then `unplaced`, arena unchanged.
- Given a win+net tie with a defender, then the longer-tenured (lower seniority) bot ranks higher.
- Given a submission byte-identical to a current defender, then it is rejected as a no-op (C4).
- Given a relegated former champion re-submitted by its author that now out-ranks the arena, then it
  re-enters with a fresh junior seniority (D3).

**S3 — Podium shows the arena**

- Given a populated N=3 arena, when `/king` is read, then `current`=arena[0] and `recent`=arena[1..] in
  **rank** order (not crowning time).
- Given the home page, then the Hall of Kings shows the top-N defenders rank-ordered (gold=King), identity only.
- Given an under-full/empty arena, then the podium shows the existing sparse/empty states.

**S4 — Placement telemetry**

- Given a clearer that placed at #2, then `/fight` returns rank=2, outcome=`entered`, a per-defender
  board (each defender's identity + the challenger's winRate/W-L-D/net/endReasons/degrade vs it), and
  the displaced defender's identity.
- Given a non-placer, then it still gets the full per-defender board + `unplaced`.
- Given any response, then no defender's document appears (identity only).

**S5 — Reproduction archive**

- Given a gauntlet-clearer's commit, then a reproduction record `{challenger doc, defender docs, seeds,
version}` is appended atomically with the arena commit (and nothing is archived on a 409).
- Given more than K records, when one is appended, then the oldest **non-pinned** record is evicted;
  current-arena members' records are never evicted.
- Given a bot relegates, then its record un-pins and becomes evictable.

---

## Parking lot

- **`/replay` endpoint + Pixi viewer** — consume S5's archive; **separate roadmap items**, out of scope
  of the ladder feature (per the decisions doc).
- **Real seasons** (scheduled resets) — deferred (D5); "version bump = reset" covers v1.
- **Edge/pairwise cache** — deferred; recompute is cheap enough (D-consequences).
- **Exact K, and any N beyond the v1 default of 3** — tunable config, chosen at planning/deploy time.

## Warnings

- **The original (1)–(5) seam list is a component split** (data model / handler / UI / storage /
  telemetry) — do **not** plan it that way; use these vertical slices instead.
- **S1 delivers no user feature** — it is an explicit architecture/validation slice. Justified by risk
  burn-down; if the team prefers, its diff can be the first commit(s) of S2 rather than a merged PR. But
  a standalone S1 keeps the risky re-arch provable in isolation (recommended).
- **S2 is the largest slice** (store re-arch fully exercised + ranking + relegation + crowning). If it
  proves too big at planning time, sub-split **at the arena-full boundary**: (2a) ranking + crown/enter
  while the arena is still filling (bootstrap only, no relegation) → (2b) relegation once full. Do **not**
  sub-split into API-vs-logic layers.
- **Store adapter parity is within-slice, not a separate slice.** Every store-touching slice (S1, S5)
  extends the in-memory fake **and** the Upstash adapter **and** the shared `runThroneStoreContract`
  together — resist an "in-memory now, durable later" component split; the contract test enforces parity.
- **TCB / invariants:** all slices are platform-layer (`src/http`) only; no DSL op, no engine change;
  the archive stores docs+seeds (never tapes — invariant #1); replays render behavior only (doc-privacy).

## Next step

Load **`planning`** for **S1 (arena skeleton, N=1)** to sequence it into PR-sized TDD stages — each
stage running RED→GREEN→MUTATE→KILL→REFACTOR before the next. Optionally run **`find-gaps`** on this
split first if you want the slice boundaries pressure-tested before planning.
