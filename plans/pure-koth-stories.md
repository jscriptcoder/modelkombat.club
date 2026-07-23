# Pure King-of-the-Hill — story split

Split of the "drop the gauntlet + watch every competing fight" arc into vertical slices.
Decisions behind each slice: `pure-koth-decisions.md`. Engine + TCB untouched throughout
(all work in `src/http/`, `api/`, `web/`).

## Parent

A **bot author** can enter a pure King-of-the-Hill ring — submit a fighter that battles the
sitting champions directly, with no gauntlet to clear first — and any **spectator** can watch
every bout that decided the board.

## Recommended First Slice

**S1 — Fresh seeded v20 season.** Bump to v20 (the wipe), seed the board with the three
strongest house bots via a deterministic build-time round-robin, and self-heal an empty store
to that seed — with the gauntlet gate still in place.

**Why this first:** it burns down the only genuinely _novel_ risk in the arc — deterministic
seeding + the self-healing empty-store default — in isolation, with the smallest blast radius
(no response-contract or UI change). It is independently shippable and valuable (the board goes
live pre-populated with three strong, watchable champions instead of empty), and it establishes
the seeded, non-empty arena that S2's "fight the arena directly" depends on. Doing it before the
gauntlet drop avoids the version-ordering trap: seeding as default-when-empty only fires while
the v20 arena is still empty, so it must land at the v20 boundary, before any submission
populates the board.

## Split Candidates

| Slice                                | Value (actor)                                                                                                                 | Includes                                                                                                                                                                                                                                                                                                                                                                                                                         | Defers                                                                                     | Acceptance Examples                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Release                                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **S1 — Fresh seeded v20 season**     | Site visitor sees a live board of 3 house champions instead of an empty ring; seeding determinism proven in prod (author)     | Bump `BENCHMARK_VERSION`→v20; compute `SEED_ARENA` at build time (round-robin among the 3 strongest gauntlet bots → King/#2/#3, asserted by a test); each seed `ArenaMember` carries `handle: "Gauntlet"` + an overridden `model: "House"` (D15, revised); `readArena`-empty → `SEED_ARENA` shared by `handle-fight` **and** `handle-king`; first compete materializes it via normal CAS. **Gauntlet gate unchanged.**           | Dropping the gauntlet; response reshape; watchability; making seed-vs-seed bouts watchable | • Fresh v20 store → `/king` shows the 3 seeded bots ranked King/#2/#3 in the deterministic order, each credited `[Gauntlet]` with model `House` (unknown/generic glyph).<br>• Seed order is a build-time constant, asserted by a test; the handler never recomputes it at runtime.<br>• `/king` on an empty store returns `SEED_ARENA` (not "no King yet"), read-only — it never materializes/writes.<br>• On an empty store the first compete commits with CAS `expected = null` (physically empty), materializing `SEED_ARENA` (challenger unplaced) or the arena as modified by the challenger (placed). It must **not** pass `SEED_ARENA`'s nominal generation as `expected` — that would 409 (`throne-moved`) on every first compete forever.<br>• A gauntlet-clearer competes → round-robins the 3 seeded bots (not an empty arena), placed accordingly. | Shippable (this _is_ the prod wipe / new season)                                                       |
| **S2 — Drop the gauntlet**           | Bot author submits a fighter that battles the champions directly — no 6-bot gate; simpler, faster, legible (the headline ask) | Remove gauntlet `benchmark` + `cleared` gate from `handle-fight`; reshape `/fight` → `{version, title\|projection:{outcome,rank,board,displaced?}}` (per-row telemetry kept); retire `buildFightReport`/`FightReport` + empty-arena bootstrap branch; `/ring` UI (arena-only headlines dethroned/entered/unplaced, drop gauntlet scorecard, board is primary, loading copy); home "Gauntlet" section removed + How-It-Works copy; **author-facing spec** (`gen-spec.ts` → /spec · /spec-guide · `docs/spec.md`) + `llms.txt` rewritten to fight-the-champions-directly (own sub-slice; regen `spec.md` — no version/hash change) (D16); make the arena-mirror guard model-agnostic (strip the inert `model` before the compare, http-only) so a House clone is rejected (D17) | Watchability changes                                                                       | • Any valid bot competes → no gauntlet runs; placed by the arena round-robin alone.<br>• `/fight` body has `{version, title\|projection}`, no `cleared`/`gauntlet`.<br>• `/ring` after a compete → arena headline + per-defender board, zero "gauntlet" language.<br>• Home page → no "The Gauntlet" section; copy describes pure KotH.<br>• A raw resubmit of a seeded House champion (differs only by `model`) → 409 `arena-mirror` naming its slot; it never competes or takes a slot (D17).<br>• `/spec` + `llms.txt` describe fighting the sitting champions directly — no "clear all six / title shot" gate language (D16).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Shippable; **API + `/ring` must land together** (ring keys on `body.cleared`) — stage within the slice |
| **S3 — Watch every competing fight** | Spectator watches how a fighter beat (or lost to) each of the three champions, not just the King bout (the second ask)        | Per-bout content-hash ids over `{challenger,defender,seed,version}`; `handle-replay` reconstructs any of the 3 challenger-vs-defender bouts; replay page matchup switcher (King/#2/#3); `/ring` board rows deep-link to their bout; `DEFAULT_ARCHIVE_LIMIT` 50→200                                                                                                                                                               | Defender-vs-defender bouts (internal); true-permanent retention (storage restructure)      | • A placed compete → its replay page switches between 3 matchups, each a byte-faithful tape.<br>• A bout permalink resolves to exactly that matchup (content-addressed; identical bouts dedupe).<br>• A `/ring` board row → opens that specific bout's replay.<br>• >200 archived competes → newest 200 remain watchable, older age out.<br>• **Prereq:** before raising `DEFAULT_ARCHIVE_LIMIT` to 200, confirm the Upstash plan tolerates a full-archive `LRANGE` reply (~2.5 MB+) within its response ceiling + acceptable cold-read latency; fall back to the largest safe cap if not.                                                                                                                                                                                                                                                                     | Shippable                                                                                              |

## Dependency order

`S1` (seed + v20) → `S2` (drop gauntlet) → `S3` (watchability). S2 depends on S1 for a real
seeded board and the self-heal default that lets the bootstrap branch be deleted safely. S3
depends on S2's reshaped `/ring` board (the deep-link source); the archive it reads exists
regardless, so S3 could be built in parallel but is best sequenced last.

## Rollback

- **S1 (v20 bump).** The wipe is non-destructive: v20 uses fresh version-keyed keys, so the v19
  `arena:v19` / `archive:v19` records stay in Redis, merely orphaned. Rollback = redeploy the
  pre-v20 commit; v19 data restores intact, no recovery step. (Confirms the "wipe is a version
  bump" claim is reversible.)
- **S2 / S3.** Handler + web changes only — no store schema/migration to reverse. Rollback =
  redeploy the previous commit (standard Vercel). S3's `DEFAULT_ARCHIVE_LIMIT` raise is forward-
  only data (extra archived records are harmless if the cap is later lowered — they age out).

## Parking Lot

- **Watchable seed launch bouts** — make the house-bot-vs-house-bot round-robin that decides
  the seed order watchable (a "how the season opened" showcase). Currently internal, like
  defender-vs-defender bouts. Low cost, optional; revisit after S3.
- **True-permanent replay retention** — per-record keyed storage (replayId → record) + a list
  index, so nothing evicts. Deferred from D13; its own slice if "watchable forever" becomes a
  hard promise.
- **Richer home "Arena / House Fighters" section** — S2 just _removes_ the Gauntlet section; a
  richer live-arena showcase to replace it is a follow-up.
- **`/variety` framing reframe** (nice-to-have; `find-gaps` 2026-07-23) — the `/variety` page +
  `docs/variety.md` describe move-usage over "the frozen gauntlet you fight." The 6 bots survive as
  internal tooling + the seed roster (D6), so the data stays valid and **S2 leaves the page
  unchanged**; a copy reframe ("reference population" / "House fighters", no gate implication) is an
  optional follow-up. Low value — it's an explicitly-optional diagnostic page.
- **Which three bots are "strongest"** — ✅ resolved in S1 planning: grappler (64%) / sweeper (60%)
  / rekka (59%) by `winRateVsRoster`; 3-way round-robin → King grappler, #2 sweeper, #3 rekka. Pinned
  by a test in `pure-koth-s1.md` Slice 1.
- **S2 exact microcopy** (deferred by choice) — the crowned/entered/unplaced `/ring` headlines and
  the home "How It Works" copy are written during S2 implementation with the UI in context. Guardrail
  (already an S2 AC): no "gauntlet" wording; the headline reflects the arena outcome + board.
- **`/sheet` motion-trail (D5 of the prior arc)** — pre-existing, unrelated optional follow-up.
- **Old v19 replay permalinks break** (nice-to-have) — the per-bout id scheme (D14) is v20-forward
  and v19 is wiped, so pre-existing `/replay/{old-id}` links 404. Acceptable given the wipe; no
  redirect shim.
- **No delete flow for archived fights** (nice-to-have) — handles/names are user-provided and
  "public if you win" (low PII); records age out at K=200. A takedown/deletion path is out of scope.
- **No new observability** (nice-to-have) — the project has no telemetry/alerting stack by norm;
  the Vercel build + the test suite are the gate. Not adding dashboards for this arc.

## Warnings

- **S2 API↔web coupling → single PR** (resolved via `find-gaps` 2026-07-23). The `/ring` UI keys
  on `body.cleared`; if the reshaped API ships before the UI it shows "Didn't clear the gauntlet"
  for everything. **Chosen mechanism:** the handler contract reshape + the `/ring` UI reshape (+
  home "Gauntlet" section removal) ship in **one PR** — no shape-tolerant dual-read shim, no deploy
  point where the UI reads a shape it can't handle. Do **not** split S2 into "API story" + "web
  story." (The D16 author-facing spec docs and the D17 mirror guard land as their own S2 sub-slices.)
- **Verify the version bump is a clean wipe.** Confirm the Upstash adapter keys strictly by
  version so v19 data is orphaned (not read) and v20 self-seeds. Check in S1 planning.
- **`INPUT_HASH` guard.** Bumping `BENCHMARK_VERSION` alone should not move `INPUT_HASH` (the
  gauntlet bots' scoring content is unchanged). Confirm the `benchmark-config.test.ts` guard
  passes with only the version string changed.
- **Determinism.** `SEED_ARENA` must be a pinned build-time computation (asserted by a test),
  never recomputed at runtime with fresh entropy.

## Progress

- **S1 — Fresh seeded v20 season: ✅ SHIPPED & CLOSED** (2026-07-23; PRs #396–#400, `main`@`a717e41`).
  Plan archived → `docs/archive/pure-koth-s1.md`. The live season is now `v20`, born seeded with the
  three House champions (grappler / sweeper / rekka).
- **S2 — Drop the gauntlet:** next.
- **S3 — Watch every competing fight:** pending (after S2).

## Next Step

Load `planning` for **S2 — Drop the gauntlet** to turn it into PR-sized implementation slices
(each running the full `tdd` → `testing` → `mutation-testing` → `refactoring` cycle before code).
`grill-me` + `story-splitting` are already done for the whole arc (see `pure-koth-decisions.md`
D1–D15 + the split above), so S2 goes straight to planning; optionally run `find-gaps` on the S2
row first to harden its acceptance examples and settle the two open planning questions — the
API↔`/ring` staging (land together; see Warnings) and the D15 mirror-rule consequence (whether a
byte-identical raw resubmission trips the C4 `arena-mirror` rule, flagged for Slice 2).
