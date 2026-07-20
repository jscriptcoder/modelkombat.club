# Move showcase & per-move poses — child stories

> ✅ **ARC COMPLETE (2026-07-20) — all stories shipped (S0–S8).** Archived in the arc closeout alongside
> `move-poses-decisions.md` and the per-slice plans (`move-poses-{s0-s1,s2,s3,s4,s5,s6,s7,s8}.md`). Every
> one of the 13 arsenal moves reads as its own technique on `/watch`, can be compared on the `/sheet`
> contact sheet, and now flows (winds up → contact → re-chambers). This file is the historical split
> record; see `docs/STATUS.md` item 9 and `docs/archive/README.md` for the closeout narrative.

Split via `story-splitting` (2026-07-19) from `plans/move-poses-decisions.md` (decisions 1–10,
mechanics M1–M11, later extended to M14). Feeds `planning` → TDD, **PR per slice**. Every implementation
slice must load `tdd`, `testing`, `mutation-testing` and `refactoring` before code changes, and complete
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

| Slice                                                                                                                      | Value                                                                                                                                             | Includes                                                                                                                                                                                                 | Defers                                                                                  | Acceptance examples                                                                                                                                                                                                                                                                                                                                                       | Release constraint                 |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| ✅ **S0** — the tape carries move identity + phase _(enabling / validation)_ — **shipped #352**                            | Proves a move id can be threaded through committed state **without** touching the outcome path — the M11 gate. No visible change.                 | `attackMove` + `attackPhase` on `RenderFrame` (M1, M2); threading the id onto `AttackingState` + both call sites (M2a); web contract mirror                                                              | Every renderer change                                                                   | Given a fight where A throws `mae-geri`, when the tape is rendered, the frame at the strike tick carries `attackMove: "mae-geri"` and `attackPhase ∈ {1,2,3}` · Given the full suite, when slice 0 lands, determinism/replay tests are green **and** `BENCHMARK_VERSION` is unchanged at `v19`                                                                            | Shippable, invisible               |
| ✅ **S1** — a kick renders with a foot — **shipped #353**                                                                  | A spectator sees a front kick as a **kick**. Dev learns whether the foot-through-solver assumption holds.                                         | Descriptor table + shared solver; `mae-geri` descriptor (active phase only); `/dojo` default scene set to it; M7 fallbacks; M8 assertion floor                                                           | Chamber/recovery, picker, other 12 moves                                                | Given the challenger throwing `mae-geri` in range, when the active phase renders, `footR` is the driven endpoint at the mid band and `handR` stays at stance · Given two different fighter gaps, when each renders, the phase-2 `footR.x` differs (solve retained, M8.5) · Given `attackMove: "gyaku-zuki"` (no descriptor), when it renders, the generic hand pose draws | Shippable to `/watch` (M6)         |
| ✅ **S2** — a technique winds up and recovers — **all 3 slices shipped #355, #356, #357**                                  | Kills the 0.4 s-frozen-at-full-extension defect. Techniques read as _movements_. Unlocks tuning for every later move.                             | Multi-tick `buildDojoTape` spanning real duration; `reach-presets.ts` gains `startup`/`active`/`recovery` (M4); S4 transport reuse; `mae-geri` chamber authored; fixed bone lengths + a capped root step | Per-move chambers for the other 12                                                      | Given `mae-geri` selected, when the dojo tape builds, it spans `startup+active+recovery` ticks and the playhead drives `attackPhase` · Given the playhead on a startup tick, when it renders, `footR` sits at the authored chamber, distinct from its active position (M8.3) · Given the transport, when ◀/▶ steps, playback pauses                                       | Shippable                          |
| ✅ **S3** — browse the arsenal in `/dojo` — **all 4 slices shipped #358, #359, #360, #361**                                | **The original ask**, and by the time it was built, the blocker. Select any of the 13 and see it. The authoring harness S4+ depends on.           | Restart; per-figure move picker absorbing the "Reach preset" dropdown; write-through stamping band + reach + gap (decision 6); `bands` added to the engine mirror; `aria-labelledby` naming (M10)        | Contact sheet                                                                           | Given the picker, when `mawashi-geri` is selected, the pose updates **and** the gap snaps to 300k · Given a move selected, when the gap slider moves, the selected move does not change · Given a stamped band, when the band control is changed, the pose follows (M10 free-combos preserved)                                                                            | Shippable                          |
| ✅ **S4** — the moves fighters actually throw look distinct — **6/6 slices shipped #363–#367, archived**                   | Most spectator-visible value per PR. See **bargain** below.                                                                                       | Descriptors for the highest-usage moves, ordered by `npm run telemetry` move-usage                                                                                                                       | Low-usage tail                                                                          | Given each authored move, when its active phase renders, its driven endpoint differs from every other authored move's · Given the contact of two authored moves at the same band, when both render, they are visually distinguishable                                                                                                                                     | Shippable, per-move PRs            |
| ✅ **S5** — close-range techniques lead with the elbow / knee — **both slices shipped #369, #370, archived**               | `empi` and `hiza-geri` are the only moves whose driven point is a **mid-joint**, currently derived rather than authored. Distinct technical risk. | `empi`, `hiza-geri`; mid-joint promoted to a drivable endpoint                                                                                                                                           | —                                                                                       | Given `empi` active, when it renders, `elbowR` is the driven endpoint and the derived-bend rule does not overwrite it                                                                                                                                                                                                                                                     | Shippable                          |
| **S6** — the non-strike moves read correctly                                                                               | Completes the 13. `throw` already has a look; `sweep` and `tobi-geri` compose with existing layers.                                               | `throw`, `sweep`, `tobi-geri` descriptors routed through the same lookup (M2 vocabulary)                                                                                                                 | —                                                                                       | Given `attackMove: "throw"`, when it renders, the two-hand grab draws via the descriptor lookup, not a `throwing` special case · Given `tobi-geri`, when it renders, the `AIR` stance composes with the kick descriptor                                                                                                                                                   | Shippable                          |
| ✅ **S8** — a technique flows instead of snapping between three held poses — **shipped #377** _(new, from S2's eye check)_ | The largest remaining gap between "the phases are correct" and "this reads as a movement". Affects all 13 moves and `/watch` as well as `/dojo`.  | Easing between the phase endpoints — stance → chamber → extension → chamber — so the limb travels rather than teleporting; the phase-boundary tick positions stay exactly where the engine puts them     | Which easing curve; whether a distinct recovery pose is still wanted once motion exists | Given a committed technique, when consecutive ticks within one phase render, the driven endpoint has MOVED between them · Given the tick at each phase boundary, when it renders, the endpoint is the authored one (easing must not shift where contact happens) · Given an unauthored move, when it renders, it still eases through its stance (M7 totality)             | Shippable                          |
| ✅ **S7** — compare the whole arsenal at a glance — **shipped #376**                                                       | Catches "the side kick and the back kick read the same" — the arc's carried expressiveness risk.                                                  | Contact sheet: all 13 rendered simultaneously                                                                                                                                                            | —                                                                                       | Given the contact sheet, when it loads, 13 figures render, each labelled with its move id                                                                                                                                                                                                                                                                                 | Shippable, deferred until S4 lands |

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
            ├──▶ S5                  └──▶ S8
            └──▶ S6
```

S1 is the only hard fan-in: it establishes the descriptor mechanism every later slice extends.
S5 and S6 depend on S1 but **not** on S2/S3 — they can be reordered or run in parallel if the
picker is not yet needed.

**S8 (interpolation) is placed after S4 on purpose.** It reads as the most dramatic improvement
available, which makes it tempting to pull forward — but easing between endpoints is only worth
building once the endpoints are the RIGHT ones. Authoring the high-usage moves (S4) first means
S8 eases poses worth easing; doing it earlier means re-judging every curve as each descriptor
lands. It is also the one story that changes how `/watch` looks without authoring anything new.

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
- ~~**S1 pins an assumption in a test.**~~ **RESOLVED by S2 · Slice 3 — M8.2 stands unchanged.**
  The hip _does_ now travel on a long kick, but capping that step at 16 local px keeps the
  support leg's own stretch to ~1.13×, so `footL` stays planted and the assertion never had to
  be touched. The tripwire was real but never fired.
- ~~**S1 carried a finding into S2: the kick reads _stretched_, not _snapped_.**~~ **RESOLVED by
  S2 · Slice 3 (#357), and the diagnosis was wrong.** "The limb telescopes to 1.8× its natural
  length" measured `hip → foot` distance as if it were bone length. It is not — a folded knee
  _should_ bring the foot near the hip. The real defect was one level down: `deriveBend` offset
  the mid-joint by a fixed 8 px, so the bones it implied were `√((span/2)² + 8²)` and **stretched
  with the reach**. Bone length is now the invariant and the mid-joint solves for it; drift at
  contact fell 0.72 → 0.28.
- **The body cannot reach the engine's distances, and this is structural.** `BODY_HEIGHT_SUB` is
  240_000 and the opening distance is 240_000, so fighters stand **one body-height apart** while
  an arm spans 0.35 of that and a leg 0.48. Nothing human-proportioned reaches its own height,
  and drawing cannot fix a ratio the engine owns — scaling magnifies gap and body together. So
  the original stretching was **the compromise that made contact legible**, not an oversight, and
  S2 · Slice 3 replaced it with a bounded one (a capped root step plus a bounded residual
  stretch) rather than eliminating it. Any future slice tempted to "fix the stretch properly"
  should read `docs/archive/move-poses-s2.md` first.
  **S3 · Slice 3 turned this from an argument into something you can see**, from both ends at
  once: standing the pair at each move's true reach makes `empi` (95k) render as two
  interpenetrating figures — heads overlapping — while `ushiro-geri` (330k) stretches the arm
  enormously. **This lands on S5**, whose two moves (`empi`, `hiza-geri`) are exactly the
  close-range pair that cannot currently be drawn without overlap. S5 must confront it, not
  inherit it.
- **Two moves have no band list, and absent means UNRESTRICTED.** `sweep` and `throw` declare no
  `bands` in `rules.ts`, and `bandLegal` (`sim.ts:613`) reads that as _every_ band being legal —
  not none. The sweep is gated by hurtbox occupancy; a throw is a grab with no height. Any future
  work tempted to "fill in the missing bands" would be inventing a restriction the engine does
  not impose (S3 · Slice 4 resolved this).
- **S4 has no fixed size.** It is 1–8 PRs depending on the telemetry ordering and where the
  stopping rule lands. Do not plan it as a single unit.
- **The expressiveness risk is still live.** M3 accepts that only the driven endpoint moves, so
  whole-body kick character is not yet expressible. S4 is where four kicks may turn out to look
  alike, forcing decision 3's bespoke escape hatch. S7 is the detector; keep it in the plan.

## Arc complete (2026-07-20)

**All stories shipped — S0–S8.** The full design trail is archived: the per-slice plans at
`docs/archive/move-poses-{s0-s1,s2,s3,s4,s5,s6,s7,s8}.md`, the decisions record at
`docs/archive/move-poses-decisions.md`, and this split record. PRs: #352 · #353 · #355–#361 ·
#363–#367 · #369 · #370 · #372–#374 · #376 · #377.

What exists and is proven: the descriptor mechanism, the driven-endpoint solve, phase-correct playback
at engine timing, a limb that keeps its bone lengths, the shoulder girdle + torso rotation (M12), the
**mid-joint-as-driven-endpoint inversion** (M13), the non-strike moves (a fixed-height sweep, an airborne
kick, a descriptor-dispatched throw), a working authoring harness (`/dojo`), the `/sheet` contact-sheet
detector, and **easing between the phase keyframes** (M14). **The full 13-move roster reads as its own
technique on `/watch`**, every move dispatched through the single `attackMove` descriptor lookup, and
every technique now _flows_ rather than snapping between three held poses.

Explicitly **not** in this arc, and available as future work: **defense / _uke_ poses** (decision 7 — a
parallel arsenal with its own read-game semantics), and the two parking-lot follow-ups still open
(per-segment easing curves / a distinct recovery pose as `/dojo` eye-tuning; the deflected-strike recoil
as a distinct 4th phase; the `strikeHandFor`/`driven` rename now that "driven" is a blended mid-joint-or-
endpoint point).

**✅ S8 outcome (shipped #377, 2026-07-20): a technique flows instead of snapping between three held
poses — the arc's finale.** The driven endpoint (and the lean / girdle / mid-joints derived from it) now
**travels** stance → chamber → extension → chamber → stance across the tape's per-phase run, on `/watch`
and `/dojo` alike, authoring nothing new. Grilled → **M14** (`move-poses-decisions.md`): progress derived
in-web via a `phaseRunAt` run-length scan (no engine field, `BENCHMARK_VERSION` held at `v19`); one shared
smoothstep curve on a swappable seam; reuse the chamber as the retract waypoint; and the load-bearing
insight that making `driven` a continuous keyframe blend (`easeDriven`) preserves body-coherence + the
fixed-bone-length invariant (S2 · Slice 3) **for free** — `deriveSkeleton` re-solves each mid-joint from
the eased endpoints. The solved extension lands on the **first active tick** (a _kime_ commit — revised
during TDD from a mid-active-peak sketch that broke the S7 contact sheet + dojo default, which render each
move at its first active tick). `web/`-only. 11 tests + two real mutation kills on the run-scan's
move/phase boundary; 598 web / 2233 full suite green. Plan: `docs/archive/move-poses-s8.md`.

**✅ S7 outcome (shipped #376, 2026-07-20): compare the whole arsenal at a glance.** A dark `/sheet`
contact sheet renders all 13 techniques in a labelled grid, each attacker posed at its ACTIVE phase — the
**detector** for M3's carried expressiveness risk. Pure `contact-sheet.ts` (`contactSheetCells`, mirroring
the `selectMove → buildDojoTape → scene` path `/watch` ships) + `figures.ts` `createContactSheet` (a grid
of single figures on one Pixi canvas, reusing the private `createFigure`/`applyFigure`; one canvas + N
grid cells, not 13 WebGL contexts). `tobi-geri` is posed AIRBORNE so it doesn't false-flag as `mae-geri`.
`web/`-only, `BENCHMARK_VERSION` held at `v19`. **Sign-off confirmed the detector works**: the 8 authored
moves read distinctly; the 5 undescribed tail moves read alike via the generic fallback — **accepted**,
per the S4 stopping rule (line 84). Live plan `plans/move-poses-s7.md` (archive in closeout).

**✅ S6 outcome (closed 2026-07-20): the non-strike moves read correctly.** All three shipped PR-per-slice
(`plans/move-poses-s6.md`, archived at `docs/archive/move-poses-s6.md`): **(1)** `sweep` → a low front-leg
reap (`footR` driven to a fixed near-ground `targetY`, band-independent since a sweep's band is UNRESTRICTED
— new `MoveDescriptor.targetY`) (#372); **(2)** `tobi-geri` → a flying front kick (`footR` from the AIR
stance, an `isAirborne` gate HOLDS the hip so it doesn't step in mid-air, the AIR tuck is the wind-up)
(#373); **(3)** `throw` → dispatched through the one `attackMove` lookup (an `isGrab` descriptor flag),
retiring the last `frame.throwing` render path + the `/dojo` `throwing` control, with `/watch`
byte-identical (the engine emits `attackMove:"throw"` on every throw frame) (#374). `web/`-only,
`BENCHMARK_VERSION` held. **This completes the 13-move roster** — every move now dispatches through the
descriptor table.

**S5 outcome (closed):** both close-range moves render as mid-joint techniques — the elbow / knee
leads to contact and the trailing fist / foot folds back (M13b/c), rooted mid-joints hold the root
(M13f). The **close-range overlap** the harness surfaced in S3 · Slice 3 (M13g) was **accepted**: at
`empi`'s 95k / `hiza-geri`'s 110k reach the figures interpenetrate, and the `/dojo` sign-off read it
as _infighting_, not a z-fighting bug (the tripwire held) — no bespoke overlap treatment was needed.
