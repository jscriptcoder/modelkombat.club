# Plan: S4 — gauntlet calibration lock + feature close-out

**Branch**: feat/gauntlet-calibration-lock (Slice 1, PR #143); chore/gauntlet-modernization-close-out (Slice 2)
**Status**: ✅ Done — the final slice; the gauntlet modernization feature is COMPLETE.
**Parent**: [`gauntlet-modernization-stories.md`](gauntlet-modernization-stories.md) (slice S4 — archived alongside)

> **Outcome.** Landed the CI lock (`src/cli/gauntlet-calibration.test.ts`): a band
> test (all 6 members' round-robin win-rate ∈ `[0.25, 0.75]`) + a coverage test (all
> 11 `moves` keys referenced), each with a committed "guard bites" proof. Both GREEN on
> the frozen v14 roster ⇒ a certification pass, **not** a rebalance (no bot/rules change,
> `BENCHMARK_VERSION` stays `v14`). Final board + coverage map recorded in
> [`../benchmark-gauntlet-v14.md`](../benchmark-gauntlet-v14.md). `benchmark-config.ts`
> mutation 100% (10/10); full suite 1046 green.
>
> **Bundled fix (discovered while verifying):** the frozen bot texts were pinned to LF
> via `.gitattributes` (`bots/*.json text eol=lf`) and `INPUT_HASH` re-pinned to the
> canonical all-LF value (`5bae2d64…` → `5a503468…`). The old pin was a fragile
> mixed-ending state (grappler LF, others CRLF) that broke the `INPUT_HASH` guard on a
> fresh Windows checkout under `core.autocrlf`. Line endings don't affect parsing/fights
> ⇒ scores byte-identical, version unchanged; `docs/spec.md` regenerated.

## Goal

Certify + CI-lock the modernized gauntlet with **capability acceptance tests** — a
band-membership test (all 6 members ∈ `[25%, 75%]`) and a full-coverage test (every
`CANONICAL_RULES.moves` key referenced by some member) that FAIL on any future drift —
then close out the whole feature (final `docs/benchmark-gauntlet-v14.md` + coverage map,
archive the parent split, update STATUS / CLAUDE.md / memory).

## Context — both end-state conditions already hold (v14)

S1–S3 achieved the target: all 6 members are in band and the full 11-move arsenal is
covered. So the acceptance tests — **RED until both conditions first held**, per the
parent split — are **GREEN on arrival** in S4. This is therefore a **pure certification
pass, not a rebalance**: no bot/rules change, no `BENCHMARK_VERSION` / `INPUT_HASH` bump
(nothing that feeds the hash changes), replay stays byte-identical. The S4 balance-
escalation contingency ("one tuning PR if a member is still out-of-band") is **not
triggered** — no member is out of band.

v14 round-robin (the state being locked):

| Member     | Win-rate | Band `[25, 75]` |
| ---------- | -------- | --------------- |
| `sweeper`  | 67%      | ✅ (7 margin)   |
| `vulture`  | 68%      | ✅ (7 margin)   |
| `grappler` | 58%      | ✅              |
| `rekka`    | 41%      | ✅              |
| `zoner`    | 35%      | ✅              |
| `jabber`   | 31%      | ✅ (6 margin)   |

Every member clears both edges with margin (nearest: jabber +6 above 25, sweeper/vulture
−7 below 75), so the membership invariant is robust, not knife-edge.

Coverage (11 `moves` keys, all referenced): `sweep`→sweeper; `kizami-zuki`→jabber/rekka;
`gyaku-zuki`→rekka/zoner/grappler/sweeper/vulture; `mae-geri`,`mawashi-geri`→zoner(/rekka);
`uraken`→vulture; `shuto`→jabber; `yoko-geri`,`ushiro-geri`→zoner; `empi`,`hiza-geri`→grappler.

**Move-reference shape (for the coverage extraction):** a bot references a move via an
`attack` action's `.move` field; the `sweep` move is referenced via its own `{type:
"sweep"}` action; the walk action `{type: "move", dir}` is NOT a move reference (exclude
it). `throw` is a top-level `Rules` field, not a `moves` key ⇒ out of the coverage set.

## Acceptance Criteria

- [ ] A **band-membership** test asserts each of the 6 gauntlet members' round-robin
      win-rate ∈ `[0.25, 0.75]`; it **fails** if any member drifts out of band (proven
      by a targeted violation during development).
- [ ] A **coverage** test asserts every `CANONICAL_RULES.moves` key is referenced by some
      gauntlet bot (all 11); it **fails** if a move becomes uncovered.
- [ ] Both tests are GREEN on the frozen v14 roster; full suite + typecheck + lint green;
      `BENCHMARK_VERSION` unchanged (`v14` — no scoring change) ⇒ `npm run fight`
      byte-identical.
- [ ] **Discovered during Slice 1 (bundled in):** the frozen bot texts were pinned to LF
      via `.gitattributes` (`bots/*.json text eol=lf`) and `INPUT_HASH` re-pinned to the
      canonical all-LF value — the old pin was a fragile mixed-ending state (grappler LF,
      others CRLF) that broke on a fresh Windows checkout (`core.autocrlf`). Line endings
      do not affect parsing/fights, so scores are byte-identical and the version stays
      `v14`; `docs/spec.md` regenerated (embeds the hash).
- [ ] `docs/benchmark-gauntlet-v14.md` records the final board + a per-move coverage map.
- [ ] Parent split archived; `docs/STATUS.md`, `.claude/CLAUDE.md`, and memory reflect the
      feature **DONE + locked**; `plans/` emptied (directory removed).

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without a
failing test. Read `.claude/CLAUDE.md` + the testing rules first.

### Slice 1: The calibration lock — band + coverage acceptance tests

**Value**: CI now **fails** on any future change that drifts a member out of `[25,75]` or
drops a move from arsenal coverage — the modernized gauntlet is certified and protected
from regression. Actor: the maintainer / CI. Trigger: a future bot/rules edit. Observable
outcome: a red build the moment the calibration or coverage invariant breaks.
**Path**: new `src/cli/gauntlet-calibration.test.ts` loads the 6 frozen bots → `benchmark()`
round-robin (band) + a rule-scan (coverage) → assertions. No production code change (the
bounds are named locals in the test; the move-extraction lives in the test — per "don't
extract for testability"). Intentionally skipped: any bot/rules edit (nothing is out of
band ⇒ no tuning); adding a `BAND` constant to `benchmark-config.ts` (kept out to avoid
un-killable boundary mutants — the roster sits far from the edges).
**Required implementation skills**: Before code changes, load `tdd`, `testing`,
`mutation-testing`, `refactoring`, and `characterisation-tests` (these are guard tests over
already-correct behavior — GREEN on arrival; effectiveness is shown by failing under a
targeted violation, the documented characterization pattern — precedent: the `INPUT_HASH`
guard test in `benchmark-config.test.ts`).
**Acceptance criteria** (present + confirm before code):

1. New `src/cli/gauntlet-calibration.test.ts`:
   - **Band lock:** for each `name` in `GAUNTLET_NAMES`, run `benchmark({ bot: member,
gauntlet: all 6, SEEDS, MAX_TICKS, CANONICAL_RULES, MATCH })` (the no-mirror rule drops
     the self-match) and assert `winRate` ∈ `[BAND_MIN, BAND_MAX]` = `[0.25, 0.75]`. All 6
     pass on v14. **Effectiveness (dev-time RED):** temporarily swap one member for a stub
     that loses every fight (win-rate 0, out low) ⇒ the band test fails; revert ⇒ green.
   - **Coverage lock:** a local `referencedMoves(bots)` walks each bot's `rules[].do` +
     `default`, collecting every `attack` action's `.move` and mapping the `sweep` action →
     `"sweep"`; assert the set is a superset of `Object.keys(CANONICAL_RULES.moves)` (all 11).
     **Effectiveness (dev-time RED):** temporarily drop `grappler`'s `empi`/`hiza-geri` rules
     ⇒ the coverage test fails naming the missing key; revert ⇒ green.
2. The band bounds are named consts (`BAND_MIN = 0.25`, `BAND_MAX = 0.75`) at the top of the
   test with a comment tying them to the confirmed `[25%, 75%]` calibration target.
3. No production bot/rules/engine change ⇒ `BENCHMARK_VERSION` + `INPUT_HASH` unchanged (the
   hash guard test still passes); `npm run fight` byte-identical.

**RED**: both invariants already hold on v14, so the tests are GREEN on the real roster —
RED is demonstrated per assertion by a **targeted violation** (a member stubbed out-of-band
for the band test; a dropped move reference for the coverage test), documented as the
characterization/guard exception. The tests are written to name the mutator-relevant facts:
the exact bounds (`0.25`/`0.75`, membership not exact win-rate) and the full set of 11
`moves` keys (superset check, not a hard-coded count).
**GREEN**: the frozen roster satisfies both — the tests pass unmodified; no production code
is added.
**MUTATE**: Slice 1 adds **no production code** — run `mutation-testing` to confirm the
existing mutation target (`benchmark-config.ts`) is still 100% (10/10, unchanged), and rely
on the dev-time targeted-violation demonstrations to prove the new guards actually bite
(bots are DATA; the extraction + bounds live in the test, which Stryker does not mutate).
**KILL MUTANTS**: none introduced; confirm no regression on `benchmark-config.ts`.
**REFACTOR**: assess only — one focused test file.
**Done when**: both locks green on v14; each demonstrated to fail under its targeted
violation; full suite + typecheck + lint green; `benchmark-config.ts` mutation still 100%;
no version/hash bump; `npm run fight` byte-identical; human approves commit.

### Slice 2: Close out the feature — final gauntlet-v14 doc + archive the split

**Value**: the certified state is published and the design trail is complete — the gauntlet
modernization feature is done.
**Path**: docs only. Separate PR (the S1/S2/S3 close-out precedent).
**Required implementation skills**: none (docs); no production code ⇒ no TDD cycle.
**Acceptance criteria**:

- `docs/benchmark-gauntlet-v14.md` (matching the `v3`/`v4` format): frozen scoring inputs,
  the final v14 round-robin board (all 6 ∈ band), and a **per-move coverage map** (each of
  the 11 `moves` keys → the member(s) that reference it) certifying 11/11.
- `plans/gauntlet-modernization-stories.md` → `docs/archive/gauntlet-modernization-stories.md`
  (git mv), marked Done; `docs/archive/README.md` gets the parent-split + S4 entries; `plans/`
  removed once empty.
- `docs/STATUS.md`: mark the gauntlet modernization feature **DONE + CI-locked**; "Next in the
  pipeline" item 2 closed (remaining roadmap = deferred jogai/passivity/overtime adoption,
  rounds, air-actions, the no-Pareto-dominance property test).
- `.claude/CLAUDE.md` Status: drop "the gauntlet rebalance (`vulture`, `sweeper`)" from "Not
  yet built"; note the modernized + locked gauntlet.
- Memory: update `gauntlet-modernization.md` + its `MEMORY.md` line to feature-complete + locked.
- Working tree clean; `format:check` passes (LF-normalize the moved file).
  **Done when**: close-out PR merged; `plans/` empty (directory removed).

## Pre-PR Quality Gate

Before the Slice-1 PR:

1. Mutation — `mutation:diff` confirms `benchmark-config.ts` still 100% (no new production
   code ⇒ no new mutants); the new guards' effectiveness is shown by the targeted-violation
   demonstrations.
2. Refactoring assessment (expected: nothing).
3. `npm run typecheck` + `npm run lint` + full `npm test` green.
4. `npm run fight` byte-identical; confirm **no** `BENCHMARK_VERSION` / `INPUT_HASH` change.
5. Coverage bookkeeping: the coverage lock asserts 11/11 — full arsenal.

Note: `.stryker-tmp/` is gitignored but `rm -rf` it before a full-suite run.

---

_On completion the feature is fully shipped: relocate BOTH this plan and the parent split to
`docs/archive/` (git mv, per the archive-plans-not-delete convention) and remove the empty
`plans/` directory._
