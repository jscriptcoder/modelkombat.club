# Move showcase & per-move poses — child stories

Split via `story-splitting` (2026-07-19) from `plans/move-poses-decisions.md` (decisions 1–10,
mechanics M1–M11). Feeds `planning` → TDD, **PR per slice**. Every implementation slice must
load `tdd`, `testing`, `mutation-testing` and `refactoring` before code changes, and complete
RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR before the next slice starts.

## Parent

**A spectator watching a replay can tell which karate technique a fighter just threw.**

- **Actor:** the spectator at `/watch` (primary); the developer tuning poses in `/dojo` (secondary)
- **Capability:** each of the 13 arsenal moves reads as its own technique — recognizable shape,
  wind-up and recovery — instead of all 12 strikes rendering as one hand at a band height
- **Outcome:** fights become legible and worth watching; move design becomes tunable by eye
- **Current constraint:** 13 moves × 3 phases, plus an engine contract change, plus a tuning
  harness that does not exist yet

## Recommended first slice

**S1 — a `mae-geri` renders with a foot instead of a hand.**

**Why this first:** it is the thinnest thing that traverses the _whole_ production path — engine
emits the id → tape carries it → `scene()` reads it → the figure draws differently → visible on
`/watch`. And it burns the arc's single riskiest assumption: that a **foot** can be driven
through the same `reachTargetX` solver as a hand, with the knee re-deriving off `hip→footR` and
the support leg staying planted (M8.2). If that is wrong, everything downstream changes shape,
and this is the cheapest possible way to find out. Notably it needs **neither the picker nor
phases** — pointing the `/dojo` default scene at `mae-geri` makes it visible with the existing
single-tick tape.

## Split candidates

| Slice                                                                                           | Value                                                                                                                                             | Includes                                                                                                                                                        | Defers                                   | Acceptance examples                                                                                                                                                                                                                                                                                                                                                       | Release constraint                 |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| ✅ **S0** — the tape carries move identity + phase _(enabling / validation)_ — **shipped #352** | Proves a move id can be threaded through committed state **without** touching the outcome path — the M11 gate. No visible change.                 | `attackMove` + `attackPhase` on `RenderFrame` (M1, M2); threading the id onto `AttackingState` + both call sites (M2a); web contract mirror                     | Every renderer change                    | Given a fight where A throws `mae-geri`, when the tape is rendered, the frame at the strike tick carries `attackMove: "mae-geri"` and `attackPhase ∈ {1,2,3}` · Given the full suite, when slice 0 lands, determinism/replay tests are green **and** `BENCHMARK_VERSION` is unchanged at `v19`                                                                            | Shippable, invisible               |
| ✅ **S1** — a kick renders with a foot — **shipped #353**                                       | A spectator sees a front kick as a **kick**. Dev learns whether the foot-through-solver assumption holds.                                         | Descriptor table + shared solver; `mae-geri` descriptor (active phase only); `/dojo` default scene set to it; M7 fallbacks; M8 assertion floor                  | Chamber/recovery, picker, other 12 moves | Given the challenger throwing `mae-geri` in range, when the active phase renders, `footR` is the driven endpoint at the mid band and `handR` stays at stance · Given two different fighter gaps, when each renders, the phase-2 `footR.x` differs (solve retained, M8.5) · Given `attackMove: "gyaku-zuki"` (no descriptor), when it renders, the generic hand pose draws | Shippable to `/watch` (M6)         |
| **S2** — a technique winds up and recovers                                                      | Kills the 0.4 s-frozen-at-full-extension defect. Techniques read as _movements_. Unlocks tuning for every later move.                             | Multi-tick `buildDojoTape` spanning real duration; `reach-presets.ts` gains `startup`/`active`/`recovery` (M4); S4 transport reuse; `mae-geri` chamber authored | Per-move chambers for the other 12       | Given `mae-geri` selected, when the dojo tape builds, it spans `startup+active+recovery` ticks and the playhead drives `attackPhase` · Given the playhead on a startup tick, when it renders, `footR` sits at the authored chamber, distinct from its active position (M8.3) · Given the transport, when ◀/▶ steps, playback pauses                                       | Shippable                          |
| **S3** — browse the arsenal in `/dojo`                                                          | **The original ask.** Select any of the 13 and see it. Becomes the authoring harness that makes S4+ fast.                                         | Per-figure move picker absorbing the "Reach preset" dropdown; write-through stamping band + reach + gap (decision 6); `aria-labelledby` naming (M10)            | Contact sheet                            | Given the picker, when `mawashi-geri` is selected, the pose updates **and** the gap snaps to 300k · Given a move selected, when the gap slider moves, the selected move does not change · Given a stamped band, when the band control is changed, the pose follows (M10 free-combos preserved)                                                                            | Shippable                          |
| **S4** — the moves fighters actually throw look distinct                                        | Most spectator-visible value per PR. See **bargain** below.                                                                                       | Descriptors for the highest-usage moves, ordered by `npm run telemetry` move-usage                                                                              | Low-usage tail                           | Given each authored move, when its active phase renders, its driven endpoint differs from every other authored move's · Given the contact of two authored moves at the same band, when both render, they are visually distinguishable                                                                                                                                     | Shippable, per-move PRs            |
| **S5** — close-range techniques lead with the elbow / knee                                      | `empi` and `hiza-geri` are the only moves whose driven point is a **mid-joint**, currently derived rather than authored. Distinct technical risk. | `empi`, `hiza-geri`; mid-joint promoted to a drivable endpoint                                                                                                  | —                                        | Given `empi` active, when it renders, `elbowR` is the driven endpoint and the derived-bend rule does not overwrite it                                                                                                                                                                                                                                                     | Shippable                          |
| **S6** — the non-strike moves read correctly                                                    | Completes the 13. `throw` already has a look; `sweep` and `tobi-geri` compose with existing layers.                                               | `throw`, `sweep`, `tobi-geri` descriptors routed through the same lookup (M2 vocabulary)                                                                        | —                                        | Given `attackMove: "throw"`, when it renders, the two-hand grab draws via the descriptor lookup, not a `throwing` special case · Given `tobi-geri`, when it renders, the `AIR` stance composes with the kick descriptor                                                                                                                                                   | Shippable                          |
| **S7** — compare the whole arsenal at a glance                                                  | Catches "the side kick and the back kick read the same" — the arc's carried expressiveness risk.                                                  | Contact sheet: all 13 rendered simultaneously                                                                                                                   | —                                        | Given the contact sheet, when it loads, 13 figures render, each labelled with its move id                                                                                                                                                                                                                                                                                 | Shippable, deferred until S4 lands |

## The bargain — order S4 by telemetry, not anatomy

The grill's ladder grouped the remaining moves by anatomical family (kicks, then punches). There
is a cheaper ordering available: **`npm run telemetry` already reports move-usage** across the
gauntlet, so we can author the moves that actually appear in fights first.

This matters because the roster is known to be uneven — the dead-move probe (2026-07-13) found
`uraken` and `ushiro-geri` score **zero points** across the gauntlet and are heavily countered.
Authoring their poses early spends the same effort for a technique a spectator may never see
thrown.

**Hard data, measured 2026-07-19** (S2 slice 1 preview check — every committed tick across all
29 replays on the deployed `/replay` API, counted by move):

| Move           | startup | active | recovery |
| -------------- | ------: | -----: | -------: |
| `gyaku-zuki`   |    4040 |   1833 |     9164 |
| `mawashi-geri` |    1820 |    361 |      216 |
| `tobi-geri`    |     120 |     40 |      638 |
| `sweep`        |     324 |    108 |      214 |
| `throw`        |      30 |     10 |       70 |

**Only five of the thirteen moves are ever thrown**, and `gyaku-zuki` alone is ~80% of all
committed time. This is a much sharper bargain than the section assumed: authoring `gyaku-zuki`
and `mawashi-geri` covers nearly everything a spectator will ever see, and the remaining eight
moves have **zero** on-screen presence today.

Note the awkward corollary: **`mae-geri` — the move S1 and S2 authored — is never thrown.** That
was the right choice for the reasons decision 8 gives (it is mid-only and a straight thrust, so
it tests the foot-through-solver risk in isolation), and it is fully visible in `/dojo`. But it
means the arc's authored pose will not appear on `/watch` until S4 reaches a move that fighters
actually use. Worth knowing before anyone concludes the feature "isn't working".

**Recommendation:** before starting S4, re-run this count (or `npm run telemetry`) and order the
descriptors by observed usage — starting with `gyaku-zuki`, which also forces the rear-hand
precedence rule parked in the warnings below. Expect roughly half the roster to carry the great majority of on-screen strikes,
making S4 a genuine bargain — most of the visible value for a fraction of the authoring. The
tail becomes optional rather than obligatory, and can be dropped entirely if the contact sheet
(S7) shows the generic fallback reads acceptably for rare moves.

This also gives S4 a natural stopping rule, which the family split lacks: stop when the next
move's usage no longer justifies the authoring.

## Dependencies

```
S0 ──▶ S1 ──┬──▶ S2 ──▶ S3 ──▶ S4 ──▶ S7
            ├──▶ S5
            └──▶ S6
```

S1 is the only hard fan-in: it establishes the descriptor mechanism every later slice extends.
S5 and S6 depend on S1 but **not** on S2/S3 — they can be reordered or run in parallel if the
picker is not yet needed.

## Parking lot

- **Picker glosses** ("jab", "roundhouse") — S3 presentation detail, from `Arsenal.tsx`
- **Rollback note** — engine field is additive; web slices revert independently
- **Deflected-strike recoil** as a distinct 4th phase (M5 parked it, did not reject it)
- **Defense / uke** — explicitly a later arc (decision 7)
- **`attackProgress`** for smooth interpolation (Q4 deferred; revisit if S2's three poses snap badly)
- **Rear-hand punch precedence** — `gyaku-zuki` on `handL` collides with the guard arm
  (`scene.ts:87`); needs a precedence rule when it lands inside S4

## Warnings

- **S0 is a task, not a story.** No actor, no observable behavior change. Kept as its own PR
  deliberately — M11's byte-identical + no-version-bump gate is far easier to prove in
  isolation than tangled with a renderer change. Framed as a **validation** slice, per the
  "make it useful for learning or validation, and state that explicitly" rule. Do not let this
  become a precedent for component-splitting the rest.
- **S1 pins an assumption in a test.** M8.2 (support integrity) asserts the non-driven foot
  never moves. If the eye later says a raised foot _does_ need hip/support-leg compensation,
  that assertion must be consciously changed — it is a decision record, not a bug.
- **S1 carried a finding into S2: the kick reads _stretched_, not _snapped_.** Visual sign-off
  measured the driven leg at ~67 local px against a ~37 px natural length (1.8×), with the 8 px
  `KNEE_BEND` nearly invisible at that extension. The shipped punch telescopes harder still
  (~53 vs ~27 = 2.0×), so this is **inherited visual language, not an S1 regression** — but it
  answers the arc's open question "what falls out beyond limb + chamber" with: **limb alone is
  not enough.** A kick needs hip travel, a knee-lift chamber, or a bone-length constraint. S2's
  chamber is the natural place to fix it; if the fix moves the hip, it trips the M8.2 assertion
  above, which must then be changed deliberately rather than patched around.
- **S4 has no fixed size.** It is 1–8 PRs depending on the telemetry ordering and where the
  stopping rule lands. Do not plan it as a single unit.
- **The expressiveness risk is still live.** M3 accepts that only the driven endpoint moves, so
  whole-body kick character is not yet expressible. S4 is where four kicks may turn out to look
  alike, forcing decision 3's bespoke escape hatch. S7 is the detector; keep it in the plan.

## Next step

Load `planning` for **S2**. S0 + S1 shipped (#352, #353; plan archived at
`docs/archive/move-poses-s0-s1.md`), so the descriptor mechanism and the driven-endpoint solve
both exist and are proven. S2 is the next slice on the critical path — and it now carries a
finding from S1 that changes what it must deliver, recorded below.
