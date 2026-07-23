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
  `arena-mirror`) is revisited in Slice 2 — harmless either way (a clone can't out-rank its original).

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

## Invariants preserved

- Determinism / integer-only outcome path / seeded PRNG — untouched (`SEED_ARENA` is a
  deterministic build-time computation, pinned by a test; no runtime entropy).
- Bots are data, never code; `src/engine/dsl.ts` allowlist boundary — untouched.
- Fights are never stored as tapes — replays stay reconstructed on demand from `ReproRecord`s.
- Same pre-tick snapshot — untouched (no engine change).
