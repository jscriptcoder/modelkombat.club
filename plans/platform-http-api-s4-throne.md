# Plan: Platform HTTP API — S4, the version-scoped KotH throne

**Branch**: `feat/platform-api-s4-*` (one branch/PR per slice)
**Status**: Active

## Goal

A challenger who clears the frozen gauntlet earns a **title shot**; winning `> 50%` of a
fresh-seeded title fight against the reigning champion **crowns** them King (else the King
retains). The throne is **version-scoped**, **atomically** updated (CAS), and keeps a **full
champion lineage** per version — the first _stateful_ platform piece, and the competitive apex
of the LLM bot-authoring loop.

## Resolved design inputs (grill-me, this session)

Locked before planning; these are the acceptance-shaping constraints (source:
`plans/platform-http-api-decisions.md`, decisions 1–10 + eng-reqs, plus this session's grill-me):

- **Retention — full champion lineage per version** (append-only): every crowning is kept, not
  just the final one (_upgrades decision 8's "final champion" → "full lineage"_). Non-champion
  fights are **not** stored server-side; a broader "fight archive" is a deferred story with its
  own retention bound. Old-version keys are retained (hall of fame for free — each version owns
  its own key).
- **Fights are reconstructed, never stored as tapes.** A replay is `runFight(botA, botB, seed,
version)` re-executed (invariant #1). Keeping champion docs + title seeds makes every title fight
  _and_ every champion's qualifying gauntlet run replayable (gauntlet seeds are fixed/disclosed).
- **Store shapes** — `throne:<version>` = `{ champion: BotDoc, generation }` (the CAS pointer);
  `champions:<version>` = append-only lineage list. Version = `BENCHMARK_VERSION` (e.g. `v19`).
- **CAS token** — opaque monotonic `generation`. `compareAndSwap(version, expected, next)`; on a
  generation mismatch → `409 /problems/throne-moved` (caller resubmits, fights the new king). No
  server-side auto-retry in v1.
- **Store tech — Upstash Redis** (Vercel Marketplace), REST via `fetch` (SDK optional). One atomic
  Lua `EVAL` does compare-generation + set-pointer + append-lineage together (no torn writes).
  Behind a thin **`ThroneStore` adapter**; an **in-memory fake** is the test/local default (used
  when `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are unset).
- **Title fight** — `crypto.getRandomValues(new Uint32Array(10))` → **10 fresh CSPRNG seeds → 20
  bouts** (mirrors the gauntlet's `1..10 × both sides`), reusing `benchmark({ bot: challenger,
gauntlet: [champion], seeds: fresh, maxTicks: MAX_TICKS, rules: CANONICAL_RULES, match: MATCH })`.
  Dethrone iff `perOpponent[0].winRate > 0.5` (King retains on `≤ 0.5`). Fresh seeds are API-layer
  entropy _outside_ the pure sim — invariant #1 intact; the sim stays seeded-`mulberry32`-only, and
  the chosen seeds are recorded (returned + persisted) so the fight replays byte-identically.
- **Mirror-at-title** — a challenger byte-identical to the champion is `sameDoc`-skipped by
  `benchmark` → empty → `winRate 0` → King retains. Cloning the King can't dethrone (falls out for
  free; resubmitting the reigning champion → `king-retained`, no lineage spam).
- **Identity & visibility** — the incumbent's `name` / `model` / `handle` (**never** the document)
  surfaces only in the `/fight` `title` block, after you clear and take the title shot (earn your
  scouting). No dedicated throne-read endpoint in v1.
- **Author handle** — optional `X-Author-Handle` **header** (read by `/fight` only, ≤ 64 chars,
  opaque/unverified), persisted into crowning metadata. `model` (in the doc, provenance) vs `handle`
  (header, submitter) kept distinct.
- **Response contract** — the `title` block is present **only when `cleared`**; `outcome ∈
{ crowned, king-retained, throne-empty-crowned }`; carries `winRate`, the fresh `seeds`
  (post-hoc), and the incumbent identity — never the incumbent doc. Cleared responses still carry
  the full S3 gauntlet report _plus_ the `title` block.

## Non-negotiables preserved

- **TCB / invariant #2 untouched.** S4 is transport + orchestration + a new platform-layer store
  adapter. The only engine reuse is `benchmark` / `runFight` (unchanged). **No DSL op.**
- **Determinism / invariant #1.** Fresh seeds come from Web Crypto at the transport layer and are
  recorded; the sim itself uses only the seeded PRNG.
- **`INPUT_HASH` / `BENCHMARK_VERSION` unchanged.** The `title` block is a _response_ field, not a
  scoring input. The throne is keyed _by_ the version; it does not change it.
- **Engine "no runtime deps".** Governs `src/engine`. The Upstash adapter lives in the platform
  layer (`src/http` / `api`) and can be called with raw `fetch` (no SDK dep required).

## Acceptance Criteria

- [x] An empty (version-scoped) throne crowns the first gauntlet-clearer; `/fight` returns
      `title.outcome: "throne-empty-crowned"` and the champion is persisted (`generation 1` + one
      lineage entry). _(Slice 1 — PR #184)_
- [ ] A clearer against an occupied throne runs a 20-bout fresh-seeded title fight and is
      `crowned` on `winRate > 0.5`, else the King is `king-retained`; the fresh seeds are returned.
- [ ] A challenger byte-identical to the champion → `king-retained` (cloning can't dethrone), no
      new lineage entry.
- [ ] Two near-simultaneous crownings serialize: exactly one is `crowned`, the other gets
      `409 /problems/throne-moved`; the throne ends holding the winner.
- [ ] Every crowning appends an immutable lineage entry (champion doc + title seeds + metadata),
      preserving the full per-version champion history.
- [ ] The `title` block shows the incumbent's `name` / `model` / `handle` and **never** the
      incumbent's bot document (no `"rules"` leak — visibility principle).
- [ ] A crowned bot's `X-Author-Handle` (≤ 64) and `model` are persisted and surfaced as the
      incumbent identity to the next challenger.
- [x] A non-clearing bot never receives a `title` block and never touches the throne (S3 behaviour
      preserved). _(Slice 1 — PR #184)_
- [ ] In production the throne persists across cold starts / instances on real Upstash Redis; a
      post-deploy smoke test crowns and reads back a throwaway champion.

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without a failing
test. Before code changes for a slice, load `tdd`, `testing`, `mutation-testing`, `refactoring`.
Tests follow the eng-reqs strategy: handler logic is TDD'd as a **pure function** — construct a
`Request`, inject a **fresh in-memory fake `ThroneStore`** (+ a fixed seed source), assert the
`Response`; no running server or live Redis.

### Slice 1: An empty throne crowns the first gauntlet-clearer (the stateful walking skeleton)

**Status**: ✅ COMPLETE (PR #184, merged `main`@`52b0b5b`). Shipped the `ThroneStore` port + in-memory
fake (`src/http/throne-store.ts`), the injectable `handleFight` seam (`src/http/handle-fight.ts`),
`api/fight.ts` rewired to a thin prod wire, and the empty-throne bootstrap crown. 100% mutation on both
new source files; all S3 `/fight` tests green; TCB / `INPUT_HASH` / `BENCHMARK_VERSION` untouched.

**Value**: Challenger — the first bot to clear the gauntlet on an empty, version-scoped throne is
crowned and recorded. Proves the whole stateful path (read → gate → CAS-crown → persist → response).
**Path**: `POST /fight` → `readValidatedBot` → `benchmark(gauntlet)` → `cleared?` → `store.read(version)`
returns empty → `store.compareAndSwap(version, expected=absent, next={champion, generation:1})` writing
the pointer **and** the first lineage entry → response gains `title: { outcome: "throne-empty-crowned" }`.
Introduces the **dependency seam**: extract `handleFight(req, deps)` into `src/http/`, define the
`ThroneStore` port (`read`, `compareAndSwap`) + in-memory fake in `src/http/`, and rewire
`api/fight.ts` as a thin default export supplying prod deps (fake store when Upstash env is unset).
_Intentionally skipped this slice:_ occupied-throne title fight (→ S2), CAS races/409 (→ S3), identity
display + handle (→ S4), real Upstash (→ S5). An occupied throne + cleared bot returns the S3 report
with **no** `title` block until S2.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (present + confirm before code): (a) cleared bot + empty throne → 200 with
`title.outcome === "throne-empty-crowned"`; the injected fake now returns the champion at
`generation 1` with exactly one lineage entry; (b) a **non-clearing** bot + empty throne → **no**
`title` property, throne stays empty; (c) the crown is written to the **current** `BENCHMARK_VERSION`
key only (a champion pre-seeded under a _different_ version key does not satisfy this version's empty
check — version isolation); (d) all existing S3 `/fight` tests still pass unchanged.
**RED**: inject a fresh fake `ThroneStore` into `handleFight`; assert the three behaviours above.
Mutator-aware gaps: the `cleared && throneEmpty` gate (boolean/boundary), the `generation` seed value
`1` (not `0`), the `"throne-empty-crowned"` string literal, the "no title when not cleared" branch.
**GREEN**: the `ThroneStore` port + fake, the `handleFight` seam, and the `cleared → empty → crown`
branch. Minimum to pass.
**MUTATE / KILL MUTANTS**: focus the gate boolean, the generation literal, the outcome literal, the
not-cleared branch.
**REFACTOR**: assess `handleFight` cohesion; keep `api/fight.ts` a thin wire.
**Done when**: all criteria met, S3 tests green, mutation report reviewed, human approves commit.

### Slice 2: A clearer fights the reigning King and dethrones on >50% (else the King retains)

**Value**: Challenger — clearing an **occupied** throne triggers a 20-bout fresh-seeded title fight;
`> 0.5` dethrones and crowns, `≤ 0.5` retains the King.
**Path**: `cleared?` → `store.read(version)` returns an incumbent → `freshSeeds()` (Web Crypto, 10) →
`benchmark({ bot: challenger, gauntlet: [champion], seeds: fresh, maxTicks, rules, match })` →
`perOpponent[0].winRate > 0.5 ?` `compareAndSwap` crown (append lineage) : no write → `title:
{ outcome: "crowned" | "king-retained", winRate, seeds }`. Introduces the **seed-source dep**
(`freshSeeds: () => number[]`; prod = Web Crypto uint32×10; tests inject fixed seeds).
_Skipped this slice:_ CAS race/409 (→ S3), identity/handle fields (→ S4).
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria**: with a fake store pre-seeded with a known champion + injected fixed seeds
(so `benchmark` is deterministic): (a) a challenger that beats the champion `> 0.5` → `title.outcome
=== "crowned"`, throne now holds the challenger at `generation + 1`, lineage appended; (b) a
challenger that scores `≤ 0.5` → `title.outcome === "king-retained"`, throne unchanged, no lineage
append; (c) a challenger **byte-identical** to the champion → `king-retained` (mirror skip → empty →
`winRate 0`); (d) `title.seeds` echoes the fresh seeds used; (e) title fight runs exactly `10 × 2 =
20` bouts. Use real bot docs with a known dominance relationship as fixtures (e.g. a strong clearer
vs a weak champion).
**RED**: assert crowned / retained / mirror / seeds-echoed / bout-count. Mutator-aware gaps: the
strict `> 0.5` boundary (a `≥` mutant must fail — include a controlled `= 0.5` case), the winner
selection, `generation + 1` (not `+0`/`+2`), the seed count `10`, "crown writes lineage only on win".
**GREEN**: the occupied-throne title-fight branch + seed source. Minimum to pass.
**MUTATE / KILL MUTANTS**: the `> 0.5` boundary, the outcome literals, the generation increment.
**REFACTOR**: assess extracting the title-outcome derivation as a pure helper (like `buildFightReport`).
**Done when**: criteria met, mutation report reviewed, human approves commit.

### Slice 3: Concurrent dethrones serialize — one crowns, the other gets 409

**Value**: Challenger / operator — the throne can't be double-crowned; a crowning racing against a
crowning that already landed is rejected with `409 /problems/throne-moved` (throne correctness).
**Path**: `read {champion, generation}` → title fight → `compareAndSwap(version, expected=generation,
next=@generation+1)`; if the stored generation moved since the read, CAS returns "moved" → the handler
returns `409 /problems/throne-moved` (RFC 9457, via the shared `problem` envelope).
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria**: (a) when a concurrent crown lands between this request's read and its CAS
(simulated by bumping the fake store's generation before the swap), the losing request → **409** with
`type === "/problems/throne-moved"`, and the throne ends holding the **other** winner (not the loser);
(b) with no concurrent writer, the same path still crowns (CAS succeeds); (c) the 409 body is
`application/problem+json`.
**RED**: drive the fake store to return a CAS-loss (e.g. a `beforeSwap` hook that bumps the
generation, or interleave two `handleFight` calls sharing one store); assert 409 + type + final throne
holder. Mutator-aware gaps: the `generation` equality compare in CAS, the `409` status literal, the
`/problems/throne-moved` type literal, the "throne holds the winner" post-condition.
**GREEN**: the generation compare in the fake's `compareAndSwap` + the handler's 409-on-CAS-false path.
**MUTATE / KILL MUTANTS**: the equality compare, status + type literals.
**REFACTOR**: none expected; keep the CAS contract explicit.
**Done when**: criteria met, mutation report reviewed, human approves commit.

### Slice 4: The title block shows who the King is, and records the submitter's handle

**Value**: Challenger — a title-fighter (win or lose) sees the incumbent's identity (`name` / `model` /
`handle`, **never** the doc); a crowned bot's `X-Author-Handle` + `model` are persisted and surfaced
to the next challenger.
**Path**: `handleFight` reads the optional `X-Author-Handle` header (≤ 64, control-chars rejected) →
carries it into crowning metadata on a crown → the `title` block gains `incumbent: { name, model,
handle }` sourced from the stored champion metadata (identity fields only, doc excluded).
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria**: (a) an occupied-throne title fight → `title.incumbent` has `name` / `model` /
`handle`, and `JSON.stringify(title)` contains **no** `"rules"` (no doc leak); (b) crowning with an
`X-Author-Handle` header → the stored champion metadata carries the handle → the next challenger sees
it as `incumbent.handle`; (c) a crowned bot's `model` (from its doc) appears as `incumbent.model`;
(d) an over-length (> 64) or control-char handle → `400 /problems/malformed-request` (**confirm at the
CONFIRM gate**: reject vs silently truncate — plan recommends _reject_, machine-readable, consistent
with the structured-error ethos); (e) no handle header → `incumbent.handle` is `null`, crown still
succeeds.
**RED**: assert identity present, doc absent, handle round-trips, model surfaced, length-cap behaviour.
Mutator-aware gaps: the doc-exclusion (a mutant that includes `rules` must fail), the `64` length
boundary, `handle ?? null` default.
**GREEN**: header read + sanitize, metadata plumbing, `title.incumbent` projection (identity-only).
**MUTATE / KILL MUTANTS**: the length boundary, the identity-only projection, the null default.
**REFACTOR**: assess a shared "public identity" projection helper (reused by lineage + title block).
**Done when**: criteria met, mutation report reviewed, human approves commit.

### Slice 5: The throne runs on real Upstash Redis in production

**Value**: Operator / everyone — the throne persists across cold starts and function instances on
real storage; the KotH ladder becomes durable. (Justified horizontal/integration slice: retires the
real-store integration risk; observable via a post-deploy smoke test.)
**Path**: implement `upstashThroneStore` behind the `ThroneStore` port using the Upstash REST API
(`fetch`), with one atomic Lua `EVAL` performing compare-generation + set-pointer + `RPUSH` lineage;
env-config (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`); `api/fight.ts` selects the real
store when env is present, the in-memory fake otherwise. Provision the Upstash integration on Vercel
(Marketplace — a dashboard action, like the S3 WAF rule, not repo code).
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria**: (a) a **shared `ThroneStore` contract test** (empty→read, CAS-crown,
CAS-generation-loss, lineage-append ordering) runs against the **in-memory fake** in CI and defines the
port's semantics; (b) the adapter's **request-building** is a pure, unit-tested function — given
`(version, expected, next)` it produces the correct Upstash `EVAL` payload (Lua script + `KEYS`/`ARGV`)
and correctly interprets the `crowned` / `moved` reply; (c) a **post-deploy smoke test** crowns a
throwaway bot on the deployed endpoint, reads it back (persistence), and confirms a stale-generation
resubmit yields `409` — an integration check, not a unit test (consistent with S1's smoke test);
(d) `/fight` remains under the existing S3 rate-limit (endpoint surface unchanged — no new advertise
step). _Note:_ live Redis is not exercised in CI (no live instance); the fake carries CI, the smoke
test carries prod — call this out in the PR.
**RED**: the `ThroneStore` contract suite (fake) + the adapter request-builder unit tests.
**GREEN**: the Upstash REST adapter + env-based store selection.
**MUTATE / KILL MUTANTS**: the request-builder payload shape + reply interpretation; the env-select
branch.
**REFACTOR**: assess the store-selection wiring; keep `api/fight.ts` thin.
**Done when**: criteria met, contract suite + adapter tests green, smoke test passes on the deploy,
mutation report reviewed, human approves commit.

## Pre-PR Quality Gate (per slice)

1. Mutation testing — run `mutation-testing` skill (scope the changed files).
2. Refactoring assessment — run `refactoring` skill.
3. `npm run typecheck` + `npm run lint` + `npm run format:check` clean.
4. Confirm TCB / determinism invariants untouched; `INPUT_HASH` / `BENCHMARK_VERSION` unchanged.

## Follow-ups / parking lot (out of scope for S4)

- Broader "fight archive" (retain non-champion submissions) — its own story _with_ a retention bound.
- `/replay` + full visible tape; a champions-history read endpoint; the Pixi viewer.
- Verified provenance / anti-impersonation + per-author accounts (deferred with decision 6).
- Server-side title-only re-evaluation on `409` (v1 has the client resubmit).

---

_Delete this file when the plan is complete (archive it under `docs/archive/` per repo convention —
see [[archive-plans-not-delete]]). If `plans/` is empty afterward, leave the two live platform docs._
