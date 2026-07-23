# Plan: Pure King-of-the-Hill — S3 "Watch every competing fight"

**Branch**: feat/pure-koth-s3-watch-fights
**Status**: Active

The final slice of the pure-KotH arc. Story: `pure-koth-stories.md` (S3 row). Decisions:
`pure-koth-decisions.md` (**D11–D14** watchability, **D18–D20** resolved 2026-07-23 via `find-gaps`).
Engine + TCB untouched throughout — every change lives in `src/http/`, the `api/` wrappers, and
`web/`. `BENCHMARK_VERSION` (`v20`) and `INPUT_HASH` do **not** move (no scoring input changes).

## Goal

A spectator can watch how a fighter beat (or lost to) **each** of the three sitting champions — not
just the King bout — reaching every matchup by its own permalink, including straight from the `/ring`
board row that reports it.

## Background (current machinery → what S3 changes)

- `replayId(record)` (`handle-replay.ts:78`) hashes the whole record `{challenger, defenders, seeds,
version}` → **one id per submission**; the item read reconstructs **only** `defenders[0]` (the King
  bout). S3 introduces a **per-bout** id over `{challenger, defender, seed, version}` (singular; bout
  _i_ = `defenders[i]`/`seeds[i]`) that **replaces** it, and reconstructs any of the three bouts (D19).
- The `ReproRecord` already stores all three `defenders` + all three `seeds` (D11 — watchability is
  "free"); reconstructing bout _i_ is `renderTape` with `botB = defenders[i]`, `seed = seeds[i]` on the
  same frozen `rules`/`maxTicks`/`match` the `ReplayDeps` already inject. No new stored data.
- `/fight`'s compete `title` block carries per-defender board rows (identity + `TitleFightReport`
  telemetry) but **no** defender docs or seeds — so the `/ring` client cannot hash a bout id itself.
  Slice 3 has `handle-fight` attach a per-bout `replayId` to each board row (D18).
- `DEFAULT_ARCHIVE_LIMIT = 50` (`throne-store.ts:73`); `readArchive` pulls the whole list via
  `LRANGE 0 -1` (`throne-store-upstash.ts:94`). Slice 4 raises it toward 200, gated on a measured
  Upstash ceiling (D13/D20).
- Web surfaces: `web/src/pages/replay/*` (list + player → matchup switcher) and
  `web/src/pages/ring/*` (`RingApp` board rows → deep-links).

## Acceptance Criteria

- [ ] A placed compete's replay page switches between its (up to) three matchups (King / #2 / #3),
      each a byte-faithful reconstruction of that specific challenger-vs-defender bout.
- [ ] Each matchup has its own permalink, content-addressed over `{challenger, defender, seed, version}`; two identical bouts resolve to (dedupe on) the same id.
- [ ] A `/ring` board row (after a compete) opens that row's specific bout replay.
- [x] The `/watch` browse list stays **one entry per submission**, headlined by the challenger-vs-King
      bout (D14) — S3 does not triple the list. _(Slice 1: list headline is now the King-bout id.)_
- [ ] With more than the retention cap of archived competes, the newest `cap` remain watchable and
      older ones age out; permalinks to still-retained bouts keep resolving.
- [ ] The Upstash full-archive `LRANGE` reply size + cold-read latency at the raised cap are measured
      and shown to tolerate the raise (or the cap is set to the largest safe value) **before** 200 ships.
- [ ] `BENCHMARK_VERSION` and `INPUT_HASH` are unchanged (`benchmark-config.test.ts` green); the engine
      and TCB are untouched.

## Slices

Four PR-sized slices. Slice 1 is the backend id/reconstruction contract (justified horizontal — it
unlocks Slice 2, is independently verifiable at the API by content-hash, and leaves `/watch` working
via the now-King-bout id); Slices 2–3 deliver the spectator-visible payoff; Slice 4 is the gated
retention raise. Each behavior-changing slice runs the full `tdd` → `testing` → `mutation-testing` →
`refactoring` cycle, and its acceptance criteria are **presented for confirmation before any code**.

### Slice 1: Reconstruct any of the three bouts by its own content-hash id — ✅ SHIPPED (#407, `main`@`8adadd3`)

**Value**: Spectator/API — every challenger-vs-defender bout (not just vs King) becomes an addressable,
byte-faithful reconstruction; the switcher and the `/ring` deep-link (Slices 2–3) build on it.
**Path**: `GET /replay?id=<bout-id>` → `handleReplay` finds the (record, bout) whose per-bout id
matches → `renderTape` reconstructs that bout → response carries the tape + its sibling matchups.
**Class**: Behavior change (API). Horizontal but independently verifiable; unlocks Slice 2.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (confirm before code):

- `boutReplayId({challenger, defender, seed, version})` = `sha256` of the **canonicalized** object
  (reuse the existing `canonicalize`), singular defender + seed. Bout _i_ uses `defenders[i]`/`seeds[i]`.
- `GET /replay?id=<a #2 or #3 bout id>` reconstructs **that** bout (challenger vs that defender at that
  seed), byte-identical to the fight that happened; the id for the King bout still resolves too.
- The item response includes `matchups`: for the parent submission, every bout as `{ id, fighters: [challenger, defender] }` in board order (so the switcher knows the siblings; a hash can't derive them).
- Two byte-identical bouts (same challenger/defender/seed/version) share one id (dedupe).
- The browse list stays one entry per submission; the headline `id` is the **King-bout** id
  (`boutReplayId(challenger, defenders[0], seeds[0], version)`), not the old whole-record hash.
- A bootstrap/`defenders: []` record (legacy safety) is unlisted and unresolvable (404), unchanged.
- A miss (unknown/evicted/malformed id) still 404s before any reconstruction.

**TDD**:

- **RED**: replay tests — a #2 bout id reconstructs the challenger-vs-#2 tape (assert a tape distinct from the King bout); the item response lists all three sibling matchup ids+identities; identical bouts dedupe; the list headline id equals the King-bout id. (Fails today: only `defenders[0]` resolves, ids are record-level.)
- **GREEN**: add `boutReplayId`; rework the item lookup to scan `record × bout`; return `matchups`; point the list headline at the King-bout id. Retire the record-level `replayId` once nothing uses it.
- **MUTATE**: Stryker on `handle-replay.ts` (in Node scope). Expect to kill the bout-index selection, the canonical field set (challenger/defender/seed/version), and the sibling-list construction.
- **KILL MUTANTS**: strengthen as needed (ask if a survivor's value is ambiguous).
- **REFACTOR**: assess `fightersOf`/`fighterIdentity` reuse for the per-bout `matchups` shape.
- **Done when**: ACs met, mutation report clean, suite green, commit approved.

### Slice 2: The replay page switches between the three matchups

**Value**: Spectator — on `/watch/<bout-id>`, tabs for King / #2 / #3 let them watch each fight of the
climb; selecting a matchup lazily fetches its tape (content-addressed, `immutable`-cached — one
reconstruction per matchup watched, D19).
**Path**: replay loader/page (`web/src/pages/replay/*`) reads the item response's `matchups`, renders a
switcher, and navigates to the selected bout id (fetch-by-id, cached).
**Class**: Behavior change (web).
**Required implementation skills**: `tdd`, `testing` (browser-mode), `refactoring`. `mutation-testing`:
`N/A` — `web/` is outside the Node Stryker scope; compensate with exhaustive exact-assertion browser
tests + a manual mutator scan (house convention for `web/`).
**Acceptance criteria** (confirm before code):

- Given a bout id, the page renders its tape and a matchup switcher listing every sibling by defender
  identity (model mark + name/handle), in board order, King first, current matchup marked (not colour
  alone).
- Selecting a sibling navigates to that bout id and renders its (distinct) tape; the browsed URL is the
  per-bout permalink (deep-linkable / shareable).
- A single-matchup record (defensive: `matchups.length === 1`) renders no redundant switcher.
- Loading / not-found / store-unavailable states are preserved from the current player.

**TDD**:

- **RED**: browser test — a replay page with a 3-matchup item shows 3 switcher entries; clicking #2 renders a tape different from the King bout; the URL reflects the #2 bout id.
- **GREEN**: minimum switcher + fetch-by-id wiring.
- **MUTATE**: `N/A` (web) — exact-assertion coverage + manual scan.
- **REFACTOR**: assess switcher extraction only if it earns its keep.
- **Done when**: ACs met, manual mutator scan recorded, suite green, commit approved.

### Slice 3: `/fight` embeds per-bout ids; `/ring` board rows deep-link to their bout

**Value**: Spectator/author — straight from the compete result, each board row opens that specific
bout's replay (the D14 "each row → its bout" payoff, closing the loop from result to watch).
**Path**: `handle-fight` (holding the just-built `ReproRecord`) attaches each board row its per-bout
`replayId` (compete-only `title`, via `boutReplayId` from Slice 1); `RingApp` renders each board row as
a link to `/watch/<that id>`.
**Class**: Behavior change (contract addition in `src/http` + web).
**Required implementation skills**: `tdd`, `testing` (Node for the contract, browser for `/ring`),
`mutation-testing` (Node side), `refactoring`.
**Acceptance criteria** (confirm before code):

- A compete response's `title.board[i]` carries a `replayId` equal to `boutReplayId(challenger,
defenders[i], seeds[i], version)` — matching the id Slice 1 resolves. The headline "watch this fight"
  target is `board[0].replayId` (no separate field).
- The practice `projection` carries **no** replay ids (unwatchable — D12/D18); the fields appear only
  on a `title` (compete) result.
- `/ring`: after a compete, each board row links to `/watch/<its replayId>`; the link text/target is
  keyboard-reachable and identity-labelled (no colour-only signal).
- `INPUT_HASH` unchanged (the added ids are response shape, not scoring input).

**TDD**:

- **RED**: Node test — a compete response's board row `replayId` equals the `boutReplayId` of its bout; practice carries none. Browser test — a `/ring` board row after a compete links to `/watch/<id>`.
- **GREEN**: compute + attach ids in `handle-fight`; link rows in `RingApp`.
- **MUTATE**: Stryker on the `handle-fight` id-attachment (Node scope) — kill the per-row bout selection and the compete-vs-practice gate. `/ring` web side: manual scan.
- **KILL MUTANTS**: strengthen as needed.
- **REFACTOR**: share the bout-id derivation with Slice 1 (single source — no duplicated hashing rule).
- **Done when**: ACs met, mutation report + manual scan recorded, suite green, commit approved.

### Slice 4: Raise the retention cap toward 200 after measuring the Upstash ceiling

**Value**: Spectator — a longer watchable window (more recent competes keep resolvable permalinks),
without risking the storage read ceiling (D13/D20).
**Path**: measure the real Upstash full-archive `LRANGE` reply size + cold-read latency at scale, then
raise `DEFAULT_ARCHIVE_LIMIT` to 200 (or the largest safe cap) — the one knob both the fake and the
Upstash adapter already read.
**Class**: Behavior change (retention window) — gated on the measured prerequisite.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`. Plus an
**operational measurement** step (the D13/D20 prereq) recorded before the raise.
**Acceptance criteria** (confirm before code):

- The Upstash full-archive `LRANGE` reply size + cold-read latency at the target cap are measured and
  documented; the raise proceeds to 200 only if within the plan's response ceiling + acceptable
  latency, else to the largest safe cap (record the number + why).
- With more than `cap` archived competes, `retainArchive` keeps the newest `cap` (plus pinned
  members) and older records age out — watchable ⇢ unwatchable exactly at the cutoff.
- `readArchive` returns all retained records; a still-retained bout permalink resolves; an aged-out one
  404s (unchanged behavior, larger window).
- Both the in-memory fake and the Upstash adapter bound to the same cap (the shared knob).

**TDD**:

- **RED**: a `retainArchive`/store test at the new cap — the (cap+1)-th-newest record is evicted, the newest `cap` retained (the rule already exists; the test pins the raised default's effect and guards the boundary). If only the constant changes with existing tests covering the rule, mark the mechanism `N/A` and rely on the existing eviction tests + the measurement evidence.
- **GREEN**: raise the constant to the measured-safe value.
- **MUTATE**: Stryker on `throne-store.ts` `retainArchive` (already covered) — confirm the boundary mutant (`index >= cutoff`) stays killed at the new cap.
- **REFACTOR**: none expected (a constant change).
- **Done when**: measurement recorded, ACs met, suite green, commit approved.

## Dependency order

`S3.1` (per-bout ids + reconstruct) → `S3.2` (web switcher — its link target must resolve first) →
`S3.3` (`/fight` ids + `/ring` deep-link — links point at the working replay page) → `S3.4` (gated
retention raise, independent; sequenced last). 3 could precede 2 mechanically but 2-before-3 keeps
every shipped link landing on a working destination.

## Rollback

Handler + web changes only — no store schema/migration to reverse. Rollback = redeploy the previous
commit (standard Vercel). Slice 4's cap raise is forward-only data (surplus archived records are
harmless if the cap is later lowered — they age out). Within-`v20` permalinks minted under the old
record-level id scheme change to bout ids in Slice 1; acceptable this early in the season (the archive
is near-empty post-wipe) — noted in the story Parking Lot ("old permalinks break").

## Pre-PR Quality Gate (per slice)

1. Mutation testing (Node slices) — run Stryker on the changed `src/http` files; `web/` slices record a
   manual mutator scan + exhaustive exact assertions (house convention).
2. Refactoring assessment — share the bout-id rule across Slices 1 & 3 (no duplicated hashing).
3. `npm run typecheck` + `npm run lint` pass; `format:check` only on touched files (pre-existing drift
   elsewhere — never `prettier --write .`).
4. `benchmark-config.test.ts` green (`INPUT_HASH` + `v20` unmoved).

## Next Step

**Slice 1 shipped (#407).** Next is **Slice 2** (the web matchup switcher). Load `tdd` + `testing`
(browser-mode) + `refactoring` (mutation `N/A` — `web/` is outside the Node Stryker scope; compensate
with exhaustive exact-assertion browser tests + a manual mutator scan), then present **Slice 2**'s
acceptance criteria for confirmation before writing the first failing browser test.

---

_Archive to `docs/archive/pure-koth-s3.md` on completion (per the arc convention); do not delete._
