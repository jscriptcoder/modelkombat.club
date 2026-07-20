# Plan: S7 — compare the whole arsenal at a glance (contact sheet)

**Branch**: move-poses-s7-contact-sheet
**Status**: ✅ Complete — shipped #376 (`7199f04`); archived 2026-07-20 in the arc closeout

Split from `plans/move-poses-stories.md` (S7) via `planning` (2026-07-20), after web-render
reconnaissance of the `/dojo` + `scene()` seams and two settled design decisions (below). Feeds TDD.
The slice loads `tdd`, `testing`, `front-end-testing` before code changes and completes
RED → GREEN → (Stryker `N/A` for `web/` ⇒ manual mutator scan) → refactor assessment.

## Goal

A new dark `/sheet` route renders all 13 arsenal moves simultaneously as a labelled grid — each move's
**attacking figure only**, frozen at its **active-phase** pose — so a developer can compare every
technique at a glance and catch any two that read alike (the arc's carried expressiveness risk).

## Why now

S7 was deliberately deferred until poses differed (decision 5: "a contact sheet serves _comparison_,
worthless until poses differ — build it today and you get a grid of 13 identical stickmen"). S0–S6 have
all shipped, so all 13 moves now render as their own technique; S7 is the **detector** that verifies
that thesis holds across the whole roster and that the generic fallback reads acceptably for the ~5
undescribed, rarely-thrown moves (`plans/move-poses-stories.md:84`).

## Settled design decisions (2026-07-20)

| #   | Decision         | Choice                                                                                                                                                           | Why                                                                                                                                                                                                                                                                                                                                            |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | **Cell content** | **Attacker only**, at active-phase peak; opponent omitted                                                                                                        | The arc's thesis is the _attacker's_ limb shape ("does the side kick read like the back kick?"). Solo sidesteps the **accepted** close-range overlap (`empi` 95k / `hiza-geri` 110k interpenetrate at true reach, decision g) — noise in a comparison grid. The driven endpoint still solves to its true-reach target; we just don't draw `b`. |
| B   | **Placement**    | **New dark `/sheet` route** (like `/dojo`: not in Nav, not prerendered)                                                                                          | Keeps the single-figure tuning stage focused; the grid is a separate layout + concern. MPA mechanics are cheap and known (HTML shell + `.tsx` mount + `vite.config.ts` input + `vercel.json` rewrite).                                                                                                                                         |
| C   | **Frame**        | **Static**, one frame per move at its **active phase** (tick = `preset.startup`, where `phaseAt` → 2, the driven endpoint at the solved target, not the chamber) | Peak extension is when a technique is most itself. Motion between phases is **S8's** job — S7 must not pull it forward.                                                                                                                                                                                                                        |
| D   | **Rendering**    | **One Pixi canvas, N grid-positioned sub-containers** — not 13 `Application`s                                                                                    | 13 `Application`s = 13 WebGL contexts (browsers cap ~16 — fragile). One canvas + a single-figure draw primitive is the sound architecture and the one bit of real engineering here.                                                                                                                                                            |
| E   | **Labels**       | Raw **move id** per cell (the `Text` HUD idiom, `figures.ts:241`)                                                                                                | The story AC is "labelled with its move id." Editorial glosses ("jab", "roundhouse") stay parked (parking lot).                                                                                                                                                                                                                                |

## Non-negotiable constraints

- **`web/` only.** No `src/`, no engine, no TCB, no `BENCHMARK_VERSION` bump. The pure render path
  (`REACH_PRESETS` → `selectMove` + `controlsToFrame` → `buildDojoTape` → `scene(tape, preset.startup,
viewport).a`) is entirely reused; S7 adds a new page + a grid draw layer around it.
- **The shipped 2-figure ring stays untouched.** `createStage`/`scene`'s `{a, b, hud}` contract and the
  `/dojo` + `/watch` pages must not regress. Expose the single-figure draw primitive by **widening
  visibility** (add `export`) or a new module — do not restructure the ring.
- **`web/` is not under Stryker** (project memory). Mutation testing is `N/A`; substitute **exhaustive
  exact-assertion scene-graph tests + a MANDATORY manual mutator scan** against `mutation-testing`'s
  `resources/mutator-rules.md`, recorded in the PR (per [[public-page-web-ui]]).
- **`/sheet` ships dark:** reachable in dev + prod, but **no Nav link** and **not prerendered** (mirrors
  `/dojo` — client-rendered only).

## Acceptance Criteria

- [ ] Visiting `/sheet` renders **13 figures**, one per arsenal move id in `REACH_PRESETS`
- [ ] Each figure is **labelled with its move id**
- [ ] Each figure is posed at its move's **active phase** — the driven endpoint sits at the solved
      strike target, **distinct from its chamber** (i.e. mid-technique, not idle/wound-up)
- [ ] **Only the attacking figure** is drawn per cell (no opponent figure in the scene graph)
- [ ] The set of rendered cells **equals the set of `REACH_PRESETS` move ids exactly** (key-set
      coverage — decision 10 pattern; a future move cannot be silently dropped from the sheet)
- [ ] An **undescribed** move (no `MoveDescriptor`) still renders via the **generic fallback** pose
      (M7 totality) — no blank cell
- [ ] `/sheet` is reachable in dev and prod (vite input + vercel rewrite), **not** in `Nav`, **not**
      prerendered
- [ ] Full suite green; `typecheck` + `lint` + `format:check` clean; `BENCHMARK_VERSION` unchanged at `v19`

## Slices

Read `.claude/CLAUDE.md` + testing rules before writing slices. One vertical slice: the contact sheet
is a single observable behavior (the sheet loads showing 13 labelled moves), presentation-only, reusing
the pure `scene()` path. The one engineering risk (a single figure drawn in a shared canvas) is proven
by the slice's **first** TDD increment before widening to 13 — see the fallback split note below.

### Slice 1: A dark `/sheet` page renders all 13 moves as a labelled grid, attacker-only, at active phase

**Value**: Actor — the developer vetting the arsenal. Trigger — opening `/sheet`. Observable outcome —
13 labelled figures, each mid-technique, laid out in a grid, comparable side by side. This is the
detector for the arc's expressiveness risk.
**Path**: new `web/sheet.html` shell + `web/src/pages/sheet/sheet.tsx` mount → `SheetApp` component →
new contact-sheet stage (one Pixi canvas, N grid cells: figure + label `Text`) ← `scene(tape,
preset.startup, viewport).a` per move ← `buildDojoTape({ a: moveFrame, b: idleOpponent, gap:
preset.reach })` ← `controlsToFrame(selectMove(base, id))` ← iterate `REACH_PRESETS`. Observability —
the rendered grid + headless scene-graph cell assertions.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing` (Vitest Browser Mode +
the injectable-stage spy idiom from `DojoApp.test.tsx`). `mutation-testing`: **N/A** — `web/` is outside
Stryker; proportionate alternate evidence = exhaustive exact-assertion scene-graph tests + a manual
mutator scan. `refactoring`: assess whether the `figures.ts` figure primitive is worth exporting vs a
small local draw helper.
**Reduction program**: N/A.
**Transition/terminal evidence**: N/A.
**Acceptance criteria**: the story ACs above. **Present to the human and get confirmation before
writing any code.**
**RED (failing behavior tests, in increment order):**

1. **Seam first (the risk):** a headless test builds the contact-sheet stage for a **single** move and
   asserts one figure's driven-limb node is placed at the active-phase strike position within its cell
   container (relation, not literal — decision 9). Proves one-figure-in-a-shared-canvas end to end.
2. **Widen:** the stage built over all `REACH_PRESETS` ids renders **13 cells**, each cell's label
   `Text` === its move id.
3. **Active phase:** for a sample authored move, the driven endpoint at `preset.startup` differs from
   its chamber position (mid-strike, not wound-up).
4. **Attacker-only:** each cell's scene graph contains exactly one figure (no opponent node).
5. **Key-set coverage:** the set of cell ids === the set of `REACH_PRESETS` keys.
6. **Fallback totality:** an undescribed move id still produces a non-empty posed figure (generic hand).
7. **Page wiring:** `SheetApp` with an injected `sheet` spy feeds all 13 move ids to the stage.
   **GREEN**: export (or locally replicate) a single-figure draw primitive from `figures.ts` without
   touching `createStage`; new `contact-sheet` module builds one canvas + N grid cells (figure + label)
   from `scene(...).a`; new `/sheet` page (shell + mount + `vite.config.ts` input + `vercel.json` rewrite).
   Minimum grid layout — a simple wrapping grid sized to fit 13 cells.
   **MUTATE**: N/A (Stryker excludes `web/`) → **manual mutator scan** over the new module against
   `resources/mutator-rules.md` (wrong-limb, collapsed-phase, dropped-cell, off-by-one grid index, label
   mismatch), recorded in the PR; exact-assertion tests are the alternate evidence.
   **KILL MUTANTS**: strengthen tests for any scan-surfaced gap; ask the human when a survivor's value is
   ambiguous.
   **REFACTOR**: assess the figure-primitive extraction (export vs local helper) and grid-layout math for
   clarity; only if it adds value; keep the 2-figure ring green.
   **Done when**: all ACs met; suite + typecheck + lint + format clean; manual mutator scan recorded; the
   human approves the commit.

**Fallback split (only if the seam fights back):** if the single-figure-in-shared-canvas draw proves
harder than the reconnaissance suggests, split into **1a** (seam + one-cell walking skeleton, RED #1)
and **1b** (widen to 13 + labels + coverage, RED #2–7). Default is one PR; this is the escape hatch,
not the plan.

## Pre-PR Quality Gate

1. **Mutation**: `N/A` (Stryker excludes `web/`) — review the manual mutator-scan record + exact-assertion coverage
2. **Refactoring assessment**: figure primitive + grid math (`refactoring` skill); record `N/A` if no value
3. **Typecheck + lint + format** pass
4. **DDD glossary check**: `N/A` — project is not DDD

## Out of scope (explicitly deferred)

- **Motion / easing** between phases — that is **S8**, and pulling it in would re-judge every curve.
- **Click-through** from a cell into `/dojo`'s pose lab — a nice affordance, not the AC.
- **Opponent / contact context** per cell (decision A chose attacker-only) — a possible later ghost overlay.
- **Editorial glosses** ("jab", "roundhouse") on labels — parked (parking lot).
- **Per-phase columns** (startup/active/recovery side by side = 39 figures) — the AC is one frame per move.

---

_Archived 2026-07-20 (arc closeout). Shipped as PR #376; the contact sheet is live at `/sheet`._
