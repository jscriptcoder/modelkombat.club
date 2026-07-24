# Plan: Arsenal move preview (hover-to-watch)

**Branch**: feat/arsenal-move-preview
**Status**: Active

## Goal

Let a visitor open a small popover on any Arsenal move — via an 👁 eye affordance
that responds to hover, tap, and keyboard focus — and watch that move play on a
seamless loop (attacker driving into a faint passive target), so the Arsenal
_shows_ each technique instead of only describing it.

## Context & reuse (why this is small)

The animation pipeline already exists and is exactly what a single-move loop needs:

- **`buildDojoTape({a, b, gap})`** (`web/src/pages/dojo/dojo-tape.ts`) turns two
  posed fighters + a world gap into a `ReplayTape` whose span covers the longer
  committed technique — poses run stance→chamber→extension→chamber→stance, so a
  single-move tape **loops with no seam**.
- **`selectMove` / `controlsToFrame`** (`web/src/pages/dojo/controls.ts`) stamp a
  move id onto a fighter (reach, band, `attacking`); **`presetFor`**
  (`reach-presets.ts`) gives each move's reach + timing.
- **`createStage(viewport, brands, board?)` + `scene(tape, tick, viewport)`**
  (`web/src/pages/replay/figures.ts`, `scene.ts`) are the same Pixi draw layer
  `/watch` and `/dojo` ship — "what you tune is what ships".
- **`transport.ts`** is a pure clock; the preview needs a tiny **loop** variant
  (wrap the playhead at span end) instead of the fight's clamp-then-outro.

New, genuinely-testable core is small: a pure `moveLoopTape(moveId)` builder + a
pure loop-wrap. Everything else is a thin Pixi edge (scene-graph assertions only;
`agent-browser` hangs on Pixi → manual capture), consistent with how the viewer,
dojo, and contact-sheet are tested.

## Key decisions (resolved)

- **Trigger**: an 👁 eye affordance per move, opening on **hover + tap + focus**
  (widest reach; works on touch and keyboard). Chosen over hover-only.
- **Subject**: **attacker + a faint passive target** (a dimmed idle partner at the
  move's reach), so strikes visibly connect and `throw`/`sweep` read. The target
  is present in the tape from S1; its _dimming_ (root `alpha`) is a render-edge
  set in the preview stage (S2).
- **Performance**: exactly **one** Pixi `Application`, **lazily** `import()`-ed on
  first open, living in a single portal-mounted popover whose anchor + tape swap
  per move. The home page stays Pixi-free until a visitor first opens a preview.
  We do **not** create 13 canvases or eagerly bundle Pixi into the home chunk.
- **Progressive enhancement**: the eye affordance is **client-only** (revealed on
  mount), so no-JS / prerender renders the Arsenal exactly as today — descriptor +
  badge unchanged, no dead control. The preview is pure enhancement.
- **Popover size**: small — roughly a 200×160 canvas — kept large enough that the
  stickman stays clearly visible but not so big it dominates the row. Anchored to
  the eye icon, flipping above/below to stay on-screen. (Eye-tunable, manual scan.)

Out of scope (follow-up, per the user): deleting the `/sheet` contact-sheet page.

## Acceptance Criteria

- [ ] Hovering, tapping, or keyboard-focusing a move's eye affordance opens a small
      popover previewing **that** move; leaving / Escape / outside-interaction closes it.
- [ ] The previewed stickman performs the move on a **seamless loop** (attacker
      driving into a **dimmed** passive target at the move's reach).
- [ ] Every one of the 13 Arsenal moves has its own working eye preview.
- [ ] At most **one** Pixi `Application` exists at a time; switching moves swaps the
      tape/anchor, it does not spin up a second renderer.
- [ ] The home page ships **no Pixi** in its initial bundle; Pixi loads only after a
      preview is first opened (verified by a lazy/dynamic import boundary).
- [ ] With JS disabled (prerender/SSR), the Arsenal renders exactly as today — no eye
      affordance, roster + descriptors + badges unchanged (existing exact-assertion
      test still passes untouched in spirit; roster data is not edited).
- [ ] `prefers-reduced-motion: reduce` shows a **still** contact-phase frame instead
      of looping.

## Slices

Classified per the planning skill. Web is excluded from Stryker, so every slice's
**MUTATE** step is `N/A — web ∉ Stryker`; preservation strength comes from
exact-assertion tests duplicated independently of production + a **manual mutator
scan** (the repo's standing convention for `web/`). Read `.claude/CLAUDE.md` and the
Arsenal test's mutation-guard note before writing slices.

---

### Slice 1: A pure `moveLoopTape(moveId)` builds a seamless single-move looping tape for every arsenal move

**Value**: The render-model core the animated preview plays. No UI yet — this is the
pure, unit-tested seam (the same shape as `buildDojoTape`) that unlocks S2's walking
skeleton. Independently verifiable, smaller than doing it inside the Pixi mount.
**Path**: `moveId` → `selectMove`/`controlsToFrame` (attacker) + idle facing partner
→ `buildDojoTape({a, b, gap: presetFor(move).reach})` → `ReplayTape`; plus a pure
loop-wrap `loopPlayhead(playhead, span)` for the clock. Consumed by S2's mount.
**Class**: Behavior change (new pure function behavior).
**Reduction program**: N/A.
**Transition/terminal evidence**: N/A.
**Required implementation skills**: `tdd`, `testing`. `mutation-testing` → `N/A —
web ∉ Stryker` (manual mutator scan + independent exact assertions). `refactoring`
assessed after green.
**Acceptance criteria** (confirm before code):

- `moveLoopTape(move)` for **every** move in the roster returns a tape whose span is
  ≥ the move's `durationOf(preset)` — none collapses to a single tick or runs
  backwards (mirror of the dojo-tape "playable span" test).
- The attacker frame is committed to that move (`attacking: true`, `attackMove`
  = move, reach = `presetFor(move).reach`); the partner is idle
  (`attacking: false`, facing the attacker).
- The two figures are placed the move's reach apart (contact distance), centred on
  the ring — reusing `buildDojoTape`'s centring, not re-deriving it.
- `loopPlayhead` wraps: within `[0, span)` it is identity-ish; at/over `span` it wraps
  back into range (seamless loop), and is pure/exact-assertable like `transport`.
- An unknown/`""` move id falls back safely (no throw) — totality, matching M7.
  **RED**: unit tests (node project, `*.test.ts`) asserting span/commit/placement per
  move (parameterized over the roster) + loop-wrap cases — all failing first.
  **GREEN**: minimal builder + wrap composed from the existing dojo/reach-preset
  helpers; no new pose maths.
  **MUTATE**: `N/A — web ∉ Stryker`; independent roster duplication + manual scan.
  **KILL MUTANTS**: N/A (manual scan of arithmetic/boundary in the wrap + span).
  **REFACTOR**: only if it removes duplication vs `buildDojoTape`.
  **Done when**: all criteria met, typecheck + lint green, commit approved.

---

### Slice 2: A visitor opens the eye icon on one move (gyaku-zuki) and watches it loop in a small popover

**Value**: First real observable payoff — a visitor sees a live, looping move. The
walking skeleton wires the whole path end-to-end on the workhorse move: eye
affordance → popover → **lazily-loaded** shared Pixi `Application` → S1 loop tape,
with the passive target dimmed.
**Path**: eye `<button>` on the gyaku-zuki row (client-only reveal) → hover/tap/focus
sets `openMove` signal → portal popover anchored to the icon → on first open,
`await import("pixi.js")` + the preview stage module → `createStage` once →
ticker drives `loopPlayhead` → `stage.apply(scene(moveLoopTape("gyaku-zuki"), tick))`
→ leave/Escape/outside closes and pauses.
**Class**: Behavior change (walking skeleton).
**Required implementation skills**: `tdd`, `testing`, `front-end-testing` (Vitest
browser mode). `mutation-testing` → `N/A — web ∉ Stryker`. `refactoring` assessed.
**Acceptance criteria** (confirm before code):

- The gyaku-zuki row exposes an eye affordance that is a real `button` with an
  accessible name (e.g. "Preview gyaku-zuki"), present only after mount (absent at
  SSR — assert via the prerender path).
- Pointer-enter, tap/click, and keyboard focus all **open** the popover; pointer-leave,
  Escape, and outside interaction **close** it (browser-mode assertions on
  open/close state, e.g. `aria-expanded` + a labelled `dialog`/region).
- The Pixi module is behind a **dynamic import** (assert the home entry does not
  statically import `pixi.js`; import boundary lives in the preview mount).
- The preview stage exposes its scene graph for assertion (like `DojoStage` does):
  the passive target figure's root `alpha` is `< 1` (dimmed), the attacker's is `1`.
- The clock loops (a pure-side assertion on `loopPlayhead` wiring; the WebGL draw
  itself is manual capture — `agent-browser` hangs on Pixi).
- No-JS: the row is unchanged from today (no eye button); existing Arsenal roster
  test remains green.
  **RED**: browser-mode tests for the affordance + open/close semantics against an
  **injectable stage seam** (spy stage, no WebGL) so transport/anchor logic is
  assertable without a GPU — mirroring `DojoApp`'s clock-above-the-stage split.
  **GREEN**: minimum popover + single-move wiring; real Pixi mount stays a thin,
  untested edge behind the seam.
  **MUTATE**: `N/A — web ∉ Stryker`; exact assertions + manual scan of the trigger set
  and the dim constant.
  **KILL MUTANTS**: N/A (manual scan: every trigger opens, every close path closes,
  dim `< 1`).
  **REFACTOR**: factor the preview stage/mount so S3 can drive it from any move.
  **Done when**: all criteria met, manual capture confirms gyaku-zuki loops into a
  dimmed target, typecheck + lint green, commit approved.

---

### Slice 3: Every Arsenal move exposes its own eye preview, driven by the one shared canvas

**Value**: The feature at full breadth — all 13 moves preview, while still only ever
one Pixi `Application` exists (the single portal's anchor + tape swap per open move).
**Path**: each `<For>` move row renders the eye affordance → sets `openMove` to its
id → the single preview portal re-anchors to that icon and applies
`moveLoopTape(openMove)`; the `Application` is created once and reused (tape swap, not
re-init).
**Class**: Behavior change (broaden).
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`.
`mutation-testing` → `N/A — web ∉ Stryker`. `refactoring` assessed.
**Acceptance criteria** (confirm before code):

- Every move in the roster has an eye affordance with a per-move accessible name;
  opening any one previews that move (browser-mode, iterate the roster).
- Opening a second move while one is open **switches** the preview (same single
  renderer) — assert no second `Application`/canvas is created (spy-stage
  construction count stays 1).
- The roster the previews iterate is the **same** source as the visible cards (no
  drift) and the existing exact-assertion roster test still passes unchanged.
  **RED**: browser-mode test iterating the roster (open each → correct move applied to
  the spy stage) + a "construct-once" assertion on switching.
  **GREEN**: lift `openMove` to the Arsenal level; wire every row.
  **MUTATE**: `N/A — web ∉ Stryker`; manual scan (every id routes to its own tape).
  **KILL MUTANTS**: N/A.
  **REFACTOR**: assess.
  **Done when**: all 13 preview correctly, single renderer confirmed, gates green,
  commit approved.

---

### Slice 4: Previews honor `prefers-reduced-motion` with a still contact frame instead of looping

**Value**: Accessibility correctness — motion-sensitive visitors get the move's shape
without the loop.
**Path**: the preview mount reads `matchMedia("(prefers-reduced-motion: reduce)")`;
when reduced, it draws a single **active/contact-phase** frame of `moveLoopTape` and
does not start the ticker loop.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`.
`mutation-testing` → `N/A — web ∉ Stryker`. `refactoring` assessed.
**Acceptance criteria** (confirm before code):

- With the reduced-motion media query matching (injected in test), opening a preview
  applies a single contact-phase frame and starts **no** loop (assert the clock
  never advances / the ticker is not driven, via the seam).
- With motion allowed, behavior is unchanged from S3 (loops).
- The media-query source is injectable so both branches are deterministic in tests.
  **RED**: browser-mode/seam tests for both branches (reduced → static frame, no clock
  advance; normal → loops).
  **GREEN**: minimal branch at the mount edge.
  **MUTATE**: `N/A — web ∉ Stryker`; manual scan of the branch + chosen frame index.
  **KILL MUTANTS**: N/A.
  **REFACTOR**: assess.
  **Done when**: both branches proven, gates green, commit approved.

## Pre-PR Quality Gate (every slice)

1. MUTATE: `N/A — web ∉ Stryker` → independent exact-assertion duplication + **manual
   mutator scan** recorded in the PR.
2. Refactoring assessment (only if it adds value; `reduce-system-complexity` N/A).
3. `npm run typecheck` + `npm run lint` green; `npm test` green.
4. DDD glossary: N/A (project does not use DDD).
5. Manual Pixi capture for any slice that changes the drawn frame (agent-browser
   hangs on Pixi → use the established Playwright/Pixi screenshot recipe).

---

_Delete this file when the plan is complete. If `plans/` is empty, delete the directory._
