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
- [x] **S3a** — Opening the viewer page (`/watch`) **auto-plays the newest fight**: two
      stickmen move to their per-tick X, face each other, a HUD shows running score + tick;
      **loading / fetch-error (retry) / empty-list** states render. ✅ **Slice 3a — PR #308
      merged 2026-07-16.**
- [x] **S3b** — **play/pause** halts/resumes the clock and **restart** returns to tick 0.
      (The dedicated **not-found → back-to-list** state ships with the S4 list + permalinks —
      there is no list to return to before then; S3a's retryable error covers a transient
      item 404.) ✅ **Slice 3b — PR #309 merged 2026-07-16.**

## Dependency note (evaluate-existing-solutions)

Slice 3a introduces **Pixi** as a durable `web/` dependency. The build-vs-adopt / which-lib
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
bundled. Slices 3a–3b are the observable spectator outcomes (the dedicated not-found + the
browsable list land with S4 — permalinks + list — outside this walking-skeleton plan).

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

### Slice 3a: The Pixi viewer page auto-plays the King's latest fight — ✅ DONE (PR #308)

> **Merged 2026-07-16 (branch `feat/replay-viewer-page`).** New multi-page entry
> `web/replay.html` + `web/src/pages/replay/replay.tsx` mount; `vercel.json` rewrites `/watch`
> → `/replay.html`. On load: pure `loadReplay` (`GET /replay` → `[0]` → `GET /replay/{id}`,
> local view-model types mirroring the Slice 2 wire, importing nothing from `src/`) → a pure
> `scene(tape, playhead, viewport) → Scene` (world→screen X/Y via mirrored `WORLD_WIDTH`,
> facing pass-through, HUD tick+scores) → a Pixi `figures`/`createStage` draw layer → a
> `ReplayPlayer` mounting Pixi with an autoplay ticker (tick 0 → last, then stops).
> `ReplayPage` is a `<Switch>` state machine: loading / fetch-error (**retry** re-runs the
> whole fetch) / **empty-list** (link to `/ring`, no player) / ready. **Pixi v8 mounts headless**
> under browser-mode Playwright — assert scene-graph `x`/`scale.x`/`Text`, not pixels. `web/`
> is not Stryker-reachable → the pure `scene`/`figures`/`loader` got exhaustive exact-assertion
> browser tests + a documented manual mutator scan (caught: unasserted `y` wiring, HUD
> scoreA/scoreB swap, unasserted list path — all fixed). Live-animation smoke deferred to the
> Vercel preview (Pixi RAF + Vite HMR socket defeated local `agent-browser` network-idle).
> Invariants held: no engine/API change, `web/src` imports nothing from `src/`,
> `dsl.ts`/`INPUT_HASH`/`BENCHMARK_VERSION` untouched.

**Value**: The observable spectator behavior — a real archived bout plays back as two
stickmen with a live HUD. The tracer's payoff; proves the whole
archive→reconstruct→tape→Pixi pipeline visually, end-to-end thin.
**Path**: a new multi-page entry `web/replay.html` + `web/src/pages/replay/replay.tsx` mount
(the `ring.html`/`ring.tsx` precedent) + a `vercel.json` rewrite `/watch` → `/replay.html`
(the public `/replay` path is the **API**, so the page gets its own `/watch` path; `/watch/{id}`
permalinks arrive with the S4 list) → on load `GET /replay` → take `[0]` → `GET /replay/{id}`
(local `web/src` view-model types mirror the Slice 2 contract, importing nothing from `src/`) →
a **pure `scene(tape, tick) → Scene`** (world→screen fighter positions, facing, HUD values) → a
thin Pixi draw layer applying it → an **autoplay clock** (tick 0 → last, then stops).
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`, `refactoring`
(mutation on the pure `scene` is browser exact-assertion + manual scan — `web/` is not
Stryker-reachable; `stryker.config.mjs` mutates only `src/**` + `api/**`).
**Reduction program**: N/A.
**Transition/terminal evidence**: N/A.
**Acceptance criteria** (confirm before code):

- Pure `scene(tape, tick)`: given a tape + playhead, returns both fighters' **screen
  positions** (deterministic world→screen mapping of the fixed-point x/y), **facing**, and
  **HUD values** (score, tick). Exhaustively unit-tested at boundaries: tick 0, last tick,
  a mid-tick where the two have crossed (facing), score after a scoring tick.
- On load the page auto-plays the **newest** fight (list `[0]` → its tape): two figures
  move to their per-tick screen X, face each other, HUD shows the running score + current
  tick, and the clock advances to the last tick then stops (autoplay, no controls yet).
- **Loading** state while fetching; **fetch-error** (network / 5xx on either fetch, and a
  transient item 404 from a list→item eviction race) → an error message + **retry** that
  re-runs the whole fetch; **empty-list** (`GET /replay` → `[]`, no King fights yet) → an
  honest "no fights to watch yet" state (a link to `/ring`), no player mounted.
- Pixi **display objects reflect the `Scene`**: a fighter object's `x` (and `scale.x`/flip
  for facing) asserted at a given tick; advancing the clock past a crossing tick moves/flips
  it.
- **No engine/API change** (consumes Slice 2's tape as JSON; `web/src` imports nothing from
  `src/`). `dsl.ts` / `INPUT_HASH` / `BENCHMARK_VERSION` untouched.
  **RED**: (a) a `scene()` browser-mode unit test asserting a fighter's screen-X + HUD at a
  chosen tick fails until `scene` exists; (b) a browser-mode test asserting the mounted page
  shows two fighter display objects whose `x` differs between tick T and tick T+k once the
  clock runs.
  **GREEN**: implement `scene` (pure), the Pixi draw layer applying it, the fetch/auto-play
  wiring, the autoplay clock, and the loading / fetch-error / empty-list states.
  **MUTATE**: `scene` is pure but lives in `web/` (not Stryker-reachable) → **exhaustive
  exact-assertion** browser tests calling `scene()` directly + a **mandatory manual mutator
  scan** (project practice, per `public-page-web-ui`). Pin the world→screen mapping, the
  facing sign, and each HUD field with boundary assertions.
  **KILL MUTANTS**: cover each mapping boundary + the facing sign + each HUD field explicitly.
  **REFACTOR**: assess extracting the playback clock + fetch state machine as pure/testable
  units separate from the Pixi mount.
  **Done when**: all ACs met, `scene` exact-assertion tests + documented manual scan done,
  `agent-browser` smoke confirms it animates, human approves. Branch `feat/replay-viewer-page`.

### Slice 3b: The spectator controls playback

**Value**: Minimal transport — the controls that make the fight _watchable_ on demand
(pause to study a moment, restart to rewatch). Completes the walking-skeleton viewer.
**Path**: play/pause + restart buttons wired to the S3a clock (a pure clock/transport model
kept separate from the Pixi mount, so the tick transitions are exact-assertion testable).
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`, `refactoring`.
**Reduction program**: N/A.
**Transition/terminal evidence**: N/A.
**Acceptance criteria** (confirm before code):

- **play/pause** halts/resumes the clock: a paused clock does not advance the tick; resuming
  continues from the current tick. **restart** returns to tick 0 and resumes autoplay.
- The controls are keyboard-operable and labelled; clock state is asserted via the tick the
  HUD / `scene` reads (pause freezes it, restart zeroes it) — behaviour, not pixels.
- **No engine/API change**; `web/src` imports nothing from `src/`; invariants untouched.
  **RED**: a browser-mode test where pausing freezes the HUD tick across clock ticks and
  restart returns it to 0.
  **GREEN**: add the control buttons + the clock's play/pause/restart transitions.
  **MUTATE**: the pure clock/transport model → exact-assertion browser tests + manual mutator
  scan; presentation → exhaustive exact assertions.
  **KILL MUTANTS**: cover paused-vs-running tick advancement and restart-to-0 explicitly.
  **REFACTOR**: assess folding the clock into one reviewable transport model.
  **Done when**: all ACs met, exact-assertion tests + manual scan done, `agent-browser` smoke
  confirms the controls, human approves. Branch `feat/replay-viewer-controls`.

## Pre-PR Quality Gate (each slice)

1. Mutation testing where meaningful (engine + `src/http`); web-presentation (incl. the pure
   `scene`) → exact-assertion browser tests + manual mutator scan (documented).
2. Refactoring assessment (only if it adds value).
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass.
4. DDD glossary check: N/A (project doesn't use DDD).
5. Invariant check: `dsl.ts` / `INPUT_HASH` / `BENCHMARK_VERSION` untouched; no bot document
   in any `/replay` response; no persisted tape.

---

_Delete this file when the plan is complete. If `plans/` is empty, delete the directory._
