# `/replay` + Pixi stickman viewer — resolved decisions

Output of a `grill-me` session (2026-07-15). Feeds `story-splitting` → `planning`
(one child story → PR-sized slices). Actors use the domain vocabulary: **spectator**
(anyone browsing/watching), **challenger** / **King of the Hill**, **operator**.

## What we're building

Let anyone browse the current King's title fights and watch them as stickmen. Three
pieces:

1. an **additive engine render-tape export** (the one engine touch),
2. a **stateless `/replay` read API** over the existing KotH reproduction archive
   (`ThroneStore.readArchive`, shipped in the ladder's S5 slice),
3. a **Pixi viewer** in the existing `web/` Solid app.

Fights are **never stored as tapes** (invariant #1); a tape is reconstructed on demand
from the archived `ReproRecord` (`challenger doc + defenders docs + seeds + version`) by
re-running the engine.

## Resolved decision tree

| #   | Decision                           | Choice                                                                                                                                                                                                                               |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Tape reconstruction & doc exposure | **Server-side reconstruct; return the motion tape only — bot documents never leave the server.** Protects KotH competitive integrity + honors the `/fight` no-docs contract.                                                         |
| 2   | List unit / "a fight"              | **One entry per archived title attempt** (`ReproRecord`). Headline watchable bout = **challenger vs the King (`defenders[0]`)**. Drill-down (other defenders/seeds) deferred.                                                        |
| 3   | List content                       | **Identities only** (`name` + `model`); outcome revealed on watch. The list endpoint runs **zero fights** (pure `readArchive` → identity projection).                                                                                |
| 4   | Version scope                      | **Current version only** (`readArchive(CURRENT_VERSION)`) — byte-exact reconstruction against today's `CANONICAL_RULES` + `MATCH`. No rules-snapshotting; historical replay deferred.                                                |
| 5   | Fight id                           | **Content hash** — sha256 of the record's canonical JSON (`challenger + defenders + seeds + version`). Eviction-proof, permalinkable, cacheable. Idiomatic vs the `INPUT_HASH` pattern.                                              |
| 6   | Endpoint shape                     | **REST collection + item**: `GET /replay` (list), `GET /replay/{id}` (tape). One flat `api/replay.ts` behind two rewrites (`/replay` → list, `/replay/{id}` → `?id=$1`).                                                             |
| 7   | Render state source                | **Additive render-tape export.** The public `events` tape is too thin (no posture/band/throwing/knockdown/facing). Byte-identical outcome path, **TCB-untouched**, **`INPUT_HASH`-neutral**.                                         |
| 8   | Export shape                       | **Dedicated `renderTape(cfg)` sibling** — `runFight`/`FightResult` stay frozen so the benchmark hot path pays nothing. Reuses the already-computed internal `Frame` histories.                                                       |
| 9   | Rendering tech                     | **Pixi** (per `docs/DESIGN.md` — reconsidered vs SVG/Canvas2D; Pixi kept for animation headroom). Tested via a pure scene-model + a thin draw layer.                                                                                 |
| 10  | v1 fidelity bar                    | **Walking skeleton first** — positions + facing + score/tick HUD, minimal poses. Full posture vocabulary is the next slice.                                                                                                          |
| 11  | Transport in the skeleton slice    | **Autoplay + play/pause/restart** only. Scrub bar + speed land with the later fight-list/transport slice.                                                                                                                            |
| 12  | Viewer testing                     | **Pure `scene(tape, tick) → Scene` model** exhaustively tested (exact assertions + manual mutator scan; web is not Stryker-reachable) **+ Pixi display-object assertions** (not pixels). `agent-browser` = out-of-band visual smoke. |
| 13  | Bootstrap records                  | **Filtered out** of the watchable list — a bootstrap crowning (`reproRecord([], 1)`) has empty defenders / no bout to animate. Reversible later.                                                                                     |

## Error contract (find-gaps, 2026-07-15)

RFC 9457 `application/problem+json`, consistent with the existing `/fight` flat-slug
convention.

- **`GET /replay/{id}` — id doesn't resolve to a watchable fight** → **`404`
  `/problems/replay-not-found`**. One status for _all_ non-resolving cases: unknown hash,
  an evicted record, a malformed id, and a bootstrap record's id (bootstrap is never
  listed, so its id is only reachable by guessing/staleness). A client can't distinguish
  evicted from never-existed, so a single 404 is honest and simplest — no separate
  400-malformed or 410-gone.
- **`GET /replay` (the list) with no watchable fights** — empty archive, or only
  bootstrap/evicted records remain → **`200` with an empty array**. A collection is
  legitimately empty; the viewer branches on list length (its honest empty state), never
  on status. Not a 404.

## Reconstruction fidelity (find-gaps, 2026-07-15)

The "byte-faithful" claim is only testable if the reconstructed bout is fully pinned.
`renderTape` wraps a **single `runFight`** (not `benchmark`, which aggregates orientations
× seeds and yields no events):

- **Headline bout** = `runFight({ botA: challenger, botB: defenders[0] (King), seed:
seeds[0], rules, maxTicks, match })` — challenger as A (starts left), King as B, the
  first frozen seed. Deterministic and faithful to a real sub-bout the arena ran.
- **Parameter provenance is load-bearing:** `rules` / `maxTicks` / `match` MUST be the
  **same live constants the arena `/fight` handler fought on** — `match` and `maxTicks` are
  **not** stored in the `ReproRecord`, so reconstruction reuses the shared wiring rather
  than re-deriving them. Any drift (a different `match`, a different `maxTicks`) silently
  produces a _different_ fight and breaks the tape-vs-fight equality test. The endpoint and
  the arena handler must draw these from one shared source.
- **Verification AC:** a test reconstructs the tape for a known record and asserts its final
  score/winner/tick-count equals a direct `runFight` on the same pinned parameters (the
  render projection changes shape, never outcome).
- Deferred (parking): a "representative seed" pick (e.g. a bout the challenger won) and
  both-orientation drill-down.

## Durability & lifecycle (find-gaps, 2026-07-15)

**Watchable fights are impermanent, by design (v1).** A fight is watchable only while its
record sits in the current version's newest-K (K=50, + pinned arena members) archive. Two
things remove it:

- **Eviction** — as newer challengers clear, an old unpinned record ages out of the
  newest-K window. Its permalink then `404`s (`replay-not-found`) and it drops from the
  list.
- **Version bump** — a `BENCHMARK_VERSION` change makes `readArchive(CURRENT_VERSION)` read
  a fresh (empty) archive; the previous version's fights + permalinks all vanish from
  `/replay` at once.

Both are **accepted** — no extra storage, consistent with "reconstruct on demand, never
persist a tape." A rotted permalink degrades gracefully (404 → the viewer's not-found
state); the list always reflects the current version's live archive. Deferred (parking):
raising/pinning K for longer retention, and a durable cross-version replay store.

## Compute cost & caching (find-gaps, 2026-07-15)

`GET /replay/{id}` reconstructs a fight per call (a public compute endpoint, like `/fight`).
Bounded by:

- **Immutable HTTP/edge caching (primary).** The id is a content hash ⇒ a given fight's
  tape never changes ⇒ respond with `Cache-Control: public, immutable` + a long TTL. Repeat
  watches are served from cache; only the first computes. Caching a _derived, reproducible_
  tape does not violate invariant #1 (it's not a persisted source-of-truth tape).
- **WAF per-IP backstop.** Reuse the `/fight`-style modest per-IP rate-limit (a dashboard
  action, not repo code) as a floor against cold-replaying many valid ids.
- **Cheap failure path.** A non-resolving id returns `404` _before_ running any fight
  (lookup in `readArchive` first), so garbage-id spam costs only a lookup.
- **List endpoint** stays cheap/unthrottled (zero fights; pure identity projection). It may
  carry a short cache TTL (the archive changes only when a challenger clears).

## List ordering (find-gaps, 2026-07-15)

The archive stores **no timestamp** (`readArchive` returns append order; `ReproRecord` has
no time field). So:

- **Order newest-first by reversing append order.** Eviction removes the oldest from the
  front (newest-K retention), so the array is oldest→newest and reversing is deterministic.
- **No date is shown.** Cards stay identity-only (challenger `name`/`model` vs King
  `name`/`model`) — consistent with the identities-only decision. No "N days ago", no
  ordinal (`Fight #N` shifts as records evict).
- Deferred (parking): adding a commit `timestamp` to `ReproRecord` (a store-contract change
  that only back-populates new records) if real date display is later wanted.

## Viewer async states (find-gaps, 2026-07-15)

Fetching a tape is a network call, so the player has three non-happy states (states, not
architecture — refined in the S1/S3 slice ACs):

- **Loading** — while `GET /replay/{id}` resolves: a placeholder/skeleton (or the static
  ring with no fighters), no controls active.
- **Fetch error** (network / `5xx`) — an error state with a **retry** affordance.
- **Not-found** (`404 replay-not-found`, e.g. an evicted/version-rotted permalink) — a
  distinct **"this fight is no longer available"** state with a link back to the list (ties
  to the accepted impermanence). Not the same as a transient error — no retry.
- **List:** empty archive → the honest empty state (per planning-level details).

## Nice-to-haves (find-gaps, 2026-07-15)

- **Identity display edge cases.** `model` absent ⇒ render `name` only (no brand chip;
  `model` is optional/inert). Very long `name` ⇒ validator length-caps it, but still
  CSS-truncate in the card with the full value in a `title`/tooltip. Two cards with the
  same challenger-vs-King names (a repeat challenge, no timestamp to disambiguate) ⇒ show a
  **short content-hash id fragment** (e.g. first 6 chars) on each card as an honest,
  stable disambiguator.
- **Tape payload budget.** ~600 ticks × 2 fighters × ~10 integer fields ≈ 100–300 KB JSON
  uncompressed; gzips small (repetitive integers). v1 ships **plain JSON, no
  quantization/delta encoding** — immutable caching + gzip make it a non-issue. Revisit
  delta/quantize only if a real budget problem appears (parking).
- **Observability.** Mirror the platform's structured-logs convention: log each `/replay`
  (list) and `/replay/{id}` request — id, resolve hit/miss (→404), and reconstruction
  tick-count/duration. No new dashboards required for v1.

## Nav visibility — dark launch (2026-07-16)

The `/watch` viewer ships **dark**: **no primary-Nav link**, and the existing "Fight
replays — in development" teaser stays a non-link. The route — and its shareable
permalinks — is reachable only by direct URL until we deliberately choose to surface it.
This defers **all** public entry-point wiring: the S3 slice still builds the list, player,
and permalinks, but adds no Nav link and no live teaser link. Reversible — revisit when we
promote the feature.

## S3 grill-me — resolved (2026-07-17)

A focused `grill-me` pass on **S3 (browse the King's fights)**, run after S1+S2 shipped.
Two facts reframed the story before any decision: **S3 is web-only** — S1 already shipped
the full `/replay` list + `/replay/{id}` item contract in `handle-replay.ts` (identities-only
summaries, newest-first, bootstrap-filtered, `200 []`, `404 replay-not-found`, immutable
item cache), so **no `src/` / `api/` change is needed**; and the viewer inherits S2's
testing regime (`web/` is not Stryker-reachable → exhaustive exact-assertion browser tests +
mandatory manual mutator scan + a synthetic-tape visual check). `web/src` still never imports
`src/`.

Most of the S3 _product_ tree was already locked by the 2026-07-15 decisions above (list unit,
identities-only, newest-first, `200 []`, dark launch, card identity edge cases). This pass
resolved what only building S1/S2 could settle — the **client route/URL structure** and how
the list and player surfaces relate:

- **Route structure.** `/watch` becomes the **browsable card list** (index); `/watch/{id}` is
  the **permalink player**. Mirrors the API (`/replay` list + `/replay/{id}` item) and yields
  clean shareable permalinks. This **replaces** S1's autoplay-at-`/watch` behavior — the newest
  fight is now one click from the list. Safe because the route is dark (no Nav/teaser link), so
  nothing internal depended on the old autoplay. A new `/watch/(.*)` → `replay.html` rewrite is
  added ahead of the SPA catch-all; the browser URL stays `/watch/{id}` (Vercel rewrites are
  server-side/transparent), so the client can read `location.pathname`.
- **View selection + navigation.** One `replay.html` SPA parses `location.pathname` **at mount**:
  no id → list view; a present id → player view. Cards are plain `<a href="/watch/{id}">` —
  **full-page navigation, no router**. Native back/forward, deep-links, and shared permalinks
  all "just work"; matches the house pattern (index/ring/replay are separate mini Solid apps).
  Accepted tradeoff: a full reload + Pixi re-init when opening a fight (the player already
  fresh-mounts; fine at this scale). Client-side pushState routing was considered and rejected
  as unnecessary moving parts for a web-only, manually-scanned slice.
- **Not-found (distinct state).** A `/watch/{id}` whose id 404s (`replay-not-found` — evicted,
  version-rotted, or garbage) renders a **distinct no-retry "this fight is no longer available"
  state with a "← all fights" back-link to `/watch`** — separate from the transient fetch-error
  (which keeps _retry_). The by-id loader therefore **distinguishes 404** (→ not-found) from
  5xx/network (→ retry). A small "← all fights" link also sits on the happy-path player, since
  the dark route has no Nav to navigate back with.
- **Loader shape (mechanical).** Today's `loadReplay` (list→newest→tape autoplay) splits into
  `loadList()` (`GET /replay` → summaries, for the list page) and `loadById(id)` (`GET
/replay/{id}` → tape, for the player). The old autoplay loader retires when `/watch` flips to
  the list.
- **Card disambiguator.** Cards show `name` + `model` (name-only when `model` absent; long name
  → CSS-truncate + full value in a `title` tooltip). Two cards sharing an identical
  challenger-name + King-name pair get a **6-char content-hash id fragment — only on the
  colliding cards** (a pure collision-detection pass over the list). Always-show (noise on every
  card) and never-show (drops the guarantee) were both rejected.
- **Dark launch reaffirmed.** No Nav link; the "Fight replays — in development" teaser stays a
  non-link. One doc-drift to fix in implementation: `ReplayApp.tsx`'s comment says the browsable
  list is finalized "until S4" — it's **S3**, and it ships dark.

**Slice shape (to confirm in `planning`).** Player-first so cards have a live target:

1. **S3.1 — permalink player at `/watch/{id}`**: `/watch/(.*)` rewrite + URL-parsed view
   selection + `loadById` + the not-found state + back-link. Observable: a shared `/watch/{id}`
   opens and plays that fight (or gracefully reports it's gone). Intermediate state leaves
   `/watch` still autoplaying the newest (coherent).
2. **S3.2 — the list at `/watch`**: `loadList` + card grid (newest-first, identities-only,
   truncation, empty state) + click-through to `/watch/{id}` + the on-collision disambiguator;
   retires the autoplay loader and flips `/watch` to the list. Observable: browse all fights,
   click to watch.

## S4 grill-me — resolved (2026-07-17)

A focused `grill-me` pass on **S4 (control playback — transport)**, run after S1–S3 shipped and
the S3 browse plan was archived (#324). **S4 is web-only presentation** — it adds no API/engine
surface (the tape already carries every tick), inherits the same testing regime (`web/` is not
Stryker-reachable → exhaustive exact-assertion browser tests + pure-`transport` unit tests +
manual mutator scan; **Mutation: N/A (Stryker)**), and the route still ships **dark** (no Nav
link; the "Fight replays — in development" teaser stays a non-link). `web/src` never imports `src/`.

It builds on the pure `transport` clock (`Transport = { playhead, playing }`; `advance` clamps to
`lastTick`; `startTransport` doubles as the restart target) that the S1 Pixi player drives from the
Pixi ticker (~one engine tick per rendered frame). Scope is fixed by the split (decision 11 deferred
scrub + speed here): **scrub bar (seek to any tick) · speed multiplier · frame-step**.

| #    | Decision           | Choice                                                                                                                                                                                                                                                                                 |
| ---- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S4-1 | Scrub bar          | **Native `<input type=range>`** (min 0, max `lastTick`, step 1) — live-tracks the playhead during playback, seeks on drag; native keyboard + screen-reader a11y for free. Custom-styled bar rejected (hand-rolled a11y/keyboard is a whole extra sub-slice).                           |
| S4-2 | Scrub resume       | Grabbing the bar **pauses** the live advance (so the ticker can't fight the thumb); seek = _set playhead + `playing=false`_; **stays paused on release** (press Play to resume). Keeps the model at `{ playhead, playing }`. Resume-on-release rejected (extra was-playing state).     |
| S4-3 | End of fight       | **Auto-pause on the last tick** — `advance` flips `playing` false at `lastTick`. A small fix to today's stays-playing edge (Pause button frozen over the final frame; Play never returns without Restart). Keep-playing and loop both rejected.                                        |
| S4-4 | Speed              | **Discrete rate buttons 0.5× / 1× / 2×**, default 1×, active highlighted (`aria-pressed`). Speed is a **UI signal applied at the ticker delta** (`advance(t, deltaTime × speed, lastTick)`) — `Transport` untouched. Cycle-button (hides rates) and `<select>` (extra click) rejected. |
| S4-5 | Frame-step         | **Dedicated ◀ / ▶ buttons**; each pauses (if playing) and moves exactly one **integer** tick (`round(playhead) ± 1`), clamped `[0, lastTick]`, disabled at the ends. The native slider's arrow keys still step as a bonus. Arrow-keys-only rejected (undiscoverable, focus-gated).     |
| S4-6 | Keyboard shortcuts | **Park custom global shortcuts.** The transport is already fully keyboard-operable via native semantics (Tab + Enter/Space on focused controls, ←/→ on the focused slider). A global Space=play/pause (button double-fire + page-scroll conflict) and a fuller map are follow-ups.     |
| S4-7 | Tick readout       | Visible muted-mono **`tick N / M`** beside the scrub bar + `aria-valuetext="tick N of M"` on the slider. HUD-tick-only rejected (the fight's total length is never shown as a number).                                                                                                 |

**Minor implied (called out, not separately grilled):** the **Restart** button is kept (seek to 0

- play); **speed persists across Restart** (Restart resets the clock, not the chosen rate);
  **score-pop / HUD are already scrub-safe** (pure `scoredWithin` scan, deterministic) so backward
  scrubbing renders correctly with no change.

**Model impact.** Only two changes to the pure `transport` model, each driven by its own failing
test: (a) `advance` auto-pauses at `lastTick` (S4-3); (b) new `seek` (set playhead + `playing=false`,
integer-clamped) and `step` (integer `±1`, clamped) transitions. Speed lives entirely in the
reactive/ticker layer — no model change.

**Slice shape (to confirm in `planning`).** Three vertical slices, each independently shippable and
each a coherent deployable checkpoint:

1. **S4.1 — scrub bar**: the native range slider (seek + live-track + pause-on-grab) + the
   `tick N / M` readout + the end-of-fight auto-pause (carries the two model changes). Observable:
   drag to jump to any tick deterministically; the fight auto-pauses at the end.
2. **S4.2 — speed**: the 0.5× / 1× / 2× rate buttons. Observable: 0.5×/2× changes playback rate.
3. **S4.3 — frame-step**: the ◀ / ▶ step buttons. Observable: a step advances/retreats exactly one tick.

## Non-negotiable invariants respected

- **#1 determinism** — reconstruct from stored docs+seeds; **no tape is ever persisted**.
- **TCB / security** — `renderTape` reads state the engine already computes; `dsl.ts`
  allowlists untouched; docs never cross the wire.
- **`INPUT_HASH` / `BENCHMARK_VERSION`** — unchanged (a render output projection is not a
  scoring input).
- **Same pre-tick snapshot** — unaffected (read-only projection).

## Key facts (verified during the session)

- `runFight` already emits `FightResult.events` (`FighterFrame`: `{x, y, action, points,
stamina, degrade}`), but `action` is the bot's _returned decision_, not resulting body
  state — **insufficient to render** (knockdown/facing unrecoverable; pose during
  committed recovery is guesswork).
- The engine already builds rich internal `Frame` histories every tick for perception
  (`frameOf`, `sim.ts`): `{x, y, facing, attacking, attackBand, posture, throwing,
knockdown, vx, stamina, ...}` — exactly the render state a stickman needs. `renderTape`
  exposes a projection of these.
- `ReproRecord = { challenger, defenders, seeds, version, memberSeniority }`
  (`src/http/throne-store.ts`). Carries **no handle** (handle lives on `ArenaMember`) and
  **no outcome**. `defenders` is rank-ordered (`[0]` = King) for real attempts; `[]` for a
  bootstrap crowning.
- The archive is version-scoped and newest-K bounded (K=50) with pinned arena members
  (`retainArchive`); reachable via `ThroneStore.readArchive(version)` — **no HTTP surface
  consumes it yet**; that surface is this `/replay` work.
- `web/src` deliberately **never imports from `src/`** (mirrors contract types locally) —
  reinforced by decision 1 (the viewer consumes the tape as JSON, not the engine).
- Endpoints are flat `api/<name>.ts` fns + explicit rewrites in `vercel.json`; RFC 9457
  `problem+json` error envelope shared in `src/http/`.

## Proposed slice sequence (to refine in story-splitting)

1. **Engine — `renderTape(cfg)` sibling** (src/, full RED-GREEN-MUTATE TDD + Stryker).
2. **`/replay` API** — identities-only list + `{id}` headline-bout tape (pure-fn handlers;
   content-hash ids; bootstrap-filtered; newest-first; RFC 9457 envelope reused).
3. **Viewer walking skeleton** — Pixi page, autoplay one fight (positions + facing + score
   HUD), pure scene-model + display-object assertions.
4. **Postures** — crouch / jump-arc / guard-by-band / strike-by-band / throw / downed +
   score pops.
5. **Fight-list + transport** — list UI, watch navigation, scrub/speed, permalinks. The
   route stays **dark** — no primary-Nav link and the "Fight replays — in development"
   teaser stays a non-link (see **Nav visibility — dark launch**); surfacing it is deferred.

## Planning-level details (not decisions — noted for later)

- Canonical headline bout fully pinned in **Reconstruction fidelity** above (challenger as
  A, King as B, `seeds[0]`, arena `rules`/`maxTicks`/`match`).
- Empty archive → honest empty state (see **Viewer async states**).
- World→screen mapping (fixed-point sub-units → px) is a viewer concern.
- Viewer **page** route naming (the API owns `/replay`; the shareable page could be e.g.
  `/watch/{id}`).
- Handle isn't in the archive → per-entry identity is `name` + `model` only.

## Gaps closed — find-gaps session, 2026-07-15

Resolved (10):

```
[Blocker → Error contract]          /replay id-not-found = 404 replay-not-found (all cases); empty list = 200 + []
[Blocker → Reconstruction fidelity] Headline = runFight(challenger A, King B, seeds[0]) reusing arena rules/maxTicks/match; equality-test AC
[Should  → Durability & lifecycle]  Watchable fights impermanent by design (eviction + version-bump → graceful 404)
[Should  → Durability & lifecycle]  Version bump swaps to a fresh empty archive; old permalinks rot (accepted)
[Should  → Compute cost & caching]  Immutable cache (content-hash id) + /fight-style WAF backstop; cheap 404 path
[Should  → List ordering]           Newest-first by reversed append order; no date/ordinal shown (no timestamp exists)
[Should  → Viewer async states]     Loading / fetch-error (retry) / not-found (no-retry, back-to-list) / empty-list states
[Nice    → Nice-to-haves]           Identity display: name-only when no model, truncate long name, hash-fragment disambiguator
[Nice    → Nice-to-haves]           Tape payload budget: plain JSON, no quantization (caching + gzip suffice)
[Nice    → Nice-to-haves]           Observability: structured log per /replay request (id, resolve hit/miss, reconstruction timing)
```

Parked (explicit follow-ups, unchanged from the decision set):

```
[Should] Longer retention (raise/pin K) + a durable cross-version replay store
[Nice]   Add a commit timestamp to ReproRecord (store-contract change; only back-populates new records)
[Nice]   Representative-seed pick + both-orientation bout drill-down
[Nice]   Per-entry verdict badge; historical-version replay; visual juice
```

These tighten the S1 (`/replay` API) and S3 (list UI) acceptance surface in
`plans/replay-viewer-stories.md`; `planning` for S1 should inherit the error contract,
reconstruction-fidelity AC, caching, and viewer async states.
