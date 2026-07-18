# Plan: `/dojo` pose lab (replay-viewer "make it fight" — Story 1)

**Branch**: feat/dojo-pose-lab
**Status**: Active

Story 1 of the "make it fight" arc (`plans/replay-viewer-fight-stories.md`); design source
`plans/replay-viewer-fight-decisions.md` (esp. **M9** acceptance/DoD, **M10** control surface).
The harness the later slices (heads · scale · bends · connect) are built and signed off on.

## Goal

A developer opens a permanent dark route `/dojo` and poses two fighters — through the **real**
`scene()`/`createStage` render pipeline driven by a hand-built synthetic tape — to tune the
current pose model in isolation.

## Acceptance Criteria

- [x] Navigating to `/dojo` renders **two stickmen** on the dark canvas via the real
  `scene()` + `createStage` pipeline (a synthetic tape, not a real replay). Route ships
  **dark**: no `Nav` link, `noindex,nofollow`, absent from the sitemap. *(Slice 1 · #329)*
- [ ] **Per-figure controls** set the frame's pose fields **freely** — posture, facing,
  attacking, attackBand, guardBand, throwing, knockdown — with **no valid-combo constraint**;
  an engine-impossible combo (e.g. knockdown + throwing) renders per `poseFor` precedence
  without error.
- [ ] A **world-gap slider with move-reach snap presets** (empi 95k … ushiro 330k) sets the
  distance between the two figures; the two roots sit `gap` sub-units apart.
- [ ] **No `src/` change.** All existing suites stay green. New pure modules covered by
  exhaustive **exact-assertion** tests (`.test.tsx`) + a **manual mutator scan** (`web/` is not
  Stryker-reachable — Stryker is node-only); a per-slice **manual visual sign-off in `/dojo`**.

## Cross-cutting notes

- **Reuse, don't fork.** The lab imports `scene`, `createStage`, and the `ReplayFrame` /
  `ReplayTape` types from `../replay/`. Poses render through the identical projection that
  ships in `/watch` — "what you tune is what ships." Story 1 renders the **current** pose model
  only (brand-picker heads = Story 2; big/bent/connecting = Stories 3–5).
- **New pure modules** (the tested units): a **controls→frame** mapper and a **synthetic-tape
  builder** (`FigureControls × gap → ReplayTape`), plus the **reach-preset table** (mirrors the
  engine move reaches, exactly as `WORLD_WIDTH` mirrors `rules.ts` — `web/src` can't import
  `src/`). The Pixi mount (`DojoStage`) is the thin impure edge — mirrors `ReplayPlayer`'s mount
  but **no ticker/transport** (static per control state); asserted via scene-graph, like
  `figures.test`.
- **Positioning**: figures are centered on the world midpoint (`WORLD_WIDTH/2`); `a.x = mid −
  gap/2`, `b.x = mid + gap/2`, projected by `scene` via `pxPerSubunit`. Export `WORLD_WIDTH`
  from `scene.ts` (behavior-preserving) so the builder reuses it rather than re-mirroring.
- **Free combos** ⇒ the controls expose the raw `ReplayFrame` pose fields (not a single
  mutually-exclusive action enum), so nonsensical combinations are reachable by design (M10).
- **Determinism** isn't at stake (no `src/`, no PRNG), but the builder + mapper are **pure**,
  matching the rest of `web/src`.

## Slices

Three behavior-change slices, each one PR. `mutation-testing` is **N/A** on every slice (`web/`
is not Stryker-reachable); the proportionate alternate evidence is exhaustive exact-assertion
tests + a mandatory manual mutator scan + a `/dojo` visual sign-off (M9). No reduction program.

### Slice 1: `/dojo` renders two default-posed fighters through the real pipeline — ✅ MERGED (#329)

**Value**: Developer navigates to `/dojo` and sees two stickmen (challenger mid-strike vs king
idle, at gyaku-zuki reach) on the dark canvas — proving the new route + synthetic tape + real
`scene()`/`createStage` path end-to-end. The surface every later slice is demoed on.
**Path**: `/dojo` request → Vercel rewrite → `dojo.html` shell → `dojo.tsx` entry →
`render(<DojoApp/>)` → pure **synthetic-tape builder** (default `FigureControls` + default gap)
→ `scene(tape, 0, viewport)` → `createStage().apply(...)` → two figure roots on the Pixi canvas.
Deployable, dark.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing` (browser-mode Pixi
mount). `mutation-testing`: N/A (`web/` not Stryker-reachable) → manual mutator scan.
`refactoring`: the `WORLD_WIDTH` export is a tiny behavior-preserving extraction — assess only.
**Reduction program**: N/A.
**Acceptance criteria** (confirm before code):
- Rendering `DojoApp` mounts a Pixi stage whose scene graph holds **two figure roots** (assert
  via the returned nodes, like `figures.test` — not pixels).
- The default synthetic tape encodes challenger `attacking` at `attackBand` mid + king idle,
  both at world-mid ± (gyaku 240k)/2, facing each other — asserted on the **pure builder
  output** (exact `ReplayFrame` fields + projected `scene` positions).
- `/dojo` route resolves in the built app (html shell + vite input + vercel rewrite); it is
  **not** linked from `Nav`, is `noindex,nofollow`, and is **not** in the sitemap.
- All existing suites green; **no `src/` change** (only `WORLD_WIDTH` gains an `export`).
**RED**: A `.test.tsx` asserting the pure builder returns the exact default two-fighter
`ReplayTape` (fields + positions) — fails (builder absent). Then a browser test asserting
`DojoApp` mounts a stage with two figure roots — fails (component absent).
**GREEN**: Minimum: the builder returning the default tape; `dojo.html` + `dojo.tsx` + the
`DojoStage`/`DojoApp` mount reusing `createStage`/`scene`; vite input + vercel rewrite; export
`WORLD_WIDTH`.
**MUTATE or alternate evidence**: N/A (Stryker node-only). Alternate: exact-assertion tests on
every builder field + a manual mutator scan of the builder + `DojoStage`; visual sign-off in
`/dojo`.
**KILL MUTANTS**: N/A → manual scan addresses any weak assertion.
**REFACTOR**: Assess the `WORLD_WIDTH` export + any shared centering helper; only if it adds value.
**Done when**: all criteria met, existing suites green, manual scan + visual sign-off done,
human approves the commit.

### Slice 2: Per-figure controls re-pose each fighter (free combos)

**Value**: Developer changes a figure's pose fields (posture · facing · attacking · attackBand ·
guardBand · throwing · knockdown) and that figure re-poses live — the articulation/heads tuning
affordance — including engine-impossible combinations.
**Path**: control input → reactive `FigureControls` state → pure **controls→frame** mapper →
synthetic-tape builder → `scene()` → `DojoStage.apply()` re-renders the figure.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`. `mutation-testing`:
N/A → manual scan. `refactoring`: assess.
**Reduction program**: N/A.
**Acceptance criteria** (confirm before code):
- The controls→frame mapper is **total and exhaustive**: each posture (0/1/2 + out-of-range →
  STAND fallback via `poseFor`), each action field, and **free combos** (e.g. `knockdown` +
  `throwing` → PRONE wins by precedence) map to the exact `ReplayFrame` — asserted on the pure
  mapper.
- Changing a control in the browser updates the rendered figure's scene-graph joints (assert
  the pose via the pure path; a representative browser interaction proves the wiring).
- Both figures are independently controllable (challenger vs king).
**RED**: `.test.tsx` cases asserting the mapper's `FigureControls → ReplayFrame` output for each
field + the free-combo cases — fail (mapper absent).
**GREEN**: The pure mapper + the control components wired to per-figure reactive state feeding
the builder.
**MUTATE or alternate evidence**: N/A → exhaustive exact-assertion tests (every field, every
posture, the precedence combos) + manual mutator scan + visual sign-off.
**KILL MUTANTS**: N/A → manual scan.
**REFACTOR**: Assess control-component duplication (challenger/king share one control group).
**Done when**: all criteria met, suites green, manual scan + visual sign-off, human approves.

### Slice 3: World-gap slider with move-reach snap presets sets the distance

**Value**: Developer sets the distance between the two fighters — snapping to any real move's
engine reach (empi 95k … ushiro 330k) or dragging freely — to verify spacing/contact at true
fight distances (the calibration affordance later slices depend on).
**Path**: slider/preset input → reactive `gap` (sub-units) → synthetic-tape builder centers the
pair at `world-mid ± gap/2` → `scene()` → `DojoStage.apply()` repositions both roots.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`. `mutation-testing`:
N/A → manual scan. `refactoring`: assess.
**Reduction program**: N/A.
**Acceptance criteria** (confirm before code):
- The **reach-preset table** exactly mirrors the M10 engine reaches (empi 95k, throw 120k,
  sweep 180k, uraken 200k, kizami 210k, gyaku 240k, tobi 250k, shuto 260k, mae 270k,
  mawashi 300k, yoko 315k, ushiro 330k) — asserted value-by-value (mirror, documented like
  `WORLD_WIDTH`).
- Given a chosen `gap`, the builder places the two roots exactly `gap` sub-units apart, centered
  on the world midpoint — asserted on the pure builder (projected `scene` positions).
- Moving the slider / selecting a preset in the browser repositions both figures live.
**RED**: `.test.tsx` asserting (a) the preset table values and (b) `buildTape(..., gap)` root
separation = `gap` centered — fail.
**GREEN**: The preset table + gap→positions in the builder + the slider/preset controls wired to
reactive `gap`.
**MUTATE or alternate evidence**: N/A → exact-assertion tests (each preset value; separation
math for several gaps incl. 0 and max) + manual mutator scan + visual sign-off (jump to
"gyaku 240k", confirm the pair sits at that world distance).
**KILL MUTANTS**: N/A → manual scan.
**REFACTOR**: Assess; fold the default gap (Slice 1) onto the preset table.
**Done when**: all criteria met, suites green, manual scan + visual sign-off, human approves.

## Pre-PR Quality Gate (every slice)

1. Mutation: **N/A** (`web/` not Stryker-reachable) — perform the **manual mutator scan** and
   record it.
2. Refactoring assessment — run `refactoring`; record `N/A` when nothing adds value.
3. `npm run typecheck` + `npm run lint` pass; `npm test` green (node + web + web-ssr projects).
4. DDD glossary: N/A (project isn't DDD).
5. **Manual visual sign-off in `/dojo`** (M9) — the web canvas can't be screenshot-regressed
   (agent-browser hangs on the Pixi page); the scene-graph assertions + manual scan are the guard.

---
*Delete this file when the plan is complete. If `plans/` is empty, delete the directory.*
