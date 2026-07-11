# Plan: KotH ladder — S1 arena skeleton (N=1, behavior-preserving)

**Branch**: per-slice (see each slice) — `feat/arena-store-record`, then `feat/arena-crown-n1`
**Status**: ✅ **COMPLETE & ARCHIVED** — both slices merged (PR #251, PR #252), 2026-07-11.
Plan approved 2026-07-10 (defer all `/king`/podium edits to S3).
**Refinement (2026-07-11):** the old single-throne crown path (`compareAndSwap`, `CROWN_SCRIPT`,
`buildCrownRequest`, `interpretCrownReply`) is **retired in S3** with the lineage, not in Slice 2 —
handle-fight simply stops using it, avoiding double-churning `handle-king`'s tests.
**Story source**: `plans/koth-ladder-stories.md` (S1). Decisions: `plans/koth-ladder-decisions.md` (D1–D7, C1–C7).

## Goal

Re-architect the single-champion throne into a top-N **ranked arena record** with a
generation-guarded atomic commit and a per-version seniority counter, **configured at N=1 so every
observable `/fight` and `/king` behavior is byte-for-byte identical to today**. This is the C6
risk burn-down in isolation; the existing `/fight` + `/king` + throne-store-contract suites are the
characterization harness.

## Scope note — this is an explicit architecture/validation slice

S1 ships **no new user-visible behavior**. Its value is burning down the stateful store re-arch (C6)
behind the full existing test suite, on the real production path (`submit → rank → arena CAS → /king`),
as the permanent foundation for S2–S5. This is the story doc's stated framing, not a horizontal
layer-cake: each slice below still runs end-to-end through the real store + handler.

## The design bridge (why the lineage survives S1)

Today the append-only lineage serves **two** jobs: (a) the **reigning champion** (`.at(-1)`, drives
`/fight` crowning + `/king current`), and (b) the **crowning history** (drives `/king recent`, the
podium). S1 re-architects job (a) into the arena record; job (b) — the podium — is **deferred to S3**
(C5). So S1 keeps the append-only lineage as a bridge and makes the arena's atomic commit **also
append the entering champion to the lineage**. Consequences, all behavior-preserving at N=1:

- `arena[0]` (sole member) == lineage tail == today's reigning champion.
- `/king current` (`read()`) and `/king recent` (`recent()`) stay lineage-backed → **`handle-king.ts`,
  `web/src/King.tsx`, `web/src/Podium.tsx` are untouched in S1**; the "Gen N" display is preserved
  because the appended lineage entry keeps its `generation` field.
- The lineage is retired in **S3** when the podium moves to the ranked arena.

## Plan refinements (APPROVED 2026-07-10 — depart from the literal S1 story-doc scope)

1. ✅ **Defer _all_ `handle-king`/podium edits to S3.** The story doc lists "`/king` reads arena[0]" under
   S1. At N=1 `arena[0] == read()`, so repointing `/king current` at the arena is a **zero-behavior
   churn** that would be rewritten again in S3 (when `recent` moves to the arena too). `handle-king` is
   left entirely untouched in S1 (kept correct by the commit's lineage append), so "existing `/king`
   suite passes unchanged" is _literally_ true.
2. ✅ **Keep the append-only lineage through S1, retire it in S3.** Per the bridge above.

Everything else follows the locked decisions unchanged.

## Acceptance Criteria (S1 as a whole)

- [ ] The `ThroneStore` port persists and atomically CAS-commits a top-N arena record (N-agnostic
      type, exercised at N=1), proven **identically** across the in-memory fake and Upstash via the
      shared `runThroneStoreContract`.
- [ ] `POST /fight` decides crowning by reading the arena, ranking the challenger against the arena's
      defenders (≤1 at N=1), keeping the top N, and committing via the arena-generation CAS — with
      **byte-identical** responses to today for: empty-throne bootstrap, `winRate > 0.5` dethrone,
      `≤ 0.5`/loss retain, exact-`0.5` boundary, mirror-clone-can't-dethrone, and `409` concurrent crown.
- [ ] Each arena entry is stamped with the next value of a strictly-increasing per-version seniority
      counter (introduced now; no tie to break at N=1, contract-asserted to increment).
- [ ] `GET /king` (current + recent), the `api/*` wrappers, and the web podium behave exactly as
      before (no code change to `handle-king.ts` or `web/src/*`).
- [ ] TCB untouched — no `src/engine` change, no DSL op; all changes are in `src/http`.

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without a failing test.
Read `.claude/CLAUDE.md` + the `testing`/`mutation-testing` rules before writing any slice.

### Slice 1 ✅ COMPLETE (PR #251, merged 2026-07-10): The store persists an atomically-CAS'd top-N arena record (fake + Upstash + contract), at N=1

Shipped: `readArena`/`commitArena` on the port (fake + Upstash + shared contract), 100% mutation,
byte-identical `/fight`+`/king`. `commitArena` atomically swaps the arena AND appends arena #1 to the
lineage via the shared `lineageEntryOf`.

**Branch**: `feat/arena-store-record`
**Value**: Architecture/validation — proves the arena data model + generation-guarded atomic commit
end-to-end across **both** adapters, with **zero observable behavior change** (no consumer wired yet).
Burns down the C6 stateful re-arch in isolation.
**Path**: `runThroneStoreContract` → `readArena`/`commitArena` → in-memory fake **and** Upstash Lua →
observable via the contract suite (fake in `throne-store.test.ts`, live Redis in the env-gated
`throne-store-upstash.smoke.test.ts`). No `/fight` or `/king` path touched.
**Required implementation skills**: Before code, load `tdd`, `testing`, `mutation-testing`,
`refactoring` (+ `folder-structure` if introducing a new module).
**Scope**:

- New types: `ArenaMember = { champion: BotDoc; handle: string | null; seniority: number }`;
  `ArenaRecord = { members: ArenaMember[]; generation: number; nextSeniority: number }`
  (`members.length ≤ N`; `readArena` returns `undefined` for an empty version, mirroring `read()`).
- Port grows: `readArena(version): Promise<ArenaRecord | undefined>` and
  `commitArena(version, expected: number | null, next: ArenaRecord): Promise<CasResult>` — where the
  commit is **one atomic unit**: gen-guarded swap of the arena record **+** append of the entering
  champion (`{champion, generation: next.generation, handle}`) to the crowning lineage that `recent()`
  reads. (Reuse the existing `CasResult`/`{ok:false,reason:"moved"}` shape and `number|null` token.)
- Fake: extend `inMemoryThroneStore` — a per-version arena slot alongside the existing lineage `Map`;
  `commitArena` guards on the arena generation and appends to the same lineage list.
- Upstash: new `arena:${version}` key; a new/extended Lua `EVAL` (template = `CROWN_SCRIPT`) that in one
  script guards `arena.generation`, `SET`s the arena key, and `RPUSH`es the lineage — so it can't tear.
- Contract: extend `runThroneStoreContract` with arena cases (see RED). Existing `compareAndSwap` cases
  stay green (that method is untouched this slice).
  **Acceptance criteria** (present + confirm before code):
- `readArena` returns `undefined` on an untouched version; after a `commitArena`, returns the committed
  arena and the entering champion also appears via `recent()`.
- `commitArena` with a matching generation lands and bumps generation; with a **stale** generation is
  rejected `{ok:false,reason:"moved"}` and writes **nothing** (arena unchanged **and** lineage not
  appended).
- The seniority counter (`nextSeniority`) increments by exactly 1 per entry and stamps each member;
  versions stay isolated (a commit under `versionA` leaves `versionB` empty).
- Fake and live-Upstash runs of the extended contract are identical.
  **RED**: Add arena `it()`s to `throne-store.contract.ts` (run via the fake in `throne-store.test.ts`).
  Likely mutants to pre-empt (from `mutator-rules.md`): the gen-guard comparison
  (`expected === current` → negation/`!=`/always-true), the `nextSeniority`/`generation` `+1`
  (off-by-one, `+`→`-`), the empty→`undefined` boundary, and the `members.slice(0, N)` bound. Include a
  two-commit test (seniority 1 then 2) to kill the `+1` mutant, and a stale-gen test asserting the
  lineage did **not** grow to kill "commit anyway" mutants.
  **GREEN**: Minimal arena slot in the fake + one Upstash Lua; wire the port type. No consumer changes.
  **MUTATE**: Run Stryker on the new fake arena code + the request/reply builders for the Upstash script
  (`throne-store-upstash.test.ts` covers the builders over a `fetch` double, node-only).
  **KILL MUTANTS**: Strengthen contract/builder tests for survivors (ask if a survivor's value is
  ambiguous — e.g. an unobservable internal ordering).
  **REFACTOR**: Assess deduping the two Lua scripts / shared record (de)serialization only if it adds value.
  **Done when**: Extended contract green vs fake **and** live Upstash; existing suites unchanged;
  mutation report reviewed; you approve commit.

### Slice 2 ✅ GREEN (awaiting commit/PR): `POST /fight` decides crowning through the arena record at N=1 (behavior-identical)

Shipped: pure `rank-arena.ts` (N=1) + `handle-fight` reworked to `readArena` → `rankArena` →
`commitArena`; incumbent scouts arena #1 via `incumbentOf(lineageEntryOf(arena))`; the local `crown`
helper became `commit`. 100% mutation on both files (killed a `nextSeniority + 1` survivor with a
post-dethrone arena-state assertion). `handle-fight.test.ts` harness rewired to the arena (`enthrone`
→ `commitArena`, the two 409 tests model an arena race); `handle-king` + `api/*` + web untouched.
**Refinement:** `compareAndSwap` and the crown-path Upstash helpers are **kept** (prod-unused now,
retired in S3 with the lineage) — handle-fight just stopped calling them; only the local `crown`
helper was removed.

**Branch**: `feat/arena-crown-n1`
**Value**: Architecture/validation — the real production crown path now flows submit → read arena →
rank (N=1) → arena CAS, with **byte-identical** `/fight` responses. Establishes the pure ranking seam
that S2 widens to N=3.
**Path**: `POST /fight` → `handleFight` → `deps.store.readArena` → pure `rankArena(...)` → `commitArena`
(atomic arena swap + lineage append) → response. `handle-king` + web untouched (kept correct by the
lineage append).
**Required implementation skills**: Before code, load `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Scope**:

- New pure module `src/http/rank-arena.ts` (sibling of `fight-report.ts`): `rankArena(members, challenger,
challengerResults, N)` → `{ members: ArenaMember[]; placed: boolean; rank: number | null }`. At N=1:
  empty arena → `[challenger]` placed rank 1; occupied → `winRate > 0.5` ⇒ `[challenger]` (old member
  removed, N=1 full) placed rank 1, else `[oldMember]` unplaced. Unit-tested independent of the store.
- Rework `handle-fight.ts`: replace `read` + `crown(compareAndSwap)` with `readArena` → stamp challenger
  as an `ArenaMember` (next `seniority`) → `rankArena` → `commitArena(expected = arena?.generation ?? null,
nextArena)`; keep the `crown()`-style 409 mapping (`{ok:false}` → `problem(409,"/problems/throne-moved")`).
  Bootstrap (empty arena) crowns at generation 1, exactly as today's `throne-empty-crowned`.
- Delete the now-dead `compareAndSwap` + its contract cases (superseded by the Slice-1 arena cases).
  Keep `read` + `recent` (still used by the untouched `handle-king`).
- Mirror-clone behavior stays as today (filtered inside `benchmark` → winRate 0 → not `> 0.5` → retain);
  C4 mirror-**reject** is S2, not S1.
  **Acceptance criteria** (present + confirm before code):
- Every existing `handle-fight.test.ts` case passes **unchanged**: bootstrap crown; `> 0.5` dethrone;
  `≤ 0.5` and loss retain; exact-`0.5` boundary retains; mirror-clone can't dethrone; `409` on
  concurrent crown (both bootstrap and dethrone sites); `incumbent` identity + `X-Author-Handle`
  validation; title-telemetry parity (PR #250) intact.
- `api/fight.test.ts`, `handle-king.test.ts`, `api/king.test.ts` pass unchanged; web podium unchanged.
- The persisted arena stamps the crowned bot with seniority (1 on first crown, 2 on the next), and the
  lineage still reflects each crown so `/king` is byte-identical.
  **RED**: Unit tests for `rankArena` (empty→crown, `>0.5`→replace, `=0.5`→retain, loss→retain), each
  asserting the returned member list, `placed`, and `rank`. Likely mutants: the `winRate > 0.5` boundary
  (`>=`/`>`; the exact-`0.5` case kills it), the empty-arena branch, `rank` literal (`1`→`0`/off-by-one),
  `placed` boolean flip, `members.slice(0, N)` bound. Then assert the existing `handle-fight`/`handle-king`
  suites are green against the arena-backed store (characterization).
  **GREEN**: Implement `rankArena`; rewire `handle-fight` to it + `readArena`/`commitArena`.
  **MUTATE**: Stryker on `rank-arena.ts` + the reworked `handle-fight` decision region.
  **KILL MUTANTS**: Strengthen `rankArena` unit tests / add `handle-fight` assertions for survivors. Follow
  the PR #250 lesson — extract-to-pure (`rankArena`) so arithmetic/boundary mutants unreachable through a
  real fight are killed by synthetic unit fixtures.
  **REFACTOR**: Assess collapsing the redundant reigning read (arena[0] vs lineage tail) — but only in S3,
  not here; note it and move on.
  **Done when**: All observable suites green **unchanged**; `rankArena` at 100% mutation; report reviewed;
  you approve commit.

## Pre-PR Quality Gate (each slice)

1. Mutation testing — run `mutation-testing` (node-only Stryker; web presentation logic N/A here).
2. Refactoring assessment — run `refactoring`.
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass.
4. Confirm no `src/engine` / DSL / TCB change; `INPUT_HASH` + `BENCHMARK_VERSION` untouched.

## Out of scope (later S-slices, do not creep in)

- N > 1, real ranking texture, relegation-when-full, C4 mirror-**reject** → **S2**.
- `/king` + podium show the ranked arena (retire the lineage) → **S3**.
- Full per-defender placement telemetry board → **S4**.
- Last-K reproduction archive → **S5**.

---

_Delete this file when S1 is complete (or fold remaining S-slices into their own plans). If `plans/` is empty, delete the directory._
