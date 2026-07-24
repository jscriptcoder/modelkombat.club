# Plan: Arsenal move-preview fixes — throw motion & airborne tobi-geri

**Branches**: `feat/throw-eases` → `feat/preview-knockdown-target` → `feat/preview-tobi-geri-airborne`
**Status**: Active
**Decisions**: [`plans/arsenal-preview-fixes-decisions.md`](./arsenal-preview-fixes-decisions.md) (D1–D9, grilled 2026-07-24)

## Progress

| Slice                  | Branch                            | State                                                 |
| ---------------------- | --------------------------------- | ----------------------------------------------------- |
| 1 — throw eases        | `feat/throw-eases`                | ✅ shipped — PR #419, squashed to `main` as `8a98128` |
| 2 — knockdown target   | `feat/preview-knockdown-target`   | ✅ shipped — PR #420, squashed to `main` as `8e00189` |
| 3 — airborne tobi-geri | `feat/preview-tobi-geri-airborne` | green — awaiting commit approval                      |

## Goal

Make the `throw` preview move and the `tobi-geri` preview fly — fixing the shared-renderer defect
behind the first (which freezes real `/watch` throws too) and the missing airborne tape data behind
the second.

## Acceptance Criteria

- [x] A throw is no longer a held still: its hands wind up, grip, and retract across the technique —
      on the Arsenal preview, on `/dojo`, and on a real `/watch` throw
- [x] A throw's contact frame is unchanged — the grip lands on exactly the point it lands on today
- [x] Opening the eye on `throw`, `sweep` or `hiza-geri` shows the dimmed target standing until the
      technique's contact tick, then prone for the remainder of the loop
- [x] The other ten moves' targets never go prone
- [x] Opening the eye on `tobi-geri` shows the attacker leave the ground, rise, kick at the apex,
      descend, land, and recover grounded — while closing the distance toward the target
- [x] The other twelve moves stay grounded at a fixed gap
- [x] A reduced-motion `tobi-geri` preview freezes on an **airborne** contact frame
- [x] "tobi-geri is airborne" has exactly one home — `/sheet`'s `AIRBORNE_MOVES` duplicate is gone
- [x] No `src/` change: engine, TCB and `INPUT_HASH` untouched, `BENCHMARK_VERSION` held at `v19`

## Testing convention (applies to every slice)

`web/` is outside Stryker (`stryker.config.mjs` mutates only `src/**` + `api/**`), so **MUTATE is
`N/A (Stryker)`** throughout. The established proportionate substitute for this repo is:

1. Exhaustive **exact-assertion** tests (not relational-only)
2. A **scripted** manual mutator scan — apply each mutant to real source, run, restore; record a kill
   only when the run **NAMES failing tests**, never from an exit code; assert the baseline is green
   first; normalise needles for CRLF
3. **Visual sign-off** on the relevant surface

## Slices

---

### Slice 1: A throw's hands wind up, grip, and retract instead of holding one frame — ✅ SHIPPED (#419)

> **Landed as designed, with one correction to the shape below.** Deleting the `isGrab` early-return
> was necessary but _not sufficient_: the engine gives a throw its own `state.kind === "throwing"`,
> which emits `attacking: false` (`src/engine/sim.ts`), so `strikeHandFor` bailed one line earlier and
> a throw would still have rendered frozen. The gate became a **commitment** gate reading either
> signal — `if (!striker.attacking && !isGrab(striker.attackMove)) return null;`. `throwGrabFor` was
> deleted outright, and the girdle is held square for a grab (rotation models one shoulder swinging
> ahead of a _resting_ one; a two-handed grab has no resting shoulder). Net **−24 lines** in
> `scene.ts`. Scan: 11 mutants applied, 10 killed, 1 equivalent survivor (`limb: "handR"` is
> indistinguishable from `GENERIC_LIMB` under today's data).

**Value**: A spectator watching a `/watch` throw — and a visitor opening the Arsenal `throw` preview —
sees a technique execute rather than a frozen pose. Today `throwGrabFor` (`scene.ts:925`) never reads
`attackPhase`, so all 23 ticks render byte-identically on every surface.

**Path**: `attackMove:"throw"` on a tape frame → `scene()` → `poseFor` → `easeDriven` → the driven
`handR` plus a derived `handL` → `figures.ts` strokes it. Observable on `/dojo` (scrub), `/sheet`
(still), the Arsenal preview, and `/watch`.

**Class**: Behavior change.

**Required implementation skills**: `tdd`, `testing`; `mutation-testing` → `N/A (Stryker)` with the
scripted scan above; `refactoring` assessed after green.

**Reduction program**: `N/A`.

**Transition/terminal evidence**: `N/A`.

**Shape** (the design the RED should drive out, not a licence to skip it): author `throw` as a real
descriptor — `{ limb: "handR", grab: true, targetY: <GRAB_Y>, chamber: {...} }` — and delete the
`isGrab` early-return in `strikeHandFor` (`scene.ts:897`). `targetYFor` then supplies the chest height
the way it already supplies `sweep`'s floor height, `driven` eases through the normal path, the
endpoint ternary writes `handR`, and the grab layer narrows to placing `handL` a `GRAB_SPREAD` behind
the **eased** `handR`. The throw stops being a special case and becomes "a move that drives one hand
to a fixed height, with a second hand riding along."

**Acceptance criteria** — _present and confirm before writing code_:

1. Scrubbing `throw` in `/dojo` shows the grip hands in three distinct positions across startup /
   active / recovery, where today all 23 ticks are identical
2. Both hands remain `GRAB_SPREAD` apart at every tick — it still reads as a two-handed grab, never
   one hand leading and one left behind
3. Contact is unchanged: at the active phase the lead hand lands on today's exact solved point
4. The torso commits — a throw is no longer held rigid at lean 0 / step 0 / girdle 0
5. `/watch` renders a real throw through the same changed path (no separate branch)

**RED**: A multi-tick throw tape asserting the lead grab hand differs between a startup tick and an
active tick. This fails today for the right reason — `throwGrabFor` returns the identical point for
both. Add the two-hand-spread invariant across ticks as a second failing case.

> **Verify during RED, don't assume:** the 8 exact-coordinate cases in `scene.test.tsx:887-1030` build
> **single-tick tapes with no `attackPhase`**, so they take `scene.ts:445`'s M7 totality branch
> (`phase !== 1 && !== 2 && !== 3 ? strikeHand`) and should land on today's values untouched. But
> `driven` becomes non-null, which un-gates the derived **lean** (`scene.ts:483`). Those tests assert
> hands only, and `handR`/`handL` are written from the solved point independent of lean — so they are
> _expected_ to stay green. Confirm that empirically before treating criterion 3 as met, and check
> whether any other test asserts a throwing figure's shoulder / head / elbow.

**GREEN**: The descriptor entry, the `strikeHandFor` gate deletion, and the narrowed grab layer.
Nothing more — no recovery waypoint (D2 parks it).

**MUTATE**: `N/A (Stryker)` → scripted scan. Mutants to target explicitly: restoring the `isGrab`
early-return; dropping `targetY` from the descriptor; `handL` offset sign flip; `handL` derived from
the _solved_ point rather than the _eased_ one (the subtle one — invisible at single-tick, visible
only across a multi-tick run).

**KILL MUTANTS**: Address survivors; ask when value is ambiguous. A survivor on a condition may mean
the condition is dead — check which before writing a test for it.

**REFACTOR**: Assess whether `throwGrabFor` still earns its own function once it only places one
derived hand, or folds into the layer spread. Only if it adds value.

**Done when**: All five criteria met, the scan report is presented, `/dojo` scrub sign-off passes
(D9 — this is the gate; a real `/watch` throw is opportunistic confirmation, not required), and the
human approves the commit.

---

### Slice 2: The target drops for the three moves that knock it down — ✅ SHIPPED (#420)

> **Two departures from the shape below, both deliberate.** (1) The transform is **not exported** —
> everything the acceptance criteria describe, totality included, is observable through `moveLoopTape`,
> and exporting a single-caller helper purely to unit-test it is the anti-pattern the `testing` skill
> names. (2) The `knockdown` column mirrors the engine's **behaviour**, not one engine field: `sweep`
> and `hiza-geri` carry a literal `knockdown: true` on their move specs, but `throw` has no such field
> and downs its victim through `applyThrow` (`sim.ts`: `def.state = { kind: "downed" }`, unconditional
> on a landed grab). Same outcome, two engine expressions — recorded in the table and its pinning test
> rather than left for the next reader to rediscover.

**Value**: A visitor opening the eye on `throw`, `sweep` or `hiza-geri` sees the technique's actual
outcome. `sweep` and `hiza-geri` both **score 0** — the knockdown is their entire payload — so today
those two previews fail to show the only thing the move does.

**Path**: eye control → `moveLoopTape(move)` → a pure tape transform reading the preset table's new
`knockdown` column → `b.knockdown` set from the contact tick → `poseFor`'s existing full-body `PRONE`
early return → the dimmed target lies down. Preview only.

**Class**: Behavior change.

**Required implementation skills**: `tdd`, `testing`; `mutation-testing` → `N/A (Stryker)` + scan;
`refactoring` assessed.

**Reduction program**: `N/A`.

**Transition/terminal evidence**: `N/A`.

**Shape**: add `knockdown?: boolean` to `ReachPreset` (`web/src/pages/dojo/reach-presets.ts`), true
for `throw` / `sweep` / `hiza-geri`, pinned value-by-value by the existing drift test. Add an exported
pure transform over a built tape that sets `b.knockdown` from `preset.startup` (the first active tick,
already what `contactFrame` computes) to the end. Compose it in `moveLoopTape`. No new render
mechanism — `PRONE` already ships.

**Acceptance criteria** — _present and confirm before writing code_:

1. For each of `throw`, `sweep`, `hiza-geri`: the target is upright on every tick before contact and
   prone on every tick from contact to the end of the tape
2. For all ten other moves the target is never prone on any tick
3. The transform is total — an unknown move id passes the tape through unchanged
4. The preset table declares `knockdown` for exactly those three moves, pinned against `rules.ts`
5. The attacker's own frames are untouched by the transform

**RED**: Assert the target's `knockdown` is false before contact and true at contact for `sweep`
(deliberately not `throw` — it proves this is a table-driven rule, not a throw special case). Plus a
negative case on a scoring move.

> The timing needs no wake-up modelling — `knockdownDuration` is 18 and every one of the three stays
> down past its own tape end (`throw` 7→23, `sweep` 7→22, `hiza-geri` 9→27). Pin that as an
> assertion, not a comment.

**GREEN**: The column, the transform, the composition. Nothing else.

**MUTATE**: `N/A (Stryker)` → scripted scan. Target: off-by-one on the contact tick (`>=` → `>`);
`knockdown` flipped on a fourth move; the transform applied to `a` instead of `b`; the `?? false`
default inverted.

**KILL MUTANTS**: Address survivors.

**REFACTOR**: Assess. Likely `N/A` — one column, one pure function.

**Done when**: criteria met, scan report presented, preview eye-check on all three moves plus one
scoring move, human approves the commit.

---

### Slice 3: tobi-geri leaps, kicks at the apex, and lands

> **Arithmetic conflict found before RED — AC5 is binding, the Shape line is loose.** The engine's
> constants are `jumpImpulse: 12000` / `gravity: 4000` / `jumpXSpeed: 10000` (`rules.ts`), giving six
> airborne ticks (1–6) and therefore **60000 of total travel** — which is where the decisions doc's
> "60000" came from; it is the trip, not the per-tick speed. But contact is tick 4, by which point only
> **40000** has been travelled. So opening at `reach + total travel` would leave the foot **20000
> short** at contact, contradicting AC5's "one true `reach` away at contact". The opening gap is
> therefore `reach + travel-through-contact` = `250000 + 40000 = 290000`, and the attacker lands at
> `230000` — inside reach, past where it kicked, which is what a real jump-in does.

**Value**: A visitor opening the eye on the arsenal's only aerial technique sees it performed in the
air. Today `ATTACKER_BASE` pins `posture: 0` and `controlsToFrame` pins `y: 0`, so it previews as a
grounded front kick — and because the descriptor deliberately authors **no chamber** (the AIR stance's
tucked foot _is_ the wind-up), a grounded tobi-geri also has no wind-up at all: `easeDriven` lerps
stance→stance and the figure holds still through startup and recovery.

**Path**: eye control → `moveLoopTape("tobi-geri")` → a pure arc transform writing per-tick `y`, `x`
and derived `posture` → `scene()`'s existing lift (`scene.ts:1044`), AIR stance (`scene.ts:82`),
shrinking ground shadow (`scene.ts:1159`) and airborne hip-step suppression (`scene.ts:510`). Preview,
plus `/sheet` dedupe.

**Class**: Behavior change.

**Required implementation skills**: `tdd`, `testing`; `mutation-testing` → `N/A (Stryker)` + scan;
`refactoring` assessed.

**Reduction program**: `N/A`.

**Transition/terminal evidence**: `N/A`.

**Shape**: add `air?: boolean` to `ReachPreset` (true for `tobi-geri`). Add a small jump-physics
mirror module beside `reach-presets.ts` holding `jumpImpulse` / `gravity` / `jumpXSpeed` and a pure
`jumpArc()` that **integrates** `y += vy; vy -= gravity` — pinned against the sequence `rules.ts:328`
documents in prose (`12000, 20000, 24000, 24000, 20000, 12000, 0`). Add an exported pure transform
that, for an `air` move, writes per-tick `y` from the arc, per-tick `x` closing by `jumpXSpeed` while
airborne, and `posture = y > 0 ? 2 : 0`. Open the gap at `reach + total travel` so it closes to
`reach` at contact. Retire `/sheet`'s `AIRBORNE_MOVES` in favour of the column.

**Acceptance criteria** — _present and confirm before writing code_:

1. `jumpArc()` reproduces the engine's documented sequence exactly, integrated from the mirrored
   constants (not stored as a literal array)
2. In a `tobi-geri` preview tape: `y` is 0 at tick 0, rises to the 24000 apex, and is back to exactly
   0 at tick 7 and every tick after
3. `posture` is 2 on exactly the ticks where `y > 0`, and 0 at ticks 0 and 7+
4. Contact (the first active tick, 4) falls on the held apex
5. The attacker closes toward the target while airborne and is one true `reach` away at contact, so
   the reach-to-target solve lands the foot on the near edge
6. All twelve non-`air` moves keep `y` 0, `posture` 0 and a fixed gap on every tick
7. `/sheet` still renders `tobi-geri` from the AIR stance, now sourced from `preset.air`, with
   `AIRBORNE_MOVES` deleted
8. A reduced-motion preview freezes on tick 4 — an **airborne** contact frame

**RED**: Assert the tobi-geri preview tape's `y` sequence and derived posture. Fails today at tick 1
(`y` is 0 everywhere). Add the non-air negative case and the `/sheet` sourcing case.

**GREEN**: The column, the physics module, the transform, the composition, the `/sheet` swap.

**MUTATE**: `N/A (Stryker)` → scripted scan. Target: `gravity` sign; the arc truncated one tick early
(would leave the figure landing below ground or never landing); `posture` threshold `y > 0` → `y >= 0`
(floats the figure at launch/landing); the `air` gate dropped (all moves jump); x travel applied in
the wrong direction; the opening gap not widened (contact lands short).

**KILL MUTANTS**: Address survivors.

**REFACTOR**: Assess whether the two preview transforms (slice 2's and this one) share a shape worth
naming. Only if it adds value — two functions is not yet a pattern.

**Done when**: criteria met, scan report presented, preview eye-check on `tobi-geri` plus one grounded
move, `/sheet` still correct, human approves the commit.

## Known accepted costs (from D5 / D7 — do not "fix" these silently)

- **~67% of tobi-geri's 0.58s loop is grounded recovery.** Accepted. The recovery is not static
  (`easeDriven` retracts the foot across it). Trimming the tail is the parked escalation **if** visual
  sign-off says it dominates — raise it, don't unilaterally trim.
- **Posture flips 2 → 0 at touchdown**, swapping the stance keyframes mid-technique, so the retract
  target changes at tick 7 and may pop. This is exactly what `/watch` does on a real landing. Report
  what it looks like at sign-off rather than pre-solving it.
- **A travelling attacker drifts off `buildDojoTape`'s symmetric centring.** Framing in the small
  popover is an eye-tune, not a mechanism — do not add centring machinery for it.

## Pre-PR Quality Gate (each slice)

1. Mutation → `N/A (Stryker)`; present the scripted scan report with named killing tests
2. Refactoring assessment recorded (may be `N/A`)
3. `npm run typecheck` and `npm run lint` pass
4. `npm run format` is repo-wide and fails on a pre-existing violation in
   `docs/archive/variety-telemetry-s3a.md` — **format only the slice's own files**
5. Full web suite green; run `--project web-ssr` checks from the **repo root** only
6. DDD glossary check — `N/A` (project does not use DDD)

---

_Delete this file when the plan is complete. Per the standing rule, completed plans are **archived**
under `docs/archive/` with a README entry, never deleted._
