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

| #   | Decision                            | Choice                                                                                                                                                                              |
| --- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tape reconstruction & doc exposure  | **Server-side reconstruct; return the motion tape only — bot documents never leave the server.** Protects KotH competitive integrity + honors the `/fight` no-docs contract.        |
| 2   | List unit / "a fight"               | **One entry per archived title attempt** (`ReproRecord`). Headline watchable bout = **challenger vs the King (`defenders[0]`)**. Drill-down (other defenders/seeds) deferred.        |
| 3   | List content                        | **Identities only** (`name` + `model`); outcome revealed on watch. The list endpoint runs **zero fights** (pure `readArchive` → identity projection).                               |
| 4   | Version scope                       | **Current version only** (`readArchive(CURRENT_VERSION)`) — byte-exact reconstruction against today's `CANONICAL_RULES` + `MATCH`. No rules-snapshotting; historical replay deferred. |
| 5   | Fight id                            | **Content hash** — sha256 of the record's canonical JSON (`challenger + defenders + seeds + version`). Eviction-proof, permalinkable, cacheable. Idiomatic vs the `INPUT_HASH` pattern. |
| 6   | Endpoint shape                      | **REST collection + item**: `GET /replay` (list), `GET /replay/{id}` (tape). One flat `api/replay.ts` behind two rewrites (`/replay` → list, `/replay/{id}` → `?id=$1`).             |
| 7   | Render state source                 | **Additive render-tape export.** The public `events` tape is too thin (no posture/band/throwing/knockdown/facing). Byte-identical outcome path, **TCB-untouched**, **`INPUT_HASH`-neutral**. |
| 8   | Export shape                        | **Dedicated `renderTape(cfg)` sibling** — `runFight`/`FightResult` stay frozen so the benchmark hot path pays nothing. Reuses the already-computed internal `Frame` histories.        |
| 9   | Rendering tech                      | **Pixi** (per `docs/DESIGN.md` — reconsidered vs SVG/Canvas2D; Pixi kept for animation headroom). Tested via a pure scene-model + a thin draw layer.                                |
| 10  | v1 fidelity bar                     | **Walking skeleton first** — positions + facing + score/tick HUD, minimal poses. Full posture vocabulary is the next slice.                                                          |
| 11  | Transport in the skeleton slice     | **Autoplay + play/pause/restart** only. Scrub bar + speed land with the later fight-list/transport slice.                                                                            |
| 12  | Viewer testing                      | **Pure `scene(tape, tick) → Scene` model** exhaustively tested (exact assertions + manual mutator scan; web is not Stryker-reachable) **+ Pixi display-object assertions** (not pixels). `agent-browser` = out-of-band visual smoke. |
| 13  | Bootstrap records                   | **Filtered out** of the watchable list — a bootstrap crowning (`reproRecord([], 1)`) has empty defenders / no bout to animate. Reversible later.                                     |

## Error contract (find-gaps, 2026-07-15)

RFC 9457 `application/problem+json`, consistent with the existing `/fight` flat-slug
convention.

- **`GET /replay/{id}` — id doesn't resolve to a watchable fight** → **`404`
  `/problems/replay-not-found`**. One status for *all* non-resolving cases: unknown hash,
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
  produces a *different* fight and breaks the tape-vs-fight equality test. The endpoint and
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
  watches are served from cache; only the first computes. Caching a *derived, reproducible*
  tape does not violate invariant #1 (it's not a persisted source-of-truth tape).
- **WAF per-IP backstop.** Reuse the `/fight`-style modest per-IP rate-limit (a dashboard
  action, not repo code) as a floor against cold-replaying many valid ids.
- **Cheap failure path.** A non-resolving id returns `404` *before* running any fight
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

## Non-negotiable invariants respected

- **#1 determinism** — reconstruct from stored docs+seeds; **no tape is ever persisted**.
- **TCB / security** — `renderTape` reads state the engine already computes; `dsl.ts`
  allowlists untouched; docs never cross the wire.
- **`INPUT_HASH` / `BENCHMARK_VERSION`** — unchanged (a render output projection is not a
  scoring input).
- **Same pre-tick snapshot** — unaffected (read-only projection).

## Key facts (verified during the session)

- `runFight` already emits `FightResult.events` (`FighterFrame`: `{x, y, action, points,
  stamina, degrade}`), but `action` is the bot's *returned decision*, not resulting body
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
