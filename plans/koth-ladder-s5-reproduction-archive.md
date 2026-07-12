# Plan: KotH ladder — S5 (fights are reproducible — the last-K reproduction archive)

**Branch**: feat/reproduction-archive (S5.1) · feat/archive-eviction-pinning (S5.2)
**Status**: Active — **S5.1 ✅ code-complete (awaiting commit approval)**; S5.2 next.
**Feature**: the LAST KotH ladder slice. S1✅ · S2✅ · S3✅ · S4✅ → **S5** closes the ladder.

## Goal

Every gauntlet-clearing fight becomes replayable raw material: its **reproduction record**
(`{challenger doc, defender docs, seeds, version}`) is archived privately, atomically with the arena
commit, count-bounded to the newest **K** — with **current arena members' records pinned** so anything
_live_ is always replayable. No read surface ships here (that's the parked `/replay` + Pixi viewer);
this slice populates the archive and nothing breaks.

## Design source of truth

`plans/koth-ladder-decisions.md` — **D6** (last-K archive, count-bounded, pin current members, un-pin
on relegation; records are docs+seeds **never tapes**, invariant #1), **C3** (one generation-guarded
atomic commit unit: `{swap arena if placed}` **+** `{append repro record + evict}` — land together or
not at all; a **non-placer commits too**, gen-guarded, to archive its replay), **C6** (store
re-architecture: the port grows an archive append/evict + the fake **and** Upstash adapter **and**
shared contract all extend together). Story: `plans/koth-ladder-stories.md` **S5**.

## Scope / out of scope

- **In:** `ThroneStore` port extension (archive read + fold append/evict into the atomic commit); the
  in-memory fake, the Upstash adapter, **and** the shared `runThroneStoreContract` extended together
  (within-slice parity — never "fake now, durable later"); `handle-fight.ts` wired so **every** clearer
  (placer, King, non-placer) commits its reproduction record atomically against the arena it fought.
- **Out (parked / separate roadmap):** the `/replay` endpoint + Pixi viewer (the read/render surface —
  this slice only guarantees the docs+seeds exist); real seasons; edge/pairwise cache.
- **Invariants:** platform-layer (`src/http`) only; **no** DSL op, **no** engine change, **no**
  `INPUT_HASH` / `BENCHMARK_VERSION` bump; the archive stores **docs + seeds, never tapes** (invariant
  #1 — fights regenerate via `runFight`); records are private (docs never exposed — doc-privacy).

**Horizontal-slice note (justified exception):** S5 has **no user-visible HTTP surface** — its
observability is at the store-contract + `handle-fight`-wiring level (`readArchive` in the contract /
fake / adapter tests; wiring tests asserting a record is appended on commit and _not_ on a 409). This
is the one legitimate persistence-only slice: it is the **last** ladder piece and it unlocks the parked
`/replay` roadmap item. The design trail (D6, stories S5) already accepted this as shippable ("archive
populated; no read surface yet, nothing breaks").

## Acceptance Criteria

- [x] A gauntlet-clearer's commit appends a reproduction record `{challenger doc, defender docs, seeds,
version}` **atomically with the arena commit** — a **placer** (arena swaps + record appended) and a
      **non-placer** (arena unchanged + record appended) alike. _(S5.1)_
- [x] On a lost CAS race (`409 /problems/throne-moved`), **nothing** is written — no arena swap **and**
      no archived record. _(S5.1)_
- [x] A submission that **fails the gauntlet** (no title shot) archives **nothing**. _(S5.1)_
- [x] The record stores **documents + seeds, never a tape** (invariant #1); no read surface exposes any
      document (doc-privacy — enforced by there being no read surface in this slice). _(S5.1)_
- [ ] Beyond **K** records, appending one evicts the **oldest non-pinned** record. _(S5.2)_
- [ ] A record belonging to a **current arena member** (King + the N−1 defenders) is **pinned** — never
      evicted, however long that member reigns. _(S5.2)_
- [ ] When a member **relegates**, its record **un-pins** and becomes evictable like any other. _(S5.2)_
- [x] The in-memory **fake**, the **Upstash adapter**, and the shared **contract** all satisfy the above
      identically (store parity). _(S5.1 for append/read; S5.2 extends for eviction)_

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without a failing test.
**Recommended split: 2 PRs**, at the walking-skeleton → bounded boundary (mirrors S1→S2). See the
_Slice sizing_ note below — the user may collapse S5 into a single PR if preferred.

### Slice S5.1: Every clearing fight appends a reproduction record, atomically with the arena commit (unbounded)

**Value**: the future `/replay` consumer (and the platform) gets a persisted, gen-consistent record of
how each clearing fight went — the raw material replays are built from. Proves the atomic
`{arena swap if placed} + {append record}` unit end-to-end, with a **non-placer now committing too**.
**Path**: `POST /fight` clears the gauntlet → read arena @gen G → fight the N snapshotted defenders →
rank → **one gen-guarded commit** that swaps the arena (iff placed) **and** appends the reproduction
record → 409 iff arena moved (nothing written). Observability: `readArchive(version)` in the
fake/adapter/contract; `handle-fight` wiring tests asserting append-on-commit and no-append-on-409.
Intentionally skipped in this slice: eviction + pinning (unbounded here) → S5.2.
**Required implementation skills**: before code, load `tdd`, `testing`, `mutation-testing`,
`refactoring`.
**Proposed port shape** (subject to RED-driven discovery — _not_ a commitment to write ahead of a test):
`ReproRecord = { challenger: BotDoc; defenders: BotDoc[]; seeds: number[]; version: string;
memberSeniority: number | null }` (the placer's assigned seniority as its stable pin key; `null` for a
non-placer, which is never an arena member); `readArchive(version): Promise<ReproRecord[]>`; and
`commitArena` grows a `repro` argument so arena-swap-if-changed **+** append happen in one atomic step
(one Redis transaction in the adapter; one call in the fake). Non-placers now call `commitArena` with
`next === current arena` + their record.
**Acceptance criteria** (present & get human confirmation before code):

- Given a placing clear, when it commits, then `readArchive` returns its record with the challenger doc,
  the exact N defender docs it fought, the seeds, and the version — **and** the arena swapped, in one
  gen-guarded step.
- Given a **non-placing** clear (cleared gauntlet, ranked below top-N), then its record is appended and
  the arena is **unchanged** — same atomic commit path, gen-guarded.
- Given the arena moved since the read, then the commit reports `moved` (→ 409) and `readArchive` shows
  **no** new record (nothing written).
- Given a gauntlet **failure**, then no commit runs and the archive is untouched.
- Given the fake, the Upstash adapter, and `runThroneStoreContract`, then all encode these behaviors
  identically.
  **RED**: contract tests for append-on-commit / append-on-non-placer / no-append-on-moved; a fake test
  for `readArchive` ordering; `handle-fight` tests that a placing and a non-placing clear each archive the
  right record and a 409 archives nothing. Mutator watch: the placer-vs-non-placer branch (memberSeniority
  `null` vs value), the "nothing written on moved" guard (append must be _inside_ the gen-check, not
  before), array identity of `defenders`/`seeds`.
  **GREEN**: minimum — thread `repro` through `commitArena`, append inside the gen-guarded block, add
  `readArchive`; wire `handle-fight` to build & pass the record on every clear.
  **MUTATE**: `npx stryker run --incremental --force --mutate src/http/handle-fight.ts,src/http/throne-store.ts`.
  **KILL MUTANTS**: strengthen tests for survivors (ask when ambiguous). Contract + fake tests are
  Node-project (Stryker-reachable); the Upstash adapter's `fetch` transport stays contract-covered.
  **REFACTOR**: assess only if it adds value (e.g. a shared `evictable`/append helper is premature until
  S5.2 needs it).
  **Done when**: all S5.1 AC met, mutation report reviewed, human approves commit.

  **✅ S5.1 OUTCOME (code-complete):** RED landed as expected (5 archive contract cases + 14 adapter
  cases + 3 handle-fight wiring assertions failed first); GREEN made the whole suite pass. Port grew
  `ReproRecord` + `readArchive` + an optional `record` arg on `commitArena` (append INSIDE the
  gen-guard); the fake, the Upstash adapter (2-key EVAL: SET arena + guarded `RPUSH` record; `LRANGE`
  read), and `runThroneStoreContract` (inherited by the live smoke test — cleanup now DELs the
  `archive:` key too) all extended together. `handle-fight` builds the record via one `reproRecord`
  closure and commits it at all THREE sites — bootstrap (defenders `[]`, seniority 1), placement
  (defenders fought, its seniority), and the non-placer (which **now commits**, arena byte-identical,
  `memberSeniority` null; the S2.2 `commits 0→1` flip drove this). **MUTATE: 100% (223 killed / 0
  survived)** across `handle-fight.ts` + `throne-store.ts` + `throne-store-upstash.ts`. No refactor
  added value. Node suite 1387 pass, typecheck/lint/format clean, `npm run fight` deterministic
  (WINNER B 7-15 seed=1). Unbounded here — eviction + pinning are S5.2.

### Slice S5.2: The archive is bounded to the newest K, with current arena members' records pinned

**Value**: the archive stays production-bounded (won't grow forever) while **everything live is always
replayable** — you can always watch how the sitting King and each defender got in, no matter how long
they reign.
**Path**: the same atomic commit's append step now **evicts**: keep the newest **K** by insertion order
**plus** every record whose `memberSeniority` is in the just-committed arena (pinned); a relegated
member's seniority leaves the arena → its record un-pins → evictable on this or a later pass.
**Required implementation skills**: before code, load `tdd`, `testing`, `mutation-testing`,
`refactoring`.
**Acceptance criteria** (present & get human confirmation before code):

- Given more than **K** records, when one is appended, then the **oldest non-pinned** record is evicted
  and the count settles at K (+ pinned).
- Given a record belonging to a **current** arena member, then it is **never** evicted even past K
  (pinned by `memberSeniority` ∈ current arena).
- Given a member **relegates** (a stronger bot forces it out), then its record un-pins and becomes
  evictable like any other — verified by a subsequent append evicting it.
- Given **K** is config, then it is read from one place (env/const) and the fake + adapter + contract
  honor the same K.
- Given fake / adapter / contract, then eviction + pinning behave identically.
  **RED**: contract tests for evict-oldest-non-pinned, pin-survives-past-K, un-pin-on-relegation; a
  boundary test at exactly K vs K+1. Mutator watch: the `> K` vs `>= K` boundary, the pin predicate
  (`∈ current arena` — flipping it must fail a test), "oldest" ordering (evict newest would survive a weak
  test), un-pin-on-relegation (the pin set must be recomputed from the _committed_ arena, not the pre-fight
  one).
  **GREEN**: minimum — add the evict-to-(newest-K + pinned) step to the append; introduce `K` config.
  **MUTATE**: `npx stryker run --incremental --force --mutate src/http/throne-store.ts` (+ handle-fight if
  it changed).
  **KILL MUTANTS**: strengthen for survivors (boundary + pin-predicate are the high-value kills).
  **REFACTOR**: assess (a pure `evict(records, arena, K)` helper likely earns its place here — DRY of the
  pin+bound knowledge).
  **Done when**: all S5.2 AC met, mutation report reviewed, human approves commit — **closes S5 and the
  KotH ladder feature**.

## Slice sizing (a planning decision for the human)

The 2-PR split above is the recommendation (walking-skeleton → bounded, each independently mergeable and
green). **Alternative:** collapse S5 into a **single PR** — the atomic-append refactor and eviction land
together — since S5 is smaller than S2 and the store parity work is shared. Trade-off: one bigger,
coupled diff vs. two smaller reviewable ones with a clean intermediate (unbounded-but-correct) checkpoint.
Confirm which you want before RED.

## Pre-PR quality gate (each PR)

1. Mutation testing — `mutation-testing` skill, 100% on the changed `src/http` files.
2. Refactoring assessment — `refactoring` skill.
3. `npm run typecheck` + `npm run lint` + `npm run format:check` clean (format **only my own files** —
   leave the 4 pre-existing `web/` drift files alone).
4. Full node suite + a determinism spot-check (`npm run fight …` byte-identical) — TCB untouched.

---

_Archive this file under `docs/archive/` (+ a README entry) when S5 is complete — do not delete
(project convention). The design trail `plans/koth-ladder-{decisions,stories}.md` retires **with S5**
(the ladder's last slice); check whether it should be archived alongside this plan at close-out._
