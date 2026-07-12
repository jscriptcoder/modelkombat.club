# KotH ladder — resolved design decisions (grill-me record)

**Status:** DESIGN RESOLVED (grill-me, 2026-07-10). Feeds story-splitting → planning →
TDD. No code yet.
**Feature:** the version-scoped King-of-the-Hill **ladder** — the roadmap item after the
S4 single-throne (`docs/STATUS.md`: "the KotH ladder, /replay, and the Pixi viewer remain").
**Motivation:** a live dogfood (warden cleared v19 6/6 blind, took the empty throne) surfaced
that pure single-throne KotH permanently locks out a former king who could beat the _current_
king but lost to a _past_ one — throwing away the non-transitive richness of the fight space.
This makes deposed champions first-class challengers again, bounded so it can't cascade or freeze.

---

## The model in one paragraph

The gauntlet stays a **fixed entry gate** (clear all 6 > 50% to qualify — unchanged). Behind it
sits a **top-N ranked arena** of champion "defenders." A qualifier fights the N current defenders;
the N+1 bots are ranked by head-to-head record; the **top N survive** as the new arena and **#1 is
King**; the loser of the N+1 relegates. The whole ladder is a **deterministic tournament graph**
(each pair has one permanent verdict), so nothing is random and everything is reconstructible.

---

## Locked decisions

**D1 — Crowning rule: "top the arena."** King = **arena #1**, recomputed on every submission.
No incumbent-defender status; the sitting King has no special protection. Ranking is by win-count
among the arena+challenger set (Copeland: beat the most). Path-independent for a fixed member set,
and **cycle/deadlock-proof** — a bounded arena always has a #1, so the throne can never freeze.
(The 3-cycle X→Y→Z→X can't crown anyone by "beat them all," but "beat the most" always resolves.)

**D2 — Rank key (and tiebreak).** In priority order: **(1) arena win-count** → **(2) Σ net-points**
(`botScore − oppScore` across the arena fights) → **(3) seniority** (longest unbroken arena tenure)
as the dead-even backstop. A challenger must **strictly out-rank** to climb; an exact tie retains the
status quo. Mirrors `benchmark.ts`'s existing winRate→net ranking and the code's `> 0.5`
strict-dethrone rule everywhere. All figures already computed (we shipped `net` in the title
telemetry in PR #250).

- **Seniority stamp.** On every arena entry a bot is assigned the next value of a
  **strictly-increasing per-version entry counter**; lower = more senior. Because the counter is
  unique, (win, net, seniority) is a **strict total order** — no bot can fully tie another, so the
  ranking and the relegation choice (§below) are always unambiguous.
- **Re-entry is a fresh entry (D3).** A re-submitted former champion gets a **new, junior** stamp —
  seniority means _continuous tenure in the current arena_, not "first seen ever." Departed bots'
  stamps are forgotten; no permanent registry is needed. So a returning veteran loses win/net ties to
  anyone who has defended continuously longer.
- **Not the CAS token.** This seniority stamp is distinct from the **arena-record generation** used
  for optimistic concurrency in C3 (which versions the _whole arena object_, not a single bot).

**D3 — Relegation: permanent from the active arena; re-entry by re-submission.** The system
**never auto-re-runs** a relegated bot (keeps the ladder bounded, cascade-free, human-driven — the
anti-cycle property). But the author can always **re-submit the doc** to challenge the current
arena; determinism + cheap recompute make that consistent and free. This delivers the "Bot A
challenges new King C" upset — _manually_, when someone chooses to try. The ladder moves **only on
human submissions**.

**D4 — N is a per-version FROZEN constant. Default N = 3.** Pinned alongside the gauntlet/ruleset
per version (like the frozen v19 gauntlet). Changing N **requires a version bump**, which already
starts a fresh empty ladder — so N never mutates a live competition and any ladder's shape is fully
reconstructible from its version. Default **3** aligns with the existing podium (gold/silver/bronze).
Dial N up in a future version as models improve and you _want_ the crown harder — the cap keeps
"harder" from ever becoming "impossible."

**D5 — No seasons in v1; a version bump is the reset.** Want a fresh ladder? Bump the version
(v19→v20), even with an unchanged engine — that already starts an empty throne. The cap already
prevents a frozen throne, so seasons are optional flavor, **deferred**. No season key, no cron, no
new state.

**D6 — Reproducibility archive: keep the last K records (count-bounded).** Every gauntlet-clearer's
**reproduction record** — `{challenger doc, defender docs, seeds, version}`, **NOT a tape** (invariant
#1 intact: the fight is regenerated via `runFight`) — is archived **privately**. Replays render
**behavior only** (positions/moves), never the DSL, so **doc-privacy is preserved** (scout by
behavior, as designed). Pruned by **COUNT**: keep the newest **K**, and evict the oldest —
but eviction **skips any record belonging to a current arena member** (King + the N−1 other
defenders). So the effective archive is "newest **K** records **+** up to **N** pinned arena
records," and everything _live_ is always replayable: you can always watch how the sitting King and
each defender got in, no matter how long they reign. A record **un-pins the moment its bot relegates**
and becomes evictable like any other. (The arena's _fighting_-docs live in the arena record and are
never pruned regardless — this exemption is specifically about keeping current members' **replay**
records too.) K is tunable config. Feeds the future `/replay` + Pixi viewer (which just consume this
archive).

**D7 — Crown gate: pure rank, #1 IS King.** No extra "must beat the sitting King head-to-head"
requirement. Accepts the honest non-transitive case — you can be crowned having _lost_ to the bot
you replaced, because you beat more of the rest of the field. Avoids any contradictory "ranked #1
but not King" state (which the head-to-head gate would create, breaking D1).

---

## Consequences (fall out of the above — not separately decided)

- **C1 — Two-tier outcome vocabulary for `/fight`.** (a) Didn't clear the gauntlet → today's
  gauntlet report. (b) Cleared but didn't crack top-N → "qualified, didn't place" + full arena
  telemetry (builds directly on the PR #250 parity work). (c) Entered top-N at rank k∈[2,N] →
  became a **defender**, displaced the old #N. (d) Ranked #1 → **crowned King**. **Any** top-N
  placement mutates the persistent arena, not just crowning.
- **C2 — Bootstrap (under-full arena): join if there's room.** While the arena has < N members, any
  gauntlet-clearer takes an open slot **regardless of its results** — even a bot that loses to every
  current defender joins (there's room). The present set is then ranked (win→net→seniority) and #1 is
  King; **relegation engages only once the arena is full**. Weak early defenders simply get relegated
  later when stronger bots arrive and force a full-arena ranking. The very first clearer joins an
  empty arena with zero fights and is King by default (the existing "throne-empty-crowned" bootstrap).
  Note: during bootstrap the win-count denominator is the **current occupancy**, not N — every present
  bot still plays every other, so the strict total order holds at every size.
- **C3 — Concurrency: one generation-guarded atomic commit per clearer.** The arena is a single
  atomically-swapped record with a **generation token** (generalizing today's throne CAS). Every
  gauntlet-clearing submission — **placer or non-placer alike** — runs: read arena @ gen G → fight the
  N snapshotted defender docs → rank → **commit iff the arena is still @G**. The commit is **one atomic
  unit**: `{swap the arena record if the bot placed}` **+** `{append its reproduction record + evict}`,
  landing together or not at all. If the arena moved since the read → `409 /problems/throne-moved`,
  **nothing is written**, and the caller resubmits against the now-current arena. A non-placer is
  gen-guarded too, so its "didn't place" verdict and its archived replay always reflect the exact arena
  it competed against — never a since-superseded one. (Contention cost: under heavy concurrent load any
  submission can 409-and-retry, as with today's single throne; acceptable for v1.)
- **C4 — Mirror within the arena → rejected as a no-op.** A submission byte-identical (existing
  `sameDoc` = `JSON.stringify` compare) to **any** current defender is **rejected before ranking** —
  no benchmark run, no arena CAS, no archive entry — with a clear response ("this exact bot already
  holds arena slot #k"). This keeps the arena a **set of distinct documents**, which in turn
  guarantees D2's win-count is always over a **uniform denominator N**: every bot in the N+1 set
  plays every other exactly once (no skipped self-pairing to normalize). A clone can never displace
  its original. (The old S4 title-fight mirror path — run-and-score-winRate-0 — is retired for the
  arena in favor of this cheaper upfront reject.)
- **C5 — `/king` + podium semantics change.** `recent()` shifts from "last N by crowning time" to
  "**top N by rank**"; the podium _is_ the ranked arena; `/king` current = arena[0]. `handle-king.ts`
  - the podium view need updating.
- **C6 — Store re-architecture (the biggest lift).** `throne-store.ts`'s single-champion append-only
  lineage becomes: a **top-N ranked arena record** + a **bounded reproduction archive (last K)**.
  `handle-fight.ts` crowning (one title fight + one CAS) becomes: run challenger vs N defenders →
  rank N+1 → arena mutation via CAS. The `ThroneStore` port grows (arena read/CAS + archive append/
  evict); the in-memory fake + Upstash adapter + shared contract all extend.
- **C7 — Response contract: an arena-placement report at gauntlet fidelity.** Every gauntlet-clearing
  submission — placer, King, OR non-placer — returns the same rich board, generalizing the PR #250
  title telemetry from one King to N defenders:
  - **outcome:** `crowned` (ranked #1) · `entered` (ranked #2..N) · `unplaced` (cleared but didn't
    crack top-N); plus the unchanged gauntlet-fail path (no arena block at all).
  - **rank:** final arena rank, or unplaced.
  - **board:** for each of the N defenders fought — its **identity** (name/model/handle, **never the
    doc**) + the challenger's result vs it at gauntlet fidelity (winRate / wins / losses / draws / net
    / endReasons / degrade), the same per-opponent shape a gauntlet row carries.
  - **displaced:** identity of the bot relegated by this placement, else null.
  - **Non-placers get the full board too** — the whole point of the parity ethos (PR #250): diagnose
    how to place next time without blindly regressing the 6/6 gauntlet clearance.
  - Nothing here exposes a defender's document; the ranked standings are already public via `/king` +
    podium (C5). Exact field names are finalized in the placement-telemetry slice.

---

## Clarifications (find-gaps)

- **Gauntlet re-run every submission; no clearance cache in v1.** Each submission re-runs the full
  frozen gauntlet (6 bots) **and** the arena (N) fresh. Determinism means a doc's gauntlet result never
  changes, so per-doc clearance caching is a pure optimization — deferred; add only if profiling demands.
- **Handles are non-unique; one author may hold multiple arena slots.** Nothing ties an arena slot to a
  unique handle — the same author can occupy several slots with **distinct** bots (each a different doc).
  A byte-identical resubmit is still rejected (C4); only genuinely different documents can co-occupy.

## Deferred / explicitly out of scope

- Exact **K** (retention count) and any **N** beyond the v1 default of 3 — tunable config, pick real
  numbers at planning/deploy time.
- The **`/replay` endpoint + Pixi viewer** — separate roadmap slices; this design only guarantees the
  raw material (docs + seeds) exists in the archive.
- **Edge cache** (persisting pairwise verdicts) — recompute is cheap enough for v1 (N=3 ⇒ ~60 bouts/
  submission of ~600-tick integer sim); add later only if profiling demands it.
- **Real seasons** (scheduled resets, enshrined final standings) — flavor, revisit post-v1.

---

## Non-negotiables held throughout

Determinism (integer-only outcome path, seeded PRNG), **TCB untouched** (this is all platform-layer
`src/http` — no DSL op, no engine change), bots-are-data, and **invariant #1** (no fight tapes stored
— only docs + seeds, fights reconstructed via `runFight`). The reproduction archive stores docs +
seeds, never tapes; replays are regenerated, and render behavior only (docs never exposed).

## Next step

Multi-PR feature → **story-splitting** (`story-splitting` skill) into child stories, then
**planning** (`planning` skill) per slice, then TDD (PR per slice). Natural slice seams visible
already: (1) arena data model + `ThroneStore` port extension (fake first); (2) `handle-fight`
arena ranking + crowning + CAS; (3) `/king` + podium → ranked arena; (4) reproduction archive
(last-K) + Upstash adapter; (5) response-contract / arena-placement telemetry. Sequence TBD at
story-splitting.

---

## find-gaps session log (2026-07-10)

Resolved (8):

- `[Blocker  → C4]` mirror-vs-defender submission → **reject as no-op** ⇒ uniform-N win-count denominator
- `[Blocker  → D6]` "exempt from pruning" → **pin current arena members' replay records** (un-pin on relegation)
- `[Blocker  → D2]` re-entry seniority → **fresh junior stamp**; strict total order via unique per-version counter; distinct from the C3 CAS token
- `[Blocker  → C2]` bootstrap → **join if there's room** (relegation only once full; occupancy denominator)
- `[Should   → C3]` concurrency → **one generation-guarded atomic commit per clearer** (placers + non-placers; 409 writes nothing)
- `[Should   → C7]` response contract → **arena-placement report at gauntlet fidelity** (full per-defender board for every clearer, incl. non-placers; docs never exposed)
- `[Nice     → Clarifications]` gauntlet + arena re-run every submission; **no clearance cache in v1**
- `[Nice     → Clarifications]` **handles non-unique**; one author may hold multiple slots (distinct docs)

Absorbed (2): total-order guarantee + win-count/net denominator uniformity — folded into the D2 and C4 write-backs.

Parked (0).
