# Plan: S3 — `POST /fight` (stateless gauntlet gate)

**Branch**: feat/platform-api-s3-fight (per-slice branches thereafter)
**Status**: Active — Slice 1 ✅ (PR #178), Slice 2 ✅ (PR #179); Slice 3 next

Story: `plans/platform-http-api-stories.md` (S3). Decisions: `plans/platform-http-api-decisions.md`
(§API response contract, §Engineering requirements, decisions 2/4/5/6/7). Skipping `grill-me` —
the crux decisions were resolved at the 2026-07-05 grill + the 2026-07-06 find-gaps (11 gaps closed).

## Goal

An LLM author POSTs a bot to `/fight` and learns — in one synchronous response — whether it **cleared
the frozen gauntlet** (won > 50% vs each of the 6 members) plus a compact, leak-free per-member report
it can use to iterate. Stateless; no throne yet (that's S4).

## What this reuses (thin seam — TCB untouched)

The API is transport + orchestration over already-built, canonical pieces (invariant #2):

- **The S2 request envelope** (`api/validate.ts`): `POST`-only (405 + `Allow`), `413` at
  `text.length > LIMITS.maxBytes`, `safeParse` → `400` malformed / `422` invalid-bot (+`errors`),
  **parse-first** (no content-type gate). `/fight` inherits this verbatim.
- **`benchmark()`** (`src/engine/benchmark.ts`) — the pure, deterministic gauntlet aggregator, run
  with the **frozen manifest** (`benchmark-config.ts`: `SEEDS` [1..10], `MAX_TICKS` 600, `MATCH`,
  `GAUNTLET_NAMES`, `BENCHMARK_VERSION` "v19") + `CANONICAL_RULES`, exactly as `src/cli/benchmark.ts`
  wires it. One source of truth; no parallel gauntlet definition (decisions §"gauntlet IS the frozen
  benchmark").
- **The 6 gauntlet docs** loaded from `bots/<name>.json` (runtime `readFileSync`, the proven S1
  pattern — `vercel.json` already carries `includeFiles: bots/*.json` for `api/spec.ts`).

New code is the transport shell only: the `/fight` handler, a shared RFC 9457 envelope module, and a
pure report reshaper. Two **additive, version-neutral** engine fields (per-opponent `endReasons`;
aggregated `degrade`) land in slices 2–3 — see "Invariants" for why they don't move `INPUT_HASH`.

## Invariants this plan holds (flag any deviation)

- **Determinism (#1).** `benchmark()` is pure — no clock/random of its own; the only entropy is the
  fixed, disclosed `SEEDS`. Given a seed the fight replays byte-identically. No floats in the outcome
  path are introduced (`winRate`/derived figures are report-layer, not fed back into the sim).
- **Security / TCB (#2).** No DSL op added; the allowlists in `dsl.ts` are untouched. The handler
  only calls `validate` / `benchmark` (which calls `runFight`). No host/network/fs/time/random op
  reaches the interpreter. The gauntlet-file `readFileSync` is API-shell I/O, outside the TCB.
- **`INPUT_HASH` / `BENCHMARK_VERSION` unchanged.** The endpoint is not a scoring input. Slices 2–3
  add fields to `OpponentScore` / `BenchmarkResult` — the hash is over `{rules, seeds, maxTicks,
match, gauntlet file texts}`, **not** the result shape, and no scoring _outcome_ changes. The
  `benchmark-config.test.ts` guard + the `docs/spec.md` drift test stay green (verify each slice).

## Gate predicate (decisions 2)

`cleared` ⇔ **every one of the 6 `GAUNTLET_NAMES` is present in `perOpponent` AND won `> 0.5`**
(strict; `wins / fights`, a draw is not a win). Strict `>` resolves the exact-tie edge (10W-10L =
0.5 → **not** passed). Because a byte-clone of a gauntlet member is skipped by `benchmark()`'s
no-mirror rule, it is **absent** from `perOpponent` → `cleared` is false automatically (decisions
§"Mirror rule at the gate": copying a gauntlet fighter can never clear). Cosmetic limitation: a
self-clone submission yields a 5-entry report (the mirrored member omitted); the gate is still
correct. Honest 6-entry-for-clones (via a `skipMirror:false` benchmark option) is **parked** — no LLM
submits a byte-clone, and the gate result is identical.

## Acceptance Criteria (feature)

- [ ] `POST /fight` with a valid bot returns `200 application/json` with the report shape from
      decisions §API response contract: `version`, `cleared`, `gauntlet.seeds`,
      `gauntlet.perOpponent[]` (name, winRate, wins, losses, draws, net, passed, endReasons),
      `diagnostics.degrade`. **No `title` block** (throne is S4).
- [x] `cleared` is true iff the bot won > 50% vs each of the 6 members; a member it did not beat
      (incl. a byte-clone) leaves `cleared` false. _(Slice 1, PR #178)_
- [x] Every error path matches the RFC 9457 contract, identical to `/validate`: `405`+`Allow`,
      `413` oversize, `400` malformed, `422` invalid-bot (+`errors`). An invalid bot **never fights**. _(Slice 1, PR #178)_
- [x] The response never contains any opponent's bot document or engine internals (visibility
      principle) — only spectator-visible figures. _(Slice 1, PR #178)_
- [ ] `/spec` advertises `POST /fight` **only after** the rate-limit is in place (go-public gate).
- [ ] TCB, `INPUT_HASH`, `BENCHMARK_VERSION`, and `docs/spec.md` are unchanged by the whole feature.

## Slices

Every slice runs RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. Before code in each slice, load `tdd`,
`testing`, `mutation-testing`, `refactoring`. Present the slice's acceptance criteria and **wait for
approval** before writing tests; **wait for commit approval** after.

---

### Slice 1: Walking skeleton — the gate verdict + core compact report ✅ DONE (PR #178)

**Value**: An LLM author (internal, unadvertised) POSTs a bot and gets back pass/fail vs the frozen
gauntlet plus per-member W/L/net — the core learning loop. Proves the deploy path: a serverless fn
that runs the real gauntlet from `src/` + the bundled `bots/*.json`.

**Path**: `POST /fight` → shared envelope (method/size/parse/validate → problem+json or a validated
`BotDoc`) → load the 6 gauntlet docs → `benchmark({bot, gauntlet, seeds:SEEDS, maxTicks:MAX_TICKS,
rules:CANONICAL_RULES, match:MATCH})` → pure reshaper `buildFightReport(result, {version, seeds})`:
`cleared` (gate predicate over all 6 names) + `gauntlet.perOpponent[]` = `{name, winRate: wins/fights,
wins, losses: fights−wins−draws, draws, net: netPoints, passed}` → `200 application/json`.
**Skipped this slice:** per-opponent `endReasons`, `diagnostics.degrade`, the `title` block, the
`/spec` advertise row, the rate-limit.

**Supporting refactor (DRY-by-knowledge — the S2-deferred trigger):** the RFC 9457 envelope is now
shared knowledge across two handlers. Extract `problem()` + a `readValidatedBot(req): Promise<Response
| { doc: BotDoc }>` into a **shared module under `src/http/`** (NOT under `api/` — Vercel routes every
`api/*.ts`). Rewire `api/validate.ts` to consume it: **behavior unchanged**, so `api/validate.test.ts`
is the characterization guard (must stay green untouched). The extracted helpers are covered _through_
both handlers' tests — no 1:1 test file (testing skill).

**Integration:** `vercel.json` — add `functions["api/fight.ts"].includeFiles: "bots/*.json"`. Do
**not** add a public `/fight` rewrite or `/spec` advertise row yet → the endpoint is reachable at
`/api/fight` for internal dogfood but is **unadvertised** (see Open Decision 1).

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.

**Acceptance criteria** (present + confirm before code):

- Valid bot → `200 application/json`, body has `version === "v19"`, `cleared: boolean`,
  `gauntlet.seeds === [1..10]`, and 6 `perOpponent` entries each with `{name, winRate, wins, losses,
draws, net, passed}`. `winRate === wins/fights`, `losses === fights−wins−draws`,
  `passed === winRate > 0.5`.
- `cleared === perOpponent every-name-present && every passed`.
- Error paths byte-identical to `/validate`: 405+Allow / 413 / 400 / 422+errors (parse-first).
- `api/validate.test.ts` unchanged and green after the envelope extraction.

**RED**: (a) pure-reshaper unit tests via a **factory `BenchmarkResult`** (fast, no fights) — gate
edges: all-pass → cleared; exactly one member 10W-10L (0.5) → that member `passed:false`, `cleared:false`;
a missing member (5 entries) → `cleared:false`; derivations `winRate`/`losses`/`net` exact. Mutator
gaps to pre-empt: the strict `>` boundary (0.5 must fail — kills `>=`), `wins/fights` vs `wins/total`,
`fights−wins−draws` operand swaps, `every` vs `some`. (b) One handler integration test: construct a
real `Request` with a known bot (e.g. a gauntlet member re-authored, or `bots/` sample) → assert
status/shape/`version` end-to-end through the real gauntlet.

**GREEN**: `src/http/` envelope + `src/http/fight-report.ts` reshaper + `api/fight.ts` wiring +
`vercel.json` includeFiles. Minimum to pass.

**MUTATE**: Stryker on `src/http/fight-report.ts` + `api/fight.ts` (+ the extracted envelope module).
`--mutate <file>:<ranges>` with one comma-joined flag.

**KILL MUTANTS**: strengthen reshaper boundary/derivation tests; ask if any survivor is genuinely
equivalent.

**REFACTOR**: assess only if it adds value (e.g. share the `losses` derivation). Keep the reshaper pure.

**Done when**: all ACs met, mutation report reviewed, `/validate` suite green, typecheck/lint/format
clean, human approves commit.

---

### Slice 2: Per-opponent `endReasons` in the report ✅ DONE (PR #179)

**Value**: The author sees _how_ each matchup ended (gap / time / senshu / overtime) — e.g. "all my
zoner losses were `time` decisions" is different learning from "I got gapped out." Decision 5's
per-matchup `endReason` richness.

**Path**: Engine (E1) — add `endReasons: Record<FightResult["endReason"], number>` to `OpponentScore`;
`summarize()` tallies it per opponent (reuse the `{gap:0,time:0,senshu:0,overtime:0}` init already in
`tallyOfficiating`). Reshaper surfaces it on each `perOpponent` entry.

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.

**Acceptance criteria**: each `perOpponent[i].endReasons` sums to that opponent's `fights` (=20) and
matches the actual per-matchup outcomes; the global `officiating.endedBy` still equals the sum across
opponents (no regression); `INPUT_HASH`/version unchanged.

**RED**: `benchmark.test.ts` — a crafted `bot`+`gauntlet`+`rules` (or existing fixtures) where a known
matchup ends by a known reason → assert `perOpponent[x].endReasons` counts; assert Σ per-opponent
`endReasons` === global `endedBy` (kills a mis-bucketed / dropped-reason mutant). Handler test asserts
the field appears and shape-matches.

**GREEN**: minimal `summarize`/`OpponentScore` extension + reshaper field.

**MUTATE / KILL / REFACTOR**: Stryker on `benchmark.ts` (the new tally) + reshaper. Kill bucket-swap /
init-value mutants.

**Done when**: ACs met, `benchmark-config.test.ts` guard green (hash unchanged), report shows
`endReasons`, human approves.

---

### Slice 3: `diagnostics.degrade` — aggregated S8 telemetry

**Value**: The single highest-signal coaching line — "your kicks were `locked` 40% of frames
(gassed)" / "12 `unaffordable`". Decision 5's aggregated S8 degrade diagnostics.

**Path**: Engine (E2) — `benchmark()` currently discards `FightResult.events`. Aggregate the
**submitted bot's** `degrade` across all fights: bot is fighter A in `asA` (count `asA.events[].a.degrade`)
and fighter B in `asB` (count `asB.events[].b.degrade`); fold non-null reasons into
`BenchmarkResult.degrade: Record<DegradeReason, number>` (`unaffordable|out-of-band|locked|inert|wrong-context`).
Reshaper maps it to `diagnostics.degrade`.

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.

**Acceptance criteria**: `diagnostics.degrade` counts only the **submitted bot's** degraded frames
(never the opponent's — visibility principle), aggregated over both sides × all seeds × all opponents;
a bot with no degradation reports all-zero; `INPUT_HASH`/version unchanged.

**RED**: `benchmark.test.ts` — a bot whose moves are known to degrade (e.g. an unaffordable-costed
move, or an out-of-band strike) vs a benign opponent → assert the expected reason count > 0 and the
_opponent's_ degradation is **not** counted (construct so only one side degrades → kills an
"aggregate both fighters" mutant). Zero-degrade bot → all zeros.

**GREEN**: extend `Outcome` + `playBothSides` to carry the bot-side degrade tally; fold in `benchmark`;
reshaper field.

**MUTATE / KILL**: Stryker on `benchmark.ts`. Kill the side-selection mutant (a→b), the null-filter
mutant, and reason-key mutants. Check `src/cli/format.ts` for a liftable tally before writing new code
(reuse over reinvent); do not add a CLI display unless free.

**REFACTOR**: assess; keep the per-frame reduce cheap (~84k frames total is trivial).

**Done when**: ACs met, guard/drift green, report shows `diagnostics.degrade`, human approves.

---

### Slice 4: Harden & go public — rate-limit + advertise `/fight`

**Value**: `/fight` becomes **discoverable** in the self-describing spec and safe to expose — the loop
is now truly one-URL. This is the public-release gate for the first public **compute** endpoint.

**Path**: (a) **Advertise** — add the `POST /fight` row to `LIVE_ENDPOINTS` in `api/spec.ts` (the
envelope grows by a row, never by prose — no dead URLs) + the `/fight` public rewrite in `vercel.json`.
(b) **Rate-limit** — per-IP limit on the `/fight` route via Vercel's platform WAF/firewall (decisions
§abuse hygiene; the soft brake against title-variance-farming, accepted for v1). Payload cap is
already enforced (413, from Slice 1's envelope).

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.

**Acceptance criteria**: `GET /spec` now lists `POST <host>/fight` in the API-endpoints envelope
(TDD'd in `api/spec.test.ts`, same as the `/validate` row); the rate-limit is configured on `/fight`
and verified by a post-deploy smoke check (an integration check, not a unit test). Document that the
WAF returns a platform `429` (not necessarily `problem+json`); the contract's `/problems/rate-limited`
is the target only if a code-level limiter is later added (Open Decision 3).

**RED**: `api/spec.test.ts` asserts the `/fight` row appears in the envelope with the right method/
summary; guard test still confirms the byte-hashed core has no absolute URL.

**GREEN**: the `LIVE_ENDPOINTS` row + `vercel.json` rewrite; WAF config.

**MUTATE / KILL**: Stryker on `api/spec.ts` (the envelope now has a 2nd advertised row — pin it).

**Done when**: ACs met, smoke test passes post-deploy, human approves. This closes S3.

## Open decisions (resolve at each slice's CONFIRM gate — recommendations given)

1. **Internal-only enforcement (Slice 1).** _Recommended:_ deploy `/fight` functional but
   **unadvertised** (no `/spec` row, no public rewrite) until Slice 4 — reachable at `/api/fight` for
   dogfood, invisible to the loop. A stricter shared-secret header gate is a cheap add only if abuse
   appears before Slice 4; not needed for v1 internal testing.
2. **Mirror cosmetic (Slice 1).** _Recommended:_ accept the 5-entry report for a self-clone (gate is
   correct); park the `skipMirror:false` honest-6-entry variant. No LLM submits a byte-clone.
3. **Rate-limit mechanism (Slice 4).** _Recommended:_ Vercel platform WAF (decisions default; no
   store, no code). An in-handler per-IP limiter would give a `problem+json` 429 but needs shared
   state that stateless serverless lacks in v1 — defer with the identity model (decision 6).
4. **Gauntlet loading (Slice 1).** _Recommended:_ runtime `readFileSync` + `includeFiles` (the proven
   S1 pattern). Build-time JSON import (`resolveJsonModule` + import assertions) is an alternative that
   avoids fs but changes tsconfig mid-feature — not worth it.

## Pre-PR Quality Gate (each slice)

1. Mutation testing (`mutation-testing`) on the slice's changed files; report reviewed.
2. Refactoring assessment (`refactoring`).
3. `npm run typecheck` + `npm run lint` + `npm run format:check` clean.
4. Confirm `INPUT_HASH` / `BENCHMARK_VERSION` unchanged and `benchmark-config.test.ts` + the
   `docs/spec.md` drift test green (slices 2–3 especially).

---

_Per repo convention ([[archive-plans-not-delete]]): when complete, this file is **archived** to
`docs/archive/` with a README index entry — not deleted. (Overrides the planning skill's delete footer.)_
