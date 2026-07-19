# Plan: S3 — browse the arsenal in `/dojo`

**Branch**: `feat/move-poses-s3-picker`
**Status**: Active
**Story**: S3 in `plans/move-poses-stories.md`; decisions 5, 6, 9, 10 + M10 in
`plans/move-poses-decisions.md`

## Goal

A developer can select any of the 13 arsenal moves in `/dojo` and watch it play, with the
scene set up at that move's true fighting distance.

## Why now

S3 stopped being "the original ask" and became **the blocker**. `/dojo` hard-codes the
challenger to `mae-geri` (`controls.ts:49`), so S2 · Slice 3 could only eye-check a punch by
temporarily editing that constant and reverting. Every slice from S4 on authors a move it
cannot currently select — S3 is the harness that makes the rest of the arc fast.

## What already exists (do not rebuild)

- **The timing + reach mirror** — `reach-presets.ts` carries all 13 moves with `reach`,
  `startup`, `active`, `recovery`, plus `presetFor` / `durationOf` / `phaseAt`. The picker is a
  new **view** onto a table that is already complete and already drift-tested.
- **The tape already reacts to `attackMove`.** `buildDojoTape` derives its span from whichever
  technique is committed (`dojo-tape.ts:58`), and `tick` is clamped on read
  (`DojoApp.tsx:79`) precisely so a shorter move cannot strand the playhead. Changing the move
  id is already sufficient to change playback — nothing in the tape layer needs touching.
- **The descriptor fallback** — an undescribed move draws the generic hand pose
  (`move-descriptors.ts:53`), so all 13 entries are selectable from day one and the 12
  unauthored ones degrade gracefully rather than erroring (M7).
- **The `aria-labelledby`-from-span idiom** for `<select>` and range `<input>`
  (`FigureControlPanel.tsx:68`, `SpacingControl.tsx:42`) — M10 names the new picker the same way.

## Acceptance Criteria

- [ ] Every arsenal move can be selected on either figure, and selecting one plays that
      technique through its own duration
- [ ] Selecting a move sets the scene up for it: the fighters' gap becomes that move's true
      engine reach, and the figure's attack band becomes one the move can legally be thrown at
- [ ] Stamped values stay editable — after a selection, the band, reach and gap controls can each
      be moved freely without the selected move changing (M10 free combos, decision 6)
- [ ] The technique can be replayed from its first tick without scrubbing
- [ ] `/dojo` exposes exactly one move dropdown per figure — the shared "Reach preset" dropdown
      it supersedes is gone
- [ ] No `src/` change: `BENCHMARK_VERSION` stays `v19` and the engine suite is untouched

## Test discipline (repo-specific — read before writing a test)

- `web/` is **not Stryker-reachable**. The substitute is: exhaustive **exact-assertion** tests, a
  scripted **manual mutator scan** over the diff, and a `/dojo` **visual sign-off**. Record the
  scan in the PR body; `MUTATE` is `N/A` with that as the alternate evidence.
- Web test files **must be `.test.tsx`** — the web include glob skips `.test.ts`.
- **Decision 9 — assert the relation, not the literal.** The move table owns its numbers. Assert
  "the gap equals the selected preset's reach", never "the gap is 300000", so re-tuning a move
  never breaks a test.
- `agent-browser` **hangs** on the Pixi-canvas pages — visual checks go through the Playwright
  screenshot driver, not agent-browser.

## Open decision — flagged for approval, not assumed

**Does selecting a move restart playback?** Recommendation: **yes.** Playback auto-pauses at the
final tick, so without this you select a move and see its last recovery frame — the picker would
appear broken on the second selection onward. This does not violate the transport covenant
("seek/step always pause"): a move change is not a transport control, it is a new tape, and the
lab's stated job is to show a technique as a movement. Slice 1 ships Restart first partly so this
behaviour has a tested primitive to reuse. **If rejected**, drop the restart-on-select AC from
Slice 2 and the picker still ships — the developer presses Restart themselves.

## Slices

### Slice 1: Restart replays the technique from its first tick

**Value**: The developer stops having to scrub to 0 and press Play. Found in S2 · Slice 2:
`/dojo` opens playing, runs once and auto-pauses, so it then sits on a recovery frame forever.
**Path**: `/dojo` Restart button → `transport` signal → existing pure `transport.ts` → clamped
`tick()` → `DojoStage` re-poses.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `refactoring`. `mutation-testing` is `N/A`
(web is outside Stryker) — substitute the manual scan above.
**Acceptance criteria**:

- Given playback parked and paused at the final tick, when Restart is clicked, the tick readout
  reads 0 and playback is running
- Given playback mid-tape and playing, when Restart is clicked, it returns to tick 0 and keeps
  playing
- The existing transport controls are unchanged: seek and step still pause

**RED**: A `DojoApp.test.tsx` test that steps to the last tick, clicks Restart, and asserts the
tick readout and the Play/Pause button label.
**GREEN**: A Restart button setting the transport back to `startTransport()`.
**MUTATE**: `N/A` — manual scan. The mutants that matter: Restart seeking to 1 rather than 0, and
Restart leaving playback paused. Both must be covered by the assertions above, which is why the
first AC asserts the tick **and** the running state.
**REFACTOR**: Assess whether "restart" belongs in `transport.ts` as a named function rather than
a bare `startTransport()` call at the call site — decide once Slice 2 needs to reuse it.
**Done when**: ACs met, suite green, human approves the commit.

### Slice 2: Picking a move from a per-figure list poses and plays that technique

**Value**: The arc's original ask, and the harness S4+ depends on. All 13 become reachable.
**Path**: `/dojo` figure panel `<select>` → that figure's `FigureControls` → `controlsToFrame` →
`buildDojoTape` (span follows the new move's timing) → `scene()` → stage.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `refactoring`. `mutation-testing` `N/A` as
above.
**Acceptance criteria**:

- Given the challenger panel, when `mawashi-geri` is selected, the tape spans that move's own
  duration and playback restarts from tick 0
- Given a move is selected, the figure's attack-reach control reads that move's engine reach
- Given the "idle" option is selected, the figure stops attacking and carries no move
- Given a move is selected on the **king**, the king plays it — the picker is per-figure, not
  global
- Given an unauthored move (any but `mae-geri`), when it plays, it draws the generic hand pose
  rather than failing (M7)
- The picker is named from its visible span via `aria-labelledby` (M10)

**RED**: `DojoApp.test.tsx` — select a move, assert the tick readout's `/ lastTick` reflects that
preset's `durationOf` (computed from the imported table, not a literal — decision 9).
**GREEN**: A `<select>` over `REACH_PRESETS` plus an idle row, patching
`{ attackMove, attackReach, attacking }`. Selecting a move stamps `attacking: true`; selecting
idle stamps the idle triple `("", 0, false)` — symmetric, and exactly `DEFAULT_KING_CONTROLS`.
**MUTATE**: `N/A` — manual scan. Watch for: the stamp writing the wrong figure's signal (the
per-figure AC covers it), the idle row stamping a real move, and reach stamped from the wrong
preset field.
**REFACTOR**: Assess whether the stamp belongs in `controls.ts` as a pure
`selectMove(controls, move)` — likely yes, since Slices 3 and 4 both extend the same stamp, and a
pure function is testable without a component.
**Done when**: ACs met, suite green, `/dojo` visual sign-off on at least one kick and one punch,
human approves the commit.

### Slice 3: Picking a move sets the fighters' distance to that move's true reach

**Value**: Completes decision 5's "absorbing" — one control instead of two overlapping ones, and
the scene is set up correctly for the move being judged.
**Path**: figure panel picker → shared `gap` signal → `buildDojoTape` positions → stage.
**Class**: Behavior change (the dropdown removal is part of the same behavior, not a separate
refactor — the control being retired is the one this slice supersedes).
**Required implementation skills**: `tdd`, `testing`, `refactoring`. `mutation-testing` `N/A`.
**Acceptance criteria**:

- Given a move is selected on either figure, the gap becomes that move's reach
- Given a move selected, when the gap slider is dragged, the gap changes and the **selected move
  does not** (stamp-then-let-go, decision 6)
- Given a move selected on each figure in turn, the gap reflects the **most recent** selection
  (last-write-wins, decision 6)
- `/dojo` no longer renders a "Reach preset" dropdown; the Gap slider and its read-out remain

**RED**: Select a move, assert the gap read-out equals that preset's `reach` (from the table);
then a second test that drags the gap and asserts the picker's value is unchanged.
**GREEN**: Add `gap` to the stamp; delete the preset `<select>` from `SpacingControl.tsx`.
**MUTATE**: `N/A` — manual scan. Key mutants: last-write-wins inverted to first-write-wins, and
the gap stamp firing on the gap slider (which would make the free slider un-draggable).
**REFACTOR**: `SpacingControl` may collapse to a bare slider — assess whether it still earns its
own component.
**Done when**: ACs met, suite green, human approves the commit.

### Slice 4: Picking a move sets a band the move can legally be thrown at

**Value**: A stamped band means the developer tunes a pose the engine could actually produce,
instead of unknowingly authoring `mae-geri` at high band (which the engine degrades to idle).
**Path**: picker → `attackBand` on that figure's controls → `poseFor` band height → stage.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `refactoring`. `mutation-testing` `N/A`.

**Note — this slice needs a new mirrored field.** Bands are real engine data
(`rules.ts`: `bands: ["high","mid"]`, `["mid"]`, …) and `web/src` cannot import `src/`, so
`ReachPreset` gains a `bands` list transcribed and pinned value-by-value exactly like `reach` and
the timings. It stays the engine-mirror table under the engine-mirror test discipline — the
aesthetic descriptor table is untouched (decision 10).

**Acceptance criteria**:

- Given a mid-only move (`mae-geri`), when selected, the figure's attack band reads Mid
- Given a multi-band move (`gyaku-zuki`, high·mid), when selected, the band reads its first
  listed band — and the choice of "first" is documented as the primary band, not an accident
- Given a move selected, when the band control is changed by hand, the band follows and the
  selected move does not change (M10 free combos preserved — the story's own example)
- `bands` mirrors every move in `rules.ts` value-by-value, with drift caught by the mirror test

**RED**: A `reach-presets.test.tsx` case pinning all 13 band lists, plus a `DojoApp.test.tsx`
case asserting the band select's value after picking a mid-only and a multi-band move.
**GREEN**: Add `bands` to the table; add `attackBand` to the stamp.
**MUTATE**: `N/A` — manual scan. Key mutant: stamping the **last** legal band rather than the
first (the mid-only move cannot detect it — which is exactly why the multi-band AC exists).
**REFACTOR**: Assess whether `presetFor` should expose a named `primaryBandOf` rather than
callers indexing `bands[0]`.
**Done when**: ACs met, suite green, human approves the commit.

## Explicitly out of scope

- **The contact sheet** — S7, deferred until poses actually differ (decision 5).
- **Picker glosses** ("jab", "roundhouse") — parked in the story's parking lot; the ids are the
  authoring vocabulary and glosses can land with S7's labelling.
- **Authoring any new move's pose** — that is S4, ordered by telemetry, opening on `gyaku-zuki`.
- **Unifying `strikeLean` with `rootTravel`** — carried from S2 · Slice 3. It changes how punches
  look at close range, so it belongs where a punch is being judged by eye: **S4**, not here.

## Pre-PR Quality Gate

Per slice, before the PR:

1. Manual mutator scan over the diff (mutation `N/A` rationale recorded in the PR body)
2. Refactoring assessment
3. `npm run typecheck` + `npm run lint` + `npm test` green
4. `/dojo` visual sign-off via the Playwright screenshot driver (not agent-browser — it hangs on
   the Pixi page)
5. Confirm `BENCHMARK_VERSION` is still `v19` and no `src/` file is touched

---

_Archive this file under `docs/archive/` when the story closes — do not delete it
(`archive-plans-not-delete`)._
