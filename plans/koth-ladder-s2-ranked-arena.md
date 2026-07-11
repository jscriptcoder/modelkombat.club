# Plan: KotH ladder — S2 (the ranked arena becomes real, N=3)

**Branches**: `feat/arena-ranked-fill-n3` → `feat/arena-relegation` → `feat/arena-mirror-reentry`
**Status**: Active — decisions **confirmed 2026-07-11** (D-A frozen seeds · D-B C7 vocab · D-C/D-D/D-E as recommended). **S2.1 ✅ MERGED + LIVE** (PR #253, `feat/arena-ranked-fill-n3`; 1606 tests green; mutation **100%** on `rank-arena` / `arena-standings` / `handle-fight` / `throne-store`; `throne-store-upstash` 94.89% — 7 Lua-script `StringLiteral` survivors, the documented smoke-verified exception). **S2.2 ✅ MERGED + LIVE** (PR #254, `feat/arena-relegation`; 1613 tests green; mutation **100%** on `rank-arena` / `handle-fight` / `champion-identity`). **S2.3 ✅ CODE-COMPLETE** on `feat/arena-mirror-reentry` (mirror-reject C4 + re-entry D3; 1618 tests green; mutation **100%** on `handle-fight` — 110 killed; web mirror render manual-scanned). Ready for PR — this closes S2.
**Story**: S2 in `plans/koth-ladder-stories.md`. **Design source of truth**: `plans/koth-ladder-decisions.md` (D1–D7, C1–C7).
**Builds on**: S1 arena skeleton (`docs/archive/koth-ladder-s1-arena-skeleton.md`, PRs #251–#252).

## Goal

At **N=3**, a gauntlet-clearer competes against the current ranked arena and **crowns (#1)**, **enters as a
defender (#2–#3)**, or is **unplaced** — the arena keeps the top 3 by **win→net→seniority**, a full arena
**relegates its weakest**, and byte-identical clones / re-entries behave per C4 / D3. First user-visible
multi-champion behavior; deposed kings persist as reachable defenders.

## Non-negotiables (held throughout)

- **Platform-layer only** (`src/http` + its web consumer `web/`). No DSL op, no engine change — **TCB
  untouched** (invariant #2). No `INPUT_HASH` / `BENCHMARK_VERSION` bump.
- **Invariant #1**: no fight tapes stored (the reproduction archive is S5; not in S2).
- **Store parity is within-slice**: any store-touching change extends the in-memory fake **and** the Upstash
  adapter **and** the shared `runThroneStoreContract` **together** (the contract test enforces parity — no
  "in-memory now, durable later" split).
- **Determinism**: integer-only outcome path, seeded PRNG. See Decision **D-A** (arena seed strategy) below.

---

## Open decisions to confirm before S2.1 RED

These shape the acceptance criteria. **All confirmed 2026-07-11**: D-A → **frozen version seeds**; D-B →
**migrate to C7 vocab**; D-C / D-D / D-E → **as recommended**.

- **D-A — Arena round-robin seeds.** The ranking fights (challenger-vs-each-defender **and**
  defender-vs-defender) use the **frozen per-version seed set** (`deps.seeds`, the same seeds the gauntlet
  gate uses) — **not** fresh CSPRNG. **Why:** D1 requires a _deterministic tournament graph — each pair one
  permanent verdict_; stable seeds make every pairing's verdict a pure function of `(the two docs, version)`,
  so rankings can't flip-flop and an identical resubmission is idempotent. **Retires** `FightDeps.freshSeeds`
  from the arena path (it was the S1 one-shot title-fight mechanism). **Recommend: yes.**
- **D-B — Migrate the `/fight` outcome vocabulary to C7.** `title.outcome` becomes **`crowned`** (rank 1) ·
  **`entered`** (rank 2–N) · **`unplaced`** (cleared, no place); add **`rank`**. Drop the S1 strings
  `throne-empty-crowned` / `king-retained` (first-King vs dethrone is distinguished by **incumbent presence**,
  not a distinct string). `RingPage.tsx` migrates in-slice. **Recommend: yes** (additive-preserve is more code
  and a worse long-term contract).
- **D-C — Keep King-fight telemetry now; full per-defender board is S4.** The `title` block keeps the
  reigning-King fight's `winRate` / `bouts` / net (`toTitleFightReport`) + `incumbent`, so no telemetry
  regression and `RingPage`'s scout still renders. The **per-defender board over all N** (C7) is **S4**.
  **Recommend: yes.**
- **D-D — Full-arena behavior in S2.1 is a named placeholder.** While S2.1 is the live tip, a submission
  against an **already-full** arena returns **`unplaced`, arena unchanged** (relegation is S2.2). Brief
  "closed when full" window in prod, mitigated by shipping S2.1→S2.2 back-to-back. **Recommend: yes** (or
  hold S2.1 behind S2.2 if the intermediate is undesirable).
- **D-E — Lineage bridge becomes King-succession-aware.** `commitArena` appends to the crowning lineage
  **only when `arena[0]` (the King) actually changes**. **Why:** S1 appended `lineageEntryOf(next)` on _every_
  commit — safe at N=1 (every commit changed the King), but at N>1 a **non-crowning placement** (a challenger
  entering at #2, King unchanged) would **duplicate the sitting King** in `/king recent` (Hall of Kings). Lands
  in S2.1 (first slice where a non-crowning commit exists); behavior-identical at N=1. **Recommend: yes.**

---

## Acceptance Criteria (feature-level)

- [x] N is flipped to **3** for the live version; the arena holds up to 3 rank-ordered members, `[0]` = King. _(S2.1)_
- [x] A clearer against a **non-full** arena **always joins** (C2 join-if-room) — even losing every fight — and
      is ranked among the present set by win→net→seniority; `/fight` returns `crowned` (rank 1) or `entered`
      (rank 2–N) + `rank`. _(S2.1)_
- [x] A clearer against a **full** arena that out-ranks a defender **enters**, shifts the rest, and **relegates**
      the weakest (`displaced` identity); a clearer ranked below all three is **`unplaced`** (full-parity scout),
      arena unchanged. _(S2.2 — removed the D-D placeholder)_
- [x] Ties resolve **win → net → seniority** (longer-tenured / lower-seniority wins); the order is a strict
      total order (unique seniority) so ranking + the relegation choice are unambiguous. _(S2.1)_
- [x] A submission **byte-identical** to any current defender is **rejected as a no-op** before ranking (C4)
      — a `409 /problems/arena-mirror` naming the held slot, read before the gauntlet gate (no benchmark). _(S2.3)_
- [x] A **relegated** former champion re-submitted is **not** treated as a mirror (it left the arena) — it
      re-competes as a fresh entrant, drawing a **fresh junior seniority** (D3) like any newcomer. _(S2.3)_
- [x] `/king` + podium remain **King-only** via the (now succession-aware) lineage bridge — ranked-podium is S3. _(S2.1)_
- [x] The full `/fight` + `/king` + `throne-store` contract suites pass; `RingPage` renders every new outcome. _(S2.1)_
- [x] Concurrency preserved: a placement that loses the arena-generation CAS returns `409 /problems/throne-moved`
      and writes nothing. _(S2.1)_

---

## Slices

Every slice follows **RED → GREEN → MUTATE → KILL MUTANTS → REFACTOR**, PR per slice. Before code changes,
load `tdd`, `testing`, `mutation-testing`, `refactoring` (+ browser-mode testing for `RingPage`). Read
CLAUDE.md testing rules. Stryker is **node-only** — `RingPage` presentation logic is verified by exhaustive
exact-assertion browser-mode tests + a manual mutator scan (per house style).

### Slice S2.1: A clearer joins a non-full N=3 arena, ranked; loser-to-King now _enters at #2_

**Value**: Bot authors — the first multi-champion behavior. A challenger that loses to the King no longer
bounces off (S1 `king-retained`); with room in the arena it **enters as defender #2**, deposed kings become
reachable, and `/fight` reports `crowned`/`entered` + `rank`.
**Path**: `POST /fight` → gauntlet gate (unchanged) → `readArena` @ gen G → **round-robin** over
`{current members + challenger}` on the frozen version seeds (D-A) → pure `rankArena` (win→net→seniority total
order, keep all when ≤ N) → `commitArena` @G (King-succession-aware lineage, D-E) → response `{ outcome, rank,
title }` → `RingPage` headline. **Intentionally skipped**: full-arena relegation (→ D-D placeholder `unplaced`);
mirror-reject (S2.3); the per-defender board (S4); ranked podium (S3).
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`, browser-mode testing.
**Acceptance criteria** (confirm before code):

- Given arena `[King]` (room for 3) and a challenger that **loses** to the King, then it **enters at #2**
  (`outcome: "entered"`, `rank: 2`), the arena is `[King, challenger]`, and the King is unchanged.
- Given arena `[King]` and a challenger that **beats** the King (> 0.5), then it is **crowned** (`rank: 1`),
  arena `[challenger, King]`, old King now defender #2 (**not removed**).
- Given an arena of 2 and a challenger, then all **three** pairwise verdicts are computed (incl.
  defender-vs-defender) on the frozen seeds, and the three are ranked win→net→seniority; the challenger places
  at its true rank and **all three are kept**.
- Given a win+net tie between the challenger and a defender, then the **lower-seniority** (longer-tenured) bot
  ranks higher; an exact all-key tie is impossible (unique seniority).
- Given an **empty** arena, then the clearer is **crowned** rank 1 (bootstrap, zero fights) — the former
  `throne-empty-crowned`, now `outcome: "crowned"` distinguished from a dethrone by `incumbent === null`.
- Given a **non-crowning** placement (entered at #2, King unchanged), then `/king recent` does **not** duplicate
  the sitting King (D-E); given a crowning placement, then the new King **is** appended.
- Given the challenger's placement commit loses the arena CAS (arena moved since read), then
  `409 /problems/throne-moved`, nothing written.
- Given `RingPage`, then an `entered` result renders a distinct "you're a defender (rank k)" headline; `crowned`
  (first vs dethrone) and the King scout still render.
- Given the full `/fight` + `/king` + throne-store contract suites, then all pass (updated for the new vocab).
  **RED** (mutation-aware — boundaries, equality, ordering, off-by-one):
- `rank-arena.test.ts`: widen — challenger-loses-with-room → `entered` rank 2 (kills "always crown / always
  keep-first"); 3-way ordering by win, then net, then seniority (separate fixtures isolate each key — kills a
  dropped or reordered comparator); strict `> 0.5` win boundary (exact 0.5 = not a win); keep-**all** when
  entrants ≤ N (kills a premature cut).
- `handle-fight.test.ts`: loser-to-King → `entered` #2 + arena `[King, challenger]`; round-robin runs
  defender-vs-defender at arena=2; empty→`crowned` rank 1 w/ `incumbent: null`; non-crowning commit doesn't grow
  the lineage; CAS-race → 409.
- `throne-store.contract.ts`: `commitArena` with an **unchanged** `arena[0]` leaves `recent()`/lineage length
  unchanged; a **changed** `arena[0]` appends exactly one entry (fake + Upstash parity).
- `RingPage.test.tsx` (browser): exact headline for `entered` (rank shown); `crowned` first-King vs dethrone.
  **GREEN**: flip N=3 in the live manifest; `handle-fight` runs the round-robin (tally per-bot copeland-wins +
  net) and calls the widened pure `rankArena({ entrants, n })` → `{ members, outcome, rank, displaced }`; make
  `commitArena` append-iff-King-changed across fake + Upstash; migrate the response `title` vocab + `RingPage`.
  **MUTATE**: `stryker run --mutate` on `rank-arena.ts`, `handle-fight.ts`, `throne-store.ts`,
  `throne-store-upstash.ts`. Expect survivors on the comparator chain + the append-iff-changed guard.
  **KILL MUTANTS**: total-order fixtures per key; a "King changed but net equal" fixture for the append guard;
  seniority-tiebreak fixture. Ask the human if a survivor's value is ambiguous.
  **REFACTOR**: assess whether the round-robin tally deserves its own pure helper (extract only if it clarifies
  `handle-fight`, per the DRY-is-knowledge rule — not for testability alone).
  **Done when**: all ACs met, mutation report reviewed (100% on changed non-test files), typecheck + lint + format
  clean, human approves commit.

### Slice S2.2: A full arena relegates its weakest; below-all clearers are _unplaced_

**Value**: Bot authors + viewers — the ladder becomes a true top-3 with churn: a clearer that out-ranks a
defender **displaces** the weakest (relegated, evictable), and a clearer that can't crack the three learns it's
**`unplaced`**. Removes the S2.1 D-D placeholder.
**Path**: same flow; when `entrants` (N + challenger) **exceed N**, `rankArena` **cuts to top N** → the dropped
member relegates; response gains `unplaced` + `displaced` identity; `RingPage` renders `unplaced`.
**Intentionally skipped**: mirror-reject (S2.3); per-defender board (S4); ranked podium (S3).
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`, browser-mode testing.
**Decision (confirmed 2026-07-11) — `unplaced` payload = FULL PARITY.** Now that a full arena runs the
round-robin (the S2.1 no-fight short-circuit is gone), an `unplaced` challenger genuinely fought the #1 King,
so its response carries the same King-fight telemetry + `incumbent` scout as `entered` (in the JSON **and** the
`RingPage` scout card). Honors D-C's diagnose-don't-guess intent; a #4-miss reads the same King readout as a
#3-enter. `displaced` (the relegated defender) is surfaced identity-only in the JSON; the `RingPage` UI for it
is deferred (raw JSON only this slice).
**Acceptance criteria** (confirm before code):

- Given a **full** arena `[#1,#2,#3]` and a challenger that out-ranks #2 but not #1, then it **enters at #2**,
  the rest shift, the previous **#3 relegates**, `displaced` = #3's identity (name/model/handle, **never doc**).
- Given a full arena and a challenger ranked **below all three**, then `outcome: "unplaced"`, `rank` null,
  arena **unchanged**, nothing committed — but the response still carries the King-fight telemetry + `incumbent`
  scout (full parity).
- Given a full arena and a challenger that **crowns** (#1), then old #3 relegates and the new King is appended
  to the lineage (King changed).
- Given a relegated member, then it is **absent** from the committed arena (evictable — its pin, if any, is S5).
- Given `RingPage`, then an `unplaced` result renders a distinct "cleared but didn't place" headline (no throne
  link, no false crown) **and the King scout card** (full parity with `entered`).
  **RED**: `rank-arena.test.ts` — entrants = N+1 → keep top N, `displaced` = the (N+1)-th by the total order
  (kills "drop the challenger always" / "drop by wrong key"); challenger-is-the-dropped → `unplaced`, `displaced`
  null (it never joined). `handle-fight.test.ts` — full-arena enter-and-relegate commits the shifted arena +
  returns `displaced`; below-all → `unplaced` + **no** `commitArena` call (assert the store is untouched).
  `RingPage.test.tsx` — exact `unplaced` headline.
  **GREEN**: `rankArena` cuts to `n` and reports the displaced member; `handle-fight` surfaces `displaced` +
  skips the commit when `unplaced`.
  **MUTATE / KILL**: `rank-arena.ts`, `handle-fight.ts`. Survivors likely on the cut boundary (`length > n`
  vs `>= n`) and the displaced-selection index — add exact fixtures.
  **REFACTOR**: assess.
  **Done when**: all ACs met, mutation 100% on changed non-test files, static analysis clean, human approves.

### Slice S2.3: A cloned or returning bot behaves — mirror-reject (C4) + re-entry (D3)

**Value**: Bot authors — the arena stays a **set of distinct documents**: a byte-identical resubmit of a
current defender is rejected cheaply (a clone can never displace its original), and a **relegated** veteran can
re-challenge, entering with a **fresh junior** seniority.
**Path**: before the round-robin, compare the submitted doc (`sameDoc` = `JSON.stringify`) to **each** current
defender → on a match, **reject** (no benchmark, no CAS, no response mutation) with a clear message naming the
held slot. Re-entry (D3) is largely a **characterization** of existing seniority behavior: a relegated bot's
stamp was forgotten, so a re-submission draws `nextSeniority` like any newcomer.
**Intentionally skipped**: per-defender board (S4); ranked podium (S3); the reproduction archive (S5).
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`, browser-mode testing.
**Acceptance criteria** (confirm before code):

- Given a submission byte-identical to a current defender at slot #k, then it is **rejected before ranking**
  (no arena mutation, no lineage append), with a response naming slot #k; assert the store's `commitArena` is
  never called.
- Given a submission that differs from every defender (even by one byte), then it proceeds to the round-robin
  normally (a near-clone is **not** rejected).
- Given a relegated former champion re-submitted, then it re-enters (if it now out-ranks) with a **fresh
  junior** seniority (> every incumbent's stamp) and loses win+net ties to continuously-tenured defenders (D3).
- Given the same author submitting **two distinct** bots, then **both** may occupy arena slots (handles are
  non-unique) — only byte-identical docs are rejected.
- Given `RingPage`, then a mirror-reject renders a clear "this exact bot already holds slot #k" message.
  **RED**: `handle-fight.test.ts` — exact-clone-of-defender → reject, `commitArena` never called, `benchmark`
  not run for the arena; one-byte-different → proceeds; two-distinct-bots-same-handle → both placeable. A D3
  re-entry fixture: relegate a bot, re-submit, assert its committed seniority is the fresh `nextSeniority` (kills
  "reuse old stamp"). `RingPage.test.tsx` — exact mirror-reject headline.
  **GREEN**: upfront `sameDoc`-vs-each-defender guard in `handle-fight`; confirm the seniority path already
  satisfies D3 (add code only if a test demands it).
  **MUTATE / KILL**: `handle-fight.ts`. Survivors likely on the mirror-match `some`/equality and the
  "before ranking" ordering — add fixtures (clone must short-circuit _before_ any benchmark).
  **REFACTOR**: assess (e.g. is the C4 old S4 title-fight mirror path — run-and-score-winRate-0 — now dead and
  removable? Retire it per the decisions doc if so).
  **Done when**: all ACs met, mutation 100% on changed non-test files, static analysis clean, human approves.

---

## Sequencing & dependencies

`S2.1 → S2.2 → S2.3` (each a PR). S2.1 carries the bulk (round-robin + total-order ranking + N=3 + the
succession-aware lineage + the response/RingPage migration). S2.2 is the top-N cut + `unplaced`/`displaced`.
S2.3 is the upfront mirror guard + re-entry characterization. **Fallback if S2.1 is too big at implementation
time**: peel the **D-E succession-aware lineage bridge** off as its own thin behavior-preserving PR first (it's
identical at N=1, like the S1 slices), then land the ranking in S2.1.

After S2 the arena is real; **S3** (ranked podium + `/king`), **S4** (per-defender placement telemetry), and
**S5** (last-K reproduction archive) are independent and reprioritizable.

## Pre-PR Quality Gate (each slice)

1. Mutation testing — `mutation-testing` skill; 100% on changed non-test files (`rank-arena.ts`,
   `handle-fight.ts`, `throne-store.ts`, `throne-store-upstash.ts` as touched) + manual mutator scan on
   `RingPage` (Stryker is node-only).
2. Refactoring assessment — `refactoring` skill.
3. `npm run typecheck` + `npm run lint` + `npm run format:check` clean.
4. Full suite green (`npm test`); env-gated Upstash smoke unaffected.

---

_Archive under `docs/archive/` when complete (per repo convention — do not delete). Update `docs/STATUS.md`
and the KotH memory when the feature lands._
