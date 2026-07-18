# Plan: Model-identity brand-glyph heads (make-it-fight · Story 2)

**Status**: Active — Slice 1 ✅ merged; Slice 2 next.

> Informally "coin heads" (the branch/memory name); the disc was dropped 2026-07-18 — the head
> is the **bare brand glyph**, no disc. See the Design note under Goal.

## Progress

- **Slice 1 · shared brand source — ✅ COMPLETE + MERGED** (2026-07-18). Pure refactor; branch
  `feat/coin-heads`, PR **#333** squashed to `main` @ `abff48a`. Extracted
  `web/src/shared/lib/brand.ts` (glyph geometry + `modelToBrand`); `BrandMark`/`ModelLogo`
  consume it; DOM marks provably unchanged (189/189 green, prerendered hero byte-identical).
- **Slice 2 · glyph head on real replays — NEXT** (behaviour; branch `feat/replay-glyph-head`).
- **Slice 3 · `/dojo` brand picker — not started** (behaviour).

Child story 2 of the replay-viewer "make it fight" arc. Design source of truth:
`plans/replay-viewer-fight-decisions.md` (decision 6 + M5/M6/M11/M-purity) and
`plans/replay-viewer-fight-stories.md` (story 2 row + acceptance examples). Story 1 (`/dojo`
pose lab) is complete + archived (`docs/archive/replay-viewer-fight-s1-dojo.md`).

## Goal

A spectator watching a replay sees each fighter's **head render as its authoring model's brand
glyph** — the bare logo in the model's signature hue, no disc, exactly as the home-page hero
draws its three logo-headed stickmen — so at a glance they can tell which model (Claude /
OpenAI / Gemini / Grok / generic) authored each fighter, while the body keeps its side colour
(challenger-teal / king-amber).

> **Design note (2026-07-18):** the original grilling decision (M11) drew the head as a "brand
> coin" — a hued disc with a contrast glyph. The decision owner **dropped the disc**: a bare
> glyph looks better, reads bigger/crisper, and matches the hero the site already ships
> (`Hero.tsx` places a bare `<BrandMark>` as each head). This simplifies the head — no disc, no
> contrast-knockout rule; the glyph renders in its own brand hue, and only Grok needs an explicit
> canvas ink (near-white). See revised M11 in `plans/replay-viewer-fight-decisions.md`.

## Context (grounded in the code, 2026-07-18)

- **Identity is off-tape.** `scene(tape, playhead, viewport)` never sees identity; each
  fighter's `model` lives on `Fighter = { name; model }` (`replay-contract.ts`), threaded
  separately. `ReplayPlayer` already has it (`props.item.fighters`) but only calls
  `createStage(viewport)`. The dojo has no real fighters — its brands come from a picker (Slice 3).
- **Brand is resolved once per fighter at figure creation** (decision 6) — i.e. at the
  `createStage` call, not per-frame in `scene()`. Only the **counter-flip** is per-frame (it
  needs `facing`), so it lives in `applyFigure`, which already receives `placement.facing`.
- **The head today** is `new Graphics().circle(0, 0, 12).fill(color)` — symmetric, so nothing
  counter-flips it. An asymmetric glyph **must** counter-flip so the mark is never mirrored
  when a fighter faces left (`root.scale.x = facing` mirrors the whole figure; the head cancels
  it with its own `scale.x = facing`).
- **`modelToBrand`** (in `ModelLogo.tsx`) is exhaustively tested by `ModelLogo.test.tsx`
  (every alias, both precedence orders, case-fold, empty/null/undefined, hostile string). It is
  currently **not exported**.
- **`BrandMark` glyphs bake their hue** (`stroke="#d97757"`, `fill="#4285f4"`, Grok already
  `currentColor`). The bare-glyph head (revised M11) renders each glyph **in its own brand hue**
  (no disc, no contrast rule), so the fixed-hue markup transfers to Pixi as-is via
  `Graphics.svg()`; only **Grok's `currentColor`** must be resolved to an explicit near-white
  ink for the canvas (Pixi has no CSS `currentColor`). The shared source therefore needs the
  per-brand glyph geometry (single source for DOM + Pixi) + a Grok canvas-ink; full colour
  decoupling is **not** required.
- **Head is the bare brand glyph** — sized to read clearly, **noticeably larger** than the old
  ~24px head circle (M11: "bigger and more defined"), tuned by eye in `/dojo`. Story 2 is
  **identity only**; the M11 "≈ 0.3× body height" derivation belongs to story 3 (world-scale),
  keeping story 2 independent of scale.
- **`web/` is not Stryker-reachable** → mutation is `N/A` for every slice; the substitute is
  exact-assertion browser tests (`.test.tsx` — the include glob skips `.test.ts`) + a **manual
  mutator scan** + a **manual `/dojo` visual sign-off** (M9). Agent-browser hangs on the Pixi
  canvas, so no pixel regression; the shipped-bundle smoke greps `web/dist/assets/*.js`.

## Acceptance Criteria (story-level)

- [ ] A fighter whose model contains `claude` renders a head whose brand hook reads `claude`
      (and likewise openai / gemini / grok); an empty / unknown / hostile model → `generic`.
- [ ] The head is the **bare brand glyph in the brand's signature hue** (no disc), rendered
      noticeably larger than the old head circle (Grok: near-white ring & slash — its monochrome
      identity on the dark canvas).
- [ ] The body and limbs keep the side colour (challenger-teal / king-amber); only the head
      carries the brand.
- [ ] A left-facing fighter's glyph renders **upright** (counter-flipped), never mirrored.
- [ ] Real replays (`/watch`) show brand glyph heads resolved from each fighter's `model`.
- [ ] In `/dojo`, a per-figure brand control previews all five marks on the posed fighters.
- [ ] The existing `BrandMark` / `ModelLogo` / `Hero` champion-card behaviour is unchanged
      (their tests stay green; the marks look identical on the home + card surfaces).

## Slices

Three PR-sized slices: a pure-refactor foundation that makes the brand system Pixi-consumable
without touching DOM behaviour, then two behaviour slices (glyph head on real replays, then the
`/dojo` picker). Each leaves a working, deployable state.

---

### Slice 1 ✅ DONE (#333): Extract a shared brand source (glyph geometry + hue + `modelToBrand`) with the DOM marks unchanged

**Value** (pure refactor): one shared brand module that both the DOM `BrandMark`/`ModelLogo`
**and** the coming Pixi head can consume — the M6 "pure extraction, verified by the existing
suite before the Pixi head consumes the source." No user-visible change.
**Path**: `web/src/shared/` gains a brand module (e.g. `brand.ts`) exporting, per brand, the
glyph geometry as a single source (the same markup `BrandMark` draws today), a Grok canvas-ink
constant (near-white, for the Pixi path only — Grok's DOM `currentColor` is unchanged), and the
`modelToBrand` resolver; `BrandMark` renders the shared geometry inside its existing
`<svg data-brand role aria-label>` wrapper (glyph in its brand hue, as today); `ModelLogo`
re-imports `modelToBrand`. The home/hero/podium/king/gauntlet/ring consumers render identically.
**Class**: **pure refactor.**
**Required implementation skills**: `refactoring` (the extraction), `testing` (baseline is the
existing suite); `tdd` RED `N/A` (no new behaviour — never fabricate a failing test for
structure); `mutation-testing` `N/A` (web not Stryker-reachable — alternate evidence below).
**Reduction program**: `N/A` (not a mechanism-reduction program; a plain shared-source extraction).
**Transition/terminal evidence**: `N/A`.
**Acceptance criteria** (present + confirm before code):
- The full existing `web` browser suite passes **unchanged** — in particular `ModelLogo.test`
  (accessible-name mapping over every alias + no-injection) and `Hero.test` (`data-brand`
  values on the three fighters). No test edits beyond import-path updates.
- `modelToBrand` and the per-brand glyph geometry + hue are **exported** from the shared module
  and importable by `web/src/pages/replay/` (no `src/` import introduced).
- Manual visual sign-off: the champion cards + hero face-off render **pixel-identical** to before.
**RED or preservation baseline**: the passing existing suite (`ModelLogo.test`, `Hero.test`, and
the home/card render tests) is the oracle — it pins accessible name + `data-brand` + no-injection,
which the refactor must keep green. (It deliberately does **not** pin exact `stroke`/`d` strings,
which is what lets geometry move to `currentColor`.)
**GREEN or preservation change**: mechanically extract the glyph geometry (as `currentColor`),
the hue map, and `modelToBrand` into the shared module; rewire `BrandMark`/`ModelLogo` to consume
them, tinting the DOM glyph to its hue so the rendered mark is unchanged.
**MUTATE or alternate evidence**: mutation `N/A` (web). Alternate evidence: the existing
exhaustive `ModelLogo.test` (already the exact-assertion stand-in for a Stryker pass over the
brand space) + `Hero.test` `data-brand` assertions, both green post-refactor, + the manual
visual sign-off.
**KILL MUTANTS**: `N/A`.
**REFACTOR**: this slice **is** the refactor; assess only naming/placement of the new module.
**Done when**: the suite is green with only import-path edits, the shared exports exist, the
visual sign-off passes, and the human approves the commit.

---

### Slice 2: A fighter's head renders as its brand glyph on real replays

**Value** (behaviour): spectator outcome — on `/watch`, each fighter's head is its authoring
model's brand glyph (resolved via `modelToBrand`), in the brand hue, upright regardless of
facing. This is the story's spectator payoff and ships to real replays immediately.
**Path**: `ReplayPlayer` resolves each `props.item.fighters[i].model` → `Brand` and passes the
pair into `createStage`; `createStage`/`createFigure` replace the plain head circle with the
brand glyph (via Pixi v8 `Graphics.svg()` on the shared geometry, in the brand hue; Grok inked
near-white) and tag the head node with a `brand` hook; `applyFigure` sets
`head.scale.x = placement.facing` to counter-flip. `DojoStage` is updated to pass a default
brand pair so it keeps compiling and shows glyph heads (the interactive picker is Slice 3).
Observability: `figures.test` scene-graph assertions on the head's brand hook + counter-flip;
the deployed-bundle smoke.
**Class**: **behaviour change.**
**Required implementation skills**: `tdd`, `testing`, `front-end-testing` (browser-mode
scene-graph assertions); `mutation-testing` `N/A` (web) → manual mutator scan; `refactoring`
assess after green.
**Reduction program**: `N/A`.
**Transition/terminal evidence**: `N/A`.
**Acceptance criteria** (present + confirm before code):
- `createStage` accepts the two fighters' brands; a head built for brand `claude` exposes a
  brand hook reading `"claude"` (and openai / gemini / grok / generic likewise). *(Open Q1:
  `createStage(viewport, [Brand, Brand])` taking resolved brands — recommended — vs taking the
  models and resolving internally; confirm at AC.)*
- The head node renders the brand glyph (a `Graphics` built via `Graphics.svg()`), **no disc**,
  in the brand hue; the body/limb `bones` stroke keeps the side colour (challenger-teal /
  king-amber) — asserted by the unchanged colour on the bones + the brand hook on the head.
- After `applyFigure` with `facing = -1`, the head node's `scale.x === -1` while the root's
  `scale.x === -1` (net upright); with `facing = 1`, both `=== 1`.
- `ReplayPlayer` resolves brands from `props.item.fighters[*].model` (a `ReplayItem` whose
  fighters are `claude` / `generic` yields those two glyph heads).
- A model that is empty / unknown / hostile → the `generic` glyph head (no thrown error, no injection).
- Grok renders its monochrome treatment (near-white ring/slash on the dark canvas), distinct
  from the hued brands.
**RED**: `figures.test` (browser) — new failing assertions that a stage built with
`["claude","generic"]` (or resolved from models) exposes `stage.a.head` brand hook `"claude"` /
`stage.b.head` `"generic"`, that the head counter-flips under `facing = -1`, and that the bones
keep the side colour. Account for mutants: brand-string equality, the `facing` sign on the
counter-flip (kill `scale.x = 1` / `= -facing` / dropped).
**GREEN**: thread the brand pair into `createStage`/`createFigure`; replace the head circle with
the `Graphics.svg()` brand glyph (brand hue; Grok near-white); tag the head hook; add the
counter-flip line to `applyFigure`; resolve brands in `ReplayPlayer`; pass a default pair from
`DojoStage`.
**MUTATE or alternate evidence**: mutation `N/A` (web). Alternate: exhaustive exact-assertion
`figures.test` over all five brands + both facings + the model-resolution + the defensive
fallback, plus a manual mutator scan and the `/dojo` visual sign-off. *(Open Q2: if any single
glyph's path won't render through `Graphics.svg()`, re-author **that one** glyph as Pixi
primitive calls — the M5 per-glyph escape hatch — others stay shared.)*
**KILL MUTANTS**: address survivors from the manual scan (esp. the counter-flip sign and the
brand-string equality).
**REFACTOR**: assess extracting a `glyphHead(brand)` builder if `createFigure` grows unwieldy.
**Done when**: glyph heads render brand-resolved + upright on `/watch`, `figures.test` is green,
the manual scan + `/dojo` visual sign-off pass, the deployed bundle greps clean, and the human
approves the commit.

---

### Slice 3: A `/dojo` brand picker previews all five marks on the posed fighters

**Value** (behaviour): the developer picks each figure's brand in `/dojo` and the posed
fighters' glyph heads update live — the tuning surface to eyeball every mark (and, later, heads at
scale). Completes story 2's "add the brand picker to `/dojo`."
**Path**: `DojoApp` gains a per-figure `brand` signal (default challenger `claude` / king
`generic`, the M10 opening state); a brand control (per-figure, in the existing
`FigureControlPanel` or a sibling) sets it; `DojoStage` takes the brand pair as a prop and
passes it to `createStage`. Because `createStage` resolves brand **once at figure creation**, a
brand change **remounts** the stage (a fresh `createStage`) — matching how the pose lab already
rebuilds; confirm this re-mount cost is acceptable for a dev tool. Observability: `DojoApp.test`
(browser) drives the control and asserts the brand reaches the stage via the injectable spy-stage
seam; the deployed-bundle smoke.
**Class**: **behaviour change.**
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`; `mutation-testing`
`N/A` (web) → manual scan; `refactoring` assess after green.
**Reduction program**: `N/A`.
**Transition/terminal evidence**: `N/A`.
**Acceptance criteria** (present + confirm before code):
- `/dojo` opens with the challenger glyph head `claude` and the king glyph head `generic`
  (M10 default).
- Setting the challenger's brand control to each of the five options updates the challenger
  figure's glyph head to that brand (asserted through the spy-stage seam — the brand the stage
  is built with), the king unaffected, and vice-versa.
- The brand control has an accessible name queryable by role (`combobox`/`radio` — reuse the
  Slice-2/`SpacingControl` `aria-labelledby`-from-a-`<span>` pattern; a `<label for>` does not
  name a `<select>`/range input in this stack).
- Editing pose/gap controls does not reset the chosen brand (independent signal).
**RED**: `DojoApp.test` (browser) — a failing test that, after selecting brand `grok` on the
challenger control, the spy stage was built/rebuilt with the challenger brand `grok` and the
king brand still `generic`; plus the default-state assertion. Account for mutants: the
per-figure signal wiring (challenger vs king swap), the default values, the accessible name.
**GREEN**: add the per-figure brand signals + default; render the brand control; thread the
brand pair through `DojoStage` → `createStage`; remount on change.
**MUTATE or alternate evidence**: mutation `N/A` (web). Alternate: exact-assertion `DojoApp.test`
over both figures × the five brands + the default + control-independence, manual scan, `/dojo`
visual sign-off (all five marks eyeballed on the canvas).
**KILL MUTANTS**: address survivors (challenger/king swap; a dropped default).
**REFACTOR**: assess whether the brand control belongs inside `FigureControlPanel` vs a sibling.
**Done when**: the picker previews all five marks live in `/dojo`, `DojoApp.test` is green, the
manual scan + visual sign-off pass, and the human approves the commit.

## Open questions (resolve at each slice's AC gate)

- **Q1 — `createStage` shape (Slice 2):** take resolved `[Brand, Brand]` (recommended — decouples
  `createStage` from the model-string contract; the dojo picker produces brands directly) vs take
  `[string, string]` models and resolve internally. Recommendation: resolved brands.
- **Q2 — `Graphics.svg()` per-glyph fallback (Slice 2):** if a glyph won't parse/render through
  `svg()`, re-author that one glyph as Pixi primitive calls (M5 escape hatch), others stay shared.
- **Q3 — brand-change remount (Slice 3):** confirm remounting the dojo stage on a brand change is
  acceptable (dev tool) rather than making `createStage` re-brandable in place.

## Pre-PR Quality Gate (every slice)

1. Mutation `N/A` (web not Stryker-reachable) — review the exact-assertion coverage + the manual
   mutator scan as the documented alternate evidence.
2. Refactoring assessment (`refactoring`); reduction `N/A`.
3. `npm run typecheck` + `npm run lint` + `npm test` green.
4. Manual `/dojo` visual sign-off against the pose/brand checklist (M9); deployed-bundle grep smoke
   for the shipped control/glyph-head markers (agent-browser hangs on the Pixi page).
5. No `src/` import from `web/src`; no engine/TCB change (this whole story is `web/`-only — the
   `attackReach` engine field belongs to story 5, not here).

---
*Archive on completion (do not delete) under `docs/archive/` per the standing feedback; the
spanning `plans/replay-viewer-fight-{decisions,stories}.md` trail stays live for stories 3–5.*
