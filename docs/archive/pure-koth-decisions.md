# Pure King-of-the-Hill — resolved decisions

The design trail behind "drop the gauntlet + make every competing fight watchable."
Resolved via a `grill-me` interview (2026-07-23). These are the locked decisions the
`pure-koth-stories.md` split is built on. Engine + TCB are untouched throughout — every
change lives in `src/http/`, the `api/` wrappers, and `web/`.

## Context (the two asks)

1. **Drop the gauntlet.** Today `POST /fight` runs a 6-bot gauntlet gate
   (`handle-fight.ts` → `benchmark({ gauntlet })` → `if (!report.cleared) return`) before a
   clearer is allowed to contest the arena. The ask: remove the gate — a bot fights the
   sitting champions directly to become King.
2. **Every `X-Compete: true` fight watchable.** Competing already archives a `ReproRecord`;
   `/replay` reconstructs only the challenger-vs-King bout. The ask: make competitive fights
   watchable.

## Decisions

### Competition model

- **D1 — Wipe is disposable.** All current prod kings/fights are the owner's experiments;
  they can be discarded. No migration.
- **D2 — Keep the top-3 ladder.** A challenger still round-robins the sitting champions,
  ranked by Copeland wins → Σ net → seniority into crowned (#1) / entered (#2–3) / unplaced.
  Only the gauntlet **pre-gate** is removed — podium, ranks, seniority, displacement all stay.
  (Rejected: collapse to 1v1-vs-King — throws away the podium for no ask.)
- **D3 — Seed all three slots full.** A full ring at launch makes "out-rank the weakest
  sitting bot" the entry floor **for free** (the existing relegation cut _is_ the quality
  gate). No new gating code replaces the gauntlet. (Rejected: seed only the King — `rankArena`
  join-if-room would seat losing bots in the open slots, needing a brand-new floor rule.)
- **D4 — Seed source: the three strongest existing gauntlet bots.** A build-time round-robin
  among them fixes the launch King/#2/#3 order deterministically, asserted by a test. Reuses
  proven-balanced, visually-distinct bots; zero new calibration. "Strongest" is a fact to pull
  from calibration/telemetry at build time. (Owner's rationale: seeds are placeholders that
  churn out fast; variety is for _watchability_, and any three archetypes are distinct.)
- **D5 — Self-healing seed default.** The seed arena is a build-time constant `SEED_ARENA`;
  the handler (and `/king`) treat an empty store as `SEED_ARENA`, and the first real compete
  materializes it through the normal CAS commit. This **replaces** the old "empty arena →
  crown the first submission" bootstrap and self-heals after any wipe. No deploy/migration step.
- **D6 — Gauntlet fully removed from the public product.** `/fight` runs only the arena
  round-robin. The six bots survive as internal tooling (`npm run benchmark`, telemetry) and
  as the seed roster. (Rejected: keep a non-gating public "practice diagnostic" — dual-system
  complexity the drop is meant to eliminate.)
- **D7 — The wipe _is_ a version bump.** Bump `BENCHMARK_VERSION` v19 → **v20**. Throne/arena/
  archive are version-keyed, so a new version orphans v19 data automatically and the fresh v20
  arena self-seeds (D5) — no manual Redis wipe.
- **D15 — Seeds are visibly House fighters.** Each seeded `ArenaMember` carries
  `handle: "Gauntlet"` (the author credit) and an overridden `model: "House"` so `/king` and the
  `/ring` board show a `[Gauntlet]` credit, a "House" model label, and the neutral/unknown brand
  glyph — `modelToBrand` maps any unrecognized model → `generic`, so **no web change is needed**.
  Players can tell placeholder champions from real LLM submissions, framing the goal as "dethrone
  the house champions." `name` stays the archetype name. Overriding `model` is safe: the engine
  never reads it and `INPUT_HASH` excludes it, so a fight is byte-identical whatever the label.
  (Revised 2026-07-23 from the original `handle: "House"`, on the owner's call — the docs actually
  carry `model: "gauntlet"`, so the identity is now handle `Gauntlet` + model `House` rather than a
  bare `[House]` handle.) Consequence: the seed champion doc's `model` now differs from
  `bots/<name>.json`, so whether a byte-identical raw resubmission trips the C4 mirror rule (409
  `arena-mirror`) is **resolved in D17** (S2 makes the mirror guard model-agnostic, so a House clone
  IS rejected rather than competing).

### Response contract (forced by D6)

- **D8 — `/fight` becomes placement-only.** Response = `{ version, title | projection }`, where
  the block is `{ outcome, rank, board, displaced? }`. Drop `cleared` and `gauntlet.perOpponent`;
  **keep** each board row's telemetry (win-rate / net / W-L-D / endReasons / degrade). There is
  no "failed the gate" tier — every valid bot lands crowned/entered/unplaced.
- **D9 — Retire dead code.** The gauntlet benchmark pass + gate, `buildFightReport` /
  `FightReport` / `FightReportOpponent`, and the empty-arena bootstrap branch all go.
- **D10 — `/ring` reshaped + home section removed.** Gauntlet scorecard and "Cleared the
  gauntlet" headlines removed; the arena board is the primary result; loading copy updated. The
  home "The Gauntlet" section is removed (King + Podium already show the live arena) and any
  "How It Works" copy referencing the gate is refreshed.
- **D16 — The author-facing spec drops the gauntlet too (S2 scope, own sub-slice).** `/spec`
  (generated from `src/cli/gen-spec.ts`, also feeding the prerendered `/spec-guide` and the built
  `docs/spec.md`) and `web/public/llms.txt` currently instruct authors to "clear all six gauntlet
  opponents" for a title shot — wrong the moment the gate drops (D6). S2 rewrites their "Benchmark
  rules" + compete/practice framing to describe fighting the sitting champions directly (out-rank the
  weakest of the up-to-three-member arena to enter, beat the King to be crowned); the WKF scoring
  mechanics, seeds, move list, and frame table are unchanged. Sizable enough to be **its own S2
  sub-slice**. Mechanics: a `gen-spec.ts` prose change forces `npm run gen:spec` (the `docs/spec.md`
  byte-drift guard `gen-spec.test.ts` goes RED until regenerated) but moves neither `BENCHMARK_VERSION`
  nor `INPUT_HASH`. The internal 6-bot gauntlet still exists (D6) — it just stops being described as
  the public gate. **The per-opponent roster listing is removed outright, not reframed:** the spec
  names no specific fighters — not even the three House seeds, which are transient (real submissions
  displace them within a season, so naming them would date the spec). In its place it describes the
  climb — fight the sitting champions (a live ladder of prior winners), enter by out-ranking the
  weakest of the top ranks, be crowned by reaching #1 / beating the King. (Decision 2026-07-23.)
  (Surfaced by `find-gaps` 2026-07-23; D10 had named only `/ring` + the home section.)
- **D17 — Mirror check becomes model-agnostic (resolves D15's Slice-2 question).** A seed's stored
  `champion` carries the display override `model: "House"` (`seed-arena.ts`) while `bots/<name>.json`
  carries `model: "gauntlet"`, so a raw resubmit of a House champion is NOT byte-identical and today
  slips past `mirrorSlot`'s `sameDoc` check → it competes, and (inheriting its original's dominance
  over the other two seeds) can occupy a board slot, relegating a distinct archetype and eroding the
  seed's variety purpose. S2 makes the arena-mirror guard compare **scoring content** instead of raw
  bytes: `mirrorSlot` strips the inert `model` field before the deep-equal — **http layer only**
  (`src/http/`, NO engine / `sameDoc` / benchmark change, honouring the arc's engine-untouched
  invariant). Effect: a House clone (and any same-doc copycat resubmitted under a different `model`)
  is rejected 409 `arena-mirror` ("already holds slot #k"), matching the rule's intent that an
  unchanged fighter has no effect. A byte-exact resubmit of a real member is still caught (a superset).
  (Resolved via `find-gaps` 2026-07-23.)

### Watchability

- **D11 — Scope: all three of the challenger's bouts.** vs King / #2 / #3 — "watch how the
  fighter fought its way onto the board." Free (the archived record already stores all three
  defenders + the seed). Defender-vs-defender bouts stay internal (ranking plumbing).
- **D12 — Coverage is already there.** All three commit paths (crown / enter / unplaced)
  archive, so every compete already produces watchable material. Practice (`X-Compete` ≠ true)
  stays footprint-free and unwatchable — consistent with "every _competing_ fight watchable."
- **D13 — Retention bounded at 200** (up from `DEFAULT_ARCHIVE_LIMIT = 50`); the archive is a
  **Redis list** (`RPUSH`/`LRANGE`), not a single blob — the write evicts server-side in Lua
  (cheap network at any K), but `readArchive` pulls the whole list in one `LRANGE 0 -1` reply and
  `/replay` does this on every list view and every uncached item resolution. At ~13 KB/record
  (house-sized; a large challenger ~25–30 KB) K=200 ≈ **~2.5 MB+ per uncached read** (vs ~650 KB
  at K=50). **Prerequisite:** verify the Upstash plan tolerates ~3 MB `LRANGE` responses and the
  cold-read latency is acceptable before raising the cap; fall back to the largest safe cap if not.
  "Every _recent_ competing fight watchable"; permalinks last a long window. (Deferred: true-
  permanent via a per-record-keyed storage restructure — its own follow-up, and the real fix if the
  read-size ceiling ever bites.)
- **D14 — Per-bout content-hash permalinks.** Each bout is hashed over
  `{ challenger, defender, seed, version }`, so every matchup has its own permalink and identical
  bouts dedupe. The `/watch` browse list stays **one entry per submission** (headlined by the
  challenger-vs-King bout); the replay page switches between the three matchups; each `/ring`
  board row deep-links to its specific bout. (Rejected: three flat list entries per submission —
  triples list length, buries the headline.)
- **D18 — `/fight` embeds the per-bout replay ids (the `/ring` deep-link source).** A `/ring` board
  row cannot hash its own bout id: the client only ever receives identities + telemetry, never the
  defender documents or seeds (doc-privacy — the champion's DSL never crosses the wire). So the server
  is the only place the id can come from. `handle-fight`, which holds the `ReproRecord` it just built,
  computes each bout's content-hash id and attaches it to the matching board row in the **compete-only**
  `title` block; the headline "watch this fight" link is simply `board[0]`'s id (the King bout — no
  separate field). The practice `projection` stays id-free and unwatchable (D12 — practice is
  footprint-free). http-layer only (no engine / DSL touch). (Resolved via `find-gaps` 2026-07-23.)
- **D19 — The replay page loads matchups lazily by bout id.** The per-bout id — `sha256` over the
  canonical `{ challenger, defender, seed, version }` (singular, bout _i_ = `defenders[i]`/`seeds[i]`) —
  **replaces** the record-level `replayId`. Resolving a bout id returns that **one** reconstructed tape
  PLUS its sibling matchups (each `{ id, fighters }`) so the switcher knows the parent submission's
  other bouts (a hash can't derive its siblings — `handleReplay` finds the parent record and lists all
  its bouts). Switching fetches each tape by its id, each content-addressed + `immutable`-cached, so a
  matchup is reconstructed at most once and only when actually watched. The browse list stays **one
  entry per submission**, headlined by the King bout (its id = the King-bout id). (Rejected: eager —
  reconstruct all three tapes in one response — 3× the CPU + payload per view with no per-bout cache
  reuse; and the flat three-entry list, already rejected by D14.) (Resolved via `find-gaps` 2026-07-23.)
- **D20 — The 50→200 retention raise is its own gated, measured slice.** The `DEFAULT_ARCHIVE_LIMIT`
  bump (D13) lands **last and isolated**: first measure the real Upstash full-archive `LRANGE` reply
  size + cold-read latency at scale, then raise to 200 — or the largest cap the plan tolerates if the
  measurement says 200 is unsafe. This keeps the storage-ceiling risk out of the feature slices and
  stays reversible (the cap is forward-only data — surplus records age out if it is later lowered).
  (Resolved via `find-gaps` 2026-07-23.)

## Invariants preserved

- Determinism / integer-only outcome path / seeded PRNG — untouched (`SEED_ARENA` is a
  deterministic build-time computation, pinned by a test; no runtime entropy).
- Bots are data, never code; `src/engine/dsl.ts` allowlist boundary — untouched.
- Fights are never stored as tapes — replays stay reconstructed on demand from `ReproRecord`s.
- Same pre-tick snapshot — untouched (no engine change).
