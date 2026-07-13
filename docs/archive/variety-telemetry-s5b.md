# Plan: Variety board — S5b (committed, drift-guarded variety snapshot)

**Branch**: feat/variety-board
**Status**: ✅ Complete — shipped PR #292 (merged 2026-07-13); `gen-variety.ts` 100%
mutation, `telemetry-deps.ts` 90.91% (1 documented equivalent — the `readFileSync`
encoding arg, inert under `JSON.parse`'s utf8 coercion); all 7 acceptance criteria met.
Archived per `[[archive-plans-not-delete]]`.

## Goal

The team can review a committed, always-current, CI-guarded variety snapshot in the
repo (`docs/variety.md`) — a deterministically regenerated board that can never
silently lie about the frozen gauntlet's move-variety health.

## Context & locked decisions (grill-me, 2026-07-13)

S5b is the last variety-telemetry story with any build in it (S5a is "just use the
S1b override on a submissions dir" — no build; S5c is the far-future public web
surface). Its one-line story text (`variety-telemetry-stories.md` §Split candidates,
S5b row) named **two incompatible precedents** — "like `docs/benchmark-gauntlet-v19.md`"
(hand-written) _and_ "regenerates deterministically" (generated). A grill-me pass
resolved the whole design tree; the four forks and their answers:

1. **Board style → GENERATED + drift-tested** (the `docs/spec.md` precedent, NOT the
   hand-written gauntlet-board one). The gauntlet boards have no generator and no
   byte-match test — they drift silently. `docs/spec.md` is the repo's only
   "regenerates deterministically + CI-guarded" artifact: a pure `generateSpec()`
   (`gen-spec.ts:925`) → `write-spec.ts` writer (`gen:spec` script) → a `toBe` drift
   test (`gen-spec.test.ts:966`) → `.prettierignore` + `.gitattributes eol=lf` pins.
   The variety board mirrors that trio. The harness already emits its whole report as
   a pure deterministic function, so wiring it to a guarded file is cheap.
2. **Content → REUSE the CLI text, fenced.** The board body is the _exact_
   `runTelemetryCli([], deps).stdout` (all five shipped `render*` sections + the
   provenance header) placed verbatim inside a ```fence, wrapped in a thin markdown
scaffold. Near-zero new render code; the board is byte-identical to what`npm run telemetry` prints. (Rejected: a second set of native-markdown-table
   renderers — duplicates every section's layout in a parallel format.)
3. **Filename → EVERGREEN `docs/variety.md`** (single file; version embedded inside,
   sourced from `BENCHMARK_VERSION`; historical snapshots live in git). Mirrors
   `docs/spec.md` (not `docs/spec-v19.md`). A `BENCHMARK_VERSION` bump regenerates the
   same path with the same drift test — nothing to re-point. (Rejected:
   version-stamped `docs/variety-v19.md` — a new un-guarded file per bump, redundant
   with git history for a regenerated artifact.)
4. **§P7 verdict → MINIMAL scaffold + a STATIC note.** The scaffold adds a title
   (with the interpolated version), a manifest-sourced provenance line, and a
   _static_ one-line §P7 orientation note (soft targets `usage ≤ 35%`,
   `opener win ≤ 60%`; "scan for ⚠ below"). The actual pass/fail lives _only_ in the
   fenced output's existing inline `⚠` flags + legends — no second computed verdict to
   drift out of sync. (Rejected: a computed `§P7: PASS / ⚠ N breaches` headline —
   asserts §P7 status in a second place.)

Population is the **frozen 6-bot gauntlet only** (no override) — a committed
byte-match board requires a fixed, versioned population (scoping decision #6; the
`-- bots/*.json` override is a live-use tool, not a committed artifact).

**Non-negotiable (shared with all of S1a–S4):** a PURE READ-ONLY reduction. It reuses
`runVariety` / `runTelemetryCli` (both read-only) and touches **no** scoring input —
no `sim.ts` / `dsl.ts` / `types.ts` / `prng.ts` / `rules.ts` / `benchmark.ts` /
`benchmark-config.ts` change, **no `INPUT_HASH` flip, no `BENCHMARK_VERSION` bump**,
`npm run fight` byte-identical.

## Acceptance Criteria

- [ ] **S5b-1 (generator is pure + deterministic).** A new pure `generateVariety(deps)`
      (in `src/cli/gen-variety.ts`, defaulting `deps` to the frozen-gauntlet build)
      returns the full board markdown as a string, and `generateVariety()` equals
      `generateVariety()` (purity, mirroring `gen-spec.test.ts:62`).
- [ ] **S5b-2 (body is byte-identical to the tool output).** The fenced region of
      `generateVariety()` contains exactly `runTelemetryCli([], deps).stdout` for the
      frozen gauntlet — the board is provably "what `npm run telemetry` prints," never a
      divergent re-render.
- [ ] **S5b-3 (scaffold — version + static §P7 note).** `generateVariety()` output
      opens with an H1 carrying the current `BENCHMARK_VERSION` (interpolated, not
      literal), a manifest-sourced provenance line (population size, seed count, version),
      and a static §P7 orientation note naming the soft targets and pointing at the `⚠`
      flags. (Exact wording pinned by the render test, not pre-specified here.)
- [ ] **S5b-4 (writer + `gen:variety` script).** `src/cli/write-variety.ts` writes
      `generateVariety()` to `docs/variety.md` (utf8); a `gen:variety` npm script
      (`tsx src/cli/write-variety.ts`) regenerates it — mirroring `write-spec.ts` /
      `gen:spec`.
- [ ] **S5b-5 (committed board + drift test).** `docs/variety.md` is committed, and a
      drift test asserts the committed file `toBe(generateVariety())` — CI (the vitest
      suite) fails the moment the board drifts from the generator (mirroring
      `gen-spec.test.ts:966`).
- [ ] **S5b-6 (byte-stable across platforms).** `.prettierignore` lists
      `docs/variety.md` and `.gitattributes` pins `docs/variety.md text eol=lf`, so
      prettier never reformats it and a Windows checkout keeps LF — the byte-match holds
      cross-platform (mirroring the `docs/spec.md` pins at `.prettierignore:12-13`,
      `.gitattributes:1-4`).
- [ ] **S5b-7 (read-only invariant).** No scoring-input file changes; `INPUT_HASH` and
      `BENCHMARK_VERSION` unchanged; `npm run fight` byte-identical. Verified by
      `git diff --name-only` (no engine/TCB/config touch) + the existing `INPUT_HASH`
      guard staying green.

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without
a failing test. Read `.claude/CLAUDE.md` + the testing rules before writing code.

### Slice 1: The committed, drift-guarded variety board

**Value**: the roster designer / team gets a single evergreen `docs/variety.md` they can
read in-repo and in PR diffs — the frozen gauntlet's full move-variety readout,
regenerated by `npm run gen:variety` and CI-guarded so it can never silently go stale.
**Path**: `generateVariety(deps)` (pure — reuses `runTelemetryCli([], deps).stdout` +
a thin markdown scaffold) → `write-variety.ts` (thin fs writer, `gen:variety` script)
→ committed `docs/variety.md` → a `toBe` drift test in the vitest suite → `.prettierignore`

- `.gitattributes` LF pins. One cohesive PR (the doc can't be committed without the
  generator; the drift test needs both). No override population, no computed verdict —
  those are out of scope by decisions #2/#4/#6.
  **Required implementation skills**: before code changes, load `tdd`, `testing`,
  `mutation-testing`, and `refactoring`. Also load `cli-design` for the writer's stream
  discipline (mirror `write-spec.ts`).
  **Acceptance criteria**: S5b-1 … S5b-7 above. **Present to human and get confirmation
  before writing any code.**
  **RED**: Write `src/cli/gen-variety.test.ts`:
  - the **drift test** — `readFileSync(varietyPath, "utf8") toBe generateVariety()`
    (fails: neither `generateVariety` nor `docs/variety.md` exists yet);
  - the **purity test** — `generateVariety() toBe generateVariety()`;
  - **scaffold tests** — output starts with an H1 containing `BENCHMARK_VERSION`
    (kills a StringLiteral/removed-interpolation mutant on the version), contains the
    static §P7 note text, and contains a fenced block;
  - the **body-fidelity test** — the fenced region equals `runTelemetryCli([], deps).stdout`
    (kills a mutant that drops or reorders the CLI body).
    Mutator watch (from `mutation-testing`): string-literal mutations on the scaffold
    fragments, the version interpolation, and the template concatenation order.
    **GREEN**: implement `generateVariety(deps = defaultGauntletDeps())` in
    `src/cli/gen-variety.ts` (build `deps` by reusing `telemetry.ts`'s assembly —
    `loadGauntlet` over `GAUNTLET_NAMES` + the `CANONICAL_RULES`/manifest fields;
    extract a shared builder only if it removes real duplication, per `refactoring`),
    `write-variety.ts` (`writeFileSync(varietyPath, generateVariety(), "utf8")`), the
    `gen:variety` package script; run it to write `docs/variety.md`; add the
    `.prettierignore` + `.gitattributes` entries.
    **MUTATE**: run `mutation-testing` on `gen-variety.ts` (+ `write-variety.ts` if it
    carries logic) — produce a report.
    **KILL MUTANTS**: strengthen the scaffold/body tests for any survivor (ask the human
    if a survivor's value is ambiguous — e.g. a Lua-glue-style unkillable string).
    **REFACTOR**: assess the deps-builder duplication vs `telemetry.ts` (extract only if it
    adds value); otherwise leave.
    **Done when**: S5b-1 … S5b-7 met, `npm run gen:variety` reproduces `docs/variety.md`
    byte-for-byte, the drift + purity + scaffold + body tests are green, mutation report
    reviewed, `git diff --name-only` shows no scoring-input touch, and the human approves
    the commit.

## Pre-PR Quality Gate

Before the PR:

1. Mutation testing — run `mutation-testing` on `gen-variety.ts` (+ writer if it has
   logic); reach 100% on changed lines or document any equivalents (Lua-string-style
   smoke-verified exceptions allowed, per the S3b/S4 precedent).
2. Refactoring assessment — run `refactoring` (the deps-builder factoring call).
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass (note:
   `docs/variety.md` is `.prettierignore`d, so `format:check` must not flag it).
4. Read-only proof: `git diff --name-only main` shows only `src/cli/gen-variety.ts`,
   `src/cli/gen-variety.test.ts`, `src/cli/write-variety.ts`, `docs/variety.md`,
   `package.json`, `.prettierignore`, `.gitattributes` (+ the plan/scoping-doc updates)
   — no `sim.ts`/`dsl.ts`/`types.ts`/`prng.ts`/`rules.ts`/`benchmark*.ts`; grep
   confirms `INPUT_HASH` / `BENCHMARK_VERSION` untouched.

## Flow (mirrors the S2/S3a/S3b/S4 precedent)

1. **This `docs(plan)` PR merges first** (the "no plan on main" lesson) — the plan +
   the scoping-doc updates (harness decision #11, stories §S5b resolution + stale-S4
   tidy).
2. Then the **Slice-1 TDD PR** (`feat/variety-board`).
3. Then **archive this plan** to `docs/archive/variety-telemetry-s5b.md` (+ README
   entry) per `[[archive-plans-not-delete]]`, and update `docs/STATUS.md` (variety
   series → S5b shipped; S5a/S5c the only remainder).

---

_Archive (don't delete) when complete, per `docs/archive/README.md` + the
`archive-plans-not-delete` rule._
