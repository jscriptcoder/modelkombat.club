# Plan: Replay Viewer S1 — Watch the King's latest fight (walking skeleton)

**Branch**: per-slice (`feat/engine-render-tape` → `feat/replay-api` → `feat/replay-viewer-page`)
**Status**: Active

Source story: **S1** in `plans/replay-viewer-stories.md`. Decisions + hardened ACs:
`plans/replay-viewer-decisions.md` (error contract, reconstruction fidelity, caching,
viewer async states). This is the walking-skeleton **tracer** — it pulls the whole
archive→reconstruct→tape→Pixi pipeline end-to-end thin, retiring the integration risk at
the lowest feature cost. Postures (S2), the browsable list (S3), and transport (S4) build
on this spine.

## Goal

A spectator opens the viewer page and the King's most-recent title fight **auto-plays** as
two stickmen moving with the score — proving the reconstruct→render pipeline is real and
byte-faithful.

## Acceptance Criteria

Behavior-driven, tested at the lowest level that gives confidence (engine unit + Stryker;
`src/http` handler unit; `web` browser-mode + manual mutator scan). Invariants held
throughout: **determinism / no persisted tape (#1)**, **TCB untouched (`dsl.ts`,
`INPUT_HASH`, `BENCHMARK_VERSION`)**, **doc-privacy** (bot documents never cross the wire).

- [x] `renderTape(cfg)` returns a per-tick rich-frame tape; the last frame's
      score/winner/tick-count **equals a direct `runFight(cfg)`** on the same params
      (fidelity), and `runFight` / `FightResult` remain **byte-identical** (no regression,
      hot path untouched). ✅ **Slice 1 — PR #306 merged 2026-07-16.**
- [x] `GET /replay/{id}` returns the headline bout's tape + both fighters' `name`/`model`
      and **no bot documents**; unknown / evicted / malformed / bootstrap id →
      `404 /problems/replay-not-found` **without running a fight**; success carries
      `Cache-Control: public, immutable`. ✅ **Slice 2.**
- [x] `GET /replay` returns the current version's watchable fights **newest-first**
      (reversed append order), **bootstrap-filtered**, identities only; empty archive →
      `200` + `[]`. ✅ **Slice 2.**
- [ ] Opening the viewer page **auto-plays the newest fight**: two stickmen move to their
      per-tick X, face each other, a HUD shows running score + tick; play/pause/restart
      work; loading / fetch-error (retry) / not-found (back-to-list) states render.

## Dependency note (evaluate-existing-solutions)

Slice 3 introduces **Pixi** as a durable `web/` dependency. The build-vs-adopt / which-lib
decision was made in the `grill-me` session (Q9: SVG vs Canvas2D vs Pixi compared;
decision-owner chose Pixi for animation headroom — `plans/replay-viewer-decisions.md`
decision 9). Preflight satisfied; planning sequences the chosen solution.

## Slices

Read `.claude/CLAUDE.md` (TDD non-negotiable; functional/immutable; strict TS; no `any`)
before each slice. Every slice below is a **behavior change** → full
RED-GREEN-MUTATE-KILL-MUTANTS-REFACTOR, ACs confirmed with the human **before any code**.

Slices 1–2 are horizontal enablers permitted under the walking-skeleton exception: each is
**independently verifiable** (engine tests; handler/curl tests — internal-only), each
**names the vertical slice it unlocks**, and each is **smaller done separately** than
bundled. Slice 3 is the observable spectator outcome.

### Slice 1: `renderTape(cfg)` exposes the per-tick rich render state — ✅ DONE (PR #306)

> **Merged 2026-07-16.** `runFight`/`renderTape` share a private `simulate(cfg, collectRender)`
> core → `FightResult` byte-identical, benchmark hot path builds no render frames. `RenderFrame`
> = `{x,y,facing,posture,attacking,attackBand,throwing,knockdown,points,stamina}` per tick per
> fighter, collected post-tick. 94.29% scoped mutation (2 equivalent survivors documented).
> Gotcha carried forward: posture is computed via `postureOf(f, action, rules)` at the render
> site (post-advance) — never the stale stored `f.posture`.

**Value**: The public `events` tape is too thin to render (no facing / posture / band /
throwing / knockdown). `renderTape` projects the rich `Frame` state the engine **already
computes** for perception into a stable per-tick tape. **Unlocks** Slice 2's
`/replay/{id}`.
**Path**: new `renderTape` sibling in `src/engine/` (co-located with `sim.ts`) → runs a
fight and returns `RenderFrame[]` — per tick, both fighters' `{ x, y, facing, posture,
attacking, attackBand, throwing, knockdown, points, stamina }` (the `frameOf` projection),
reusing the internal `histA`/`histB` Frames. `runFight` / `FightResult` **unchanged**.
Verified by engine unit tests + Stryker.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Reduction program**: N/A.
**Transition/terminal evidence**: N/A.
**Acceptance criteria** (confirm before code):

- `renderTape(cfg)` returns one entry per executed tick; each carries **both** fighters'
  render fields equal to the engine's internal per-tick state (assert on a fight exercising
  a crouch → `posture` crouch, a knockdown → `knockdown` true, a strike → `attacking` +
  `attackBand`, facing flip when they cross — the fields the thin `events` tape can't show).
- **Fidelity**: the tape's terminal score / winner / tick-count `==` a direct `runFight(cfg)`
  (same params) — the projection changes **shape, never outcome**.
- **Regression**: `runFight` and `FightResult` byte-identical to `main` (a golden/replay test
  still passes; the benchmark hot path imports nothing new).
- **Invariants**: `dsl.ts`, `INPUT_HASH`, `BENCHMARK_VERSION` untouched.
  **RED**: a failing test asserting `renderTape` emits `posture`/`knockdown`/`facing`/
  `attackBand` at the correct ticks for a scripted fight (fields absent from `FightResult.events`).
  **GREEN**: implement the `Frame`→`RenderFrame` projection over the already-built histories;
  keep `runFight`'s return frozen (share loop internals, split only the public surface).
  **MUTATE**: Stryker on the `renderTape` region — target 100% changed-line (each projected
  field pinned by an assertion).
  **KILL MUTANTS**: strengthen per-field assertions for any survivor (e.g. a dropped
  `facing` or `attackBand`).
  **REFACTOR**: assess sharing the loop between `runFight` and `renderTape` without widening
  `runFight`'s contract.
  **Done when**: all ACs met, Stryker report clean on changed lines, `runFight` regression
  green, human approves the commit. Branch `feat/engine-render-tape`.

### Slice 2: `GET /replay` + `GET /replay/{id}` serve the list and the reconstructed tape — ✅ DONE

> **Complete (branch `feat/replay-api`).** Injectable `src/http/handle-replay.ts` + thin
> `api/replay.ts` wired with the arena's frozen `CANONICAL_RULES`/`MAX_TICKS`/`MATCH` +
> `BENCHMARK_VERSION`; `vercel.json` rewrites `/replay` + `/replay/(.*)` → `?id=$1`. List is
> newest-first + bootstrap-filtered + identities-only; item reconstructs the headline bout via
> `renderTape`, `Cache-Control: immutable`; any non-resolving id → `404 replay-not-found`
> **without running a fight**; store-throw → `503` (parity with `/king`, decided 2026-07-16);
> list → `public, max-age=30` (decided 2026-07-16). `id` = sha256 of the record's **canonical**
> (recursively key-sorted) JSON over `challenger+defenders+seeds+version` (exported `replayId`).
> Shared the `sanitize` control-strip with `champion-identity.ts` (DRY-by-knowledge). Mutation:
> `handle-replay.ts` 92.75%, `api/replay.ts` 100% — 5 accepted survivors (2 equivalent in
> `canonicalize`: an unreachable `null`-guard + an array-as-object encoding that keeps the id
> deterministic/distinct/order-independent; 3 problem-prose strings, per the repo's
> assert-`type`-not-prose convention). No doc leakage (body-scan test); TCB / `INPUT_HASH` /
> `BENCHMARK_VERSION` untouched.

**Value**: Serves the newest-fight list + a reconstructed, doc-free tape over HTTP —
independently verifiable (handler tests / curl, internal-only before the page). **Unlocks**
Slice 3's page.
**Path**: new injectable `src/http/handle-replay.ts` (the `handleFight` pattern) + thin
`api/replay.ts` `fetch` wrapper wired with `selectThroneStore(process.env)` and the **same
imports the arena fights on** — `CANONICAL_RULES`, `MATCH`, `MAX_TICKS`, `BENCHMARK_VERSION`
(reconstruction-fidelity: no drift, no re-derivation). `vercel.json` rewrites `/replay` →
`/api/replay` (list) and `/replay/{id}` → `/api/replay?id=$1` (item). Reuses the shared RFC
9457 `problem+json` envelope in `src/http/`.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`,
`api-design`.
**Reduction program**: N/A.
**Transition/terminal evidence**: N/A.
**Acceptance criteria** (confirm before code):

- `GET /replay/{id}` for a real archived record → `200` `{ tape, fighters: [challenger
{name,model?}, King {name,model?}] }`; **no bot document field anywhere** in the body.
- The tape reconstructs `runFight({ botA: challenger, botB: defenders[0], seed: record.seeds[0],
rules: CANONICAL_RULES, maxTicks: MAX_TICKS, match: MATCH })` via `renderTape` (a test
  asserts the served tape equals a local `renderTape` on those pinned params).
- Unknown / evicted / malformed / **bootstrap** (`defenders: []`) id → `404
/problems/replay-not-found`, **no fight run** (archive lookup miss short-circuits before
  reconstruction).
- `GET /replay/{id}` success response carries `Cache-Control: public, immutable` (+ long
  `max-age`).
- `GET /replay` (list) success carries a short `Cache-Control: public, max-age=30` — mirrors
  `/king`'s read-handler convention (the list moves only when a fight is archived).
- The store throwing on `readArchive` (Upstash unreachable) → `503
/problems/throne-unavailable`, never a silent empty list — mirrors `/king` (decided
  2026-07-16, not a plain `500`).
- `id` = `sha256` of the record's canonical JSON (`challenger + defenders + seeds +
version`); the same record always hashes to the same id.
- `GET /replay` → `200` list of `{ id, fighters: [challenger, King] }` **newest-first**
  (reversed `readArchive` append order), **bootstrap records filtered out**, identities
  only (`name` + optional `model`, no handle — none in the archive).
- Empty archive, or only bootstrap/evicted records → `GET /replay` returns `200` + `[]`.
- **Invariants**: `dsl.ts` / `INPUT_HASH` / `BENCHMARK_VERSION` untouched (pure transport
  over `readArchive` + `renderTape`); docs never serialized.
  **RED**: handler tests against a fake `ThroneStore` seeded with a real + a bootstrap record:
  `/replay/{id}` body has a tape and identities but **no doc**; unknown id → 404; list is
  newest-first and excludes the bootstrap entry.
  **GREEN**: `readArchive(BENCHMARK_VERSION)` → filter `defenders.length > 0` → hash each →
  resolve `{id}` (or list) → `renderTape` the headline bout → project identities; miss → 404
  via the shared envelope; set the cache header on success.
  **MUTATE**: Stryker on `handle-replay` + pure helpers (hash, bootstrap filter, newest-first
  ordering, identity projection, id resolution, 404 branch) — 100% changed-region. Extract
  the pure pieces (per the #250 extract-to-pure lesson) so tally/filter mutants are killable.
  **KILL MUTANTS**: cover the `defenders.length > 0` boundary, reversed-order, and
  docs-omitted projection explicitly.
  **REFACTOR**: assess sharing the identity projection with the existing
  `champion-identity.ts` (`name`/`model` shaper) rather than a new one.
  **Done when**: all ACs met, Stryker clean, no doc leakage (a body-scan assertion), human
  approves. WAF per-IP backstop noted as a dashboard action for the public-release gate (not
  repo code). Branch `feat/replay-api`.

### Slice 3: The Pixi viewer page auto-plays the King's latest fight

**Value**: The observable spectator behavior — a real archived bout plays back as two
stickmen. The tracer's payoff; proves the whole pipeline visually.
**Path**: a new route/page in `web/` (Pixi canvas) → on load `GET /replay` → take `[0]` →
`GET /replay/{id}` → a **pure `scene(tape, tick) → Scene`** (world→screen mapped fighter
positions, facing, HUD values) → a thin Pixi draw layer → a playback clock (autoplay +
play/pause/restart). Pure `scene` unit-tested exhaustively (node-reachable → Stryker); Pixi
layer via **display-object assertions**; `agent-browser` out-of-band visual smoke.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`,
`mutation-testing` (on `scene`), `refactoring`.
**Reduction program**: N/A.
**Transition/terminal evidence**: N/A.
**Acceptance criteria** (confirm before code):

- Pure `scene(tape, tick)`: given a tape + playhead, returns both fighters' **screen
  positions** (deterministic world→screen mapping of fixed-point X/Y), **facing**, and
  **HUD values** (score, tick). Exhaustively unit-tested at boundaries: tick 0, last tick,
  a mid-tick where the two have crossed (facing flips), score after a scoring tick.
- On load the page auto-plays the **newest** fight (list `[0]` → its tape): two figures
  move to their per-tick X, face each other, HUD shows the running score + current tick.
- **play/pause** halts/resumes the clock; **restart** returns to tick 0.
- **Loading** state while fetching; **fetch-error** (network/5xx) → error + **retry**; **404
  not-found** (evicted/rotted) → "fight no longer available" + **back-to-list**, no retry.
- Pixi **display objects reflect the `Scene`**: a fighter object's `x` (and `scale.x`/flip
  for facing) asserted at a given tick; the tape crossing a tick moves it.
- **No engine/API change** (consumes Slice 2's tape as JSON; `web/src` still imports nothing
  from `src/`).
  **RED**: (a) a `scene()` unit test asserting fighter screen-X + HUD at a chosen tick fails
  until `scene` exists; (b) a browser-mode test asserting the page mounts two fighter display
  objects whose `x` differs between tick T and tick T+k.
  **GREEN**: implement `scene` (pure), the Pixi draw layer applying it, the fetch/auto-play
  wiring, and the three async states.
  **MUTATE**: Stryker on `scene` (pure, node-reachable) — 100% changed-line. Web presentation
  is **not** Stryker-reachable → exhaustive **exact-assertion** browser tests + a **mandatory
  manual mutator scan** (project practice, per `public-page-web-ui`).
  **KILL MUTANTS**: pin the world→screen mapping, facing flip, and HUD derivation with
  boundary assertions.
  **REFACTOR**: assess extracting the playback clock + fetch state machine as pure/testable
  units separate from the Pixi mount.
  **Done when**: all ACs met, `scene` Stryker clean, browser tests + manual scan done,
  `agent-browser` smoke confirms it animates, human approves. Branch `feat/replay-viewer-page`.

## Pre-PR Quality Gate (each slice)

1. Mutation testing where meaningful (engine + `src/http` + `scene`); web-presentation →
   exact-assertion browser tests + manual mutator scan (documented).
2. Refactoring assessment (only if it adds value).
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass.
4. DDD glossary check: N/A (project doesn't use DDD).
5. Invariant check: `dsl.ts` / `INPUT_HASH` / `BENCHMARK_VERSION` untouched; no bot document
   in any `/replay` response; no persisted tape.

---

_Delete this file when the plan is complete. If `plans/` is empty, delete the directory._
