# Plan: Pure KotH S2 — Drop the gauntlet

**Branch**: `feat/pure-koth-s2-spec-drops-gauntlet` (Slice 2; Slice 1 shipped, Slice 3 on its own branch)
**Status**: Active — **Slice 1 shipped** (PR #402, `main`@`bd53a71`); Slices 2–3 remain.

Child story S2 of the `pure-koth-stories.md` split. Decisions: `pure-koth-decisions.md`
(D1–D17; S2 leans on D6/D8/D9/D10/D15/**D16**/**D17**). Engine + TCB untouched — all work in
`src/http/`, the `api/` wrappers, `web/`, `src/cli/gen-spec.ts`, and the generated `docs/spec.md`.
Predecessor: **S1 shipped** (`docs/archive/pure-koth-s1.md`) — the arena is now born seeded with
three House champions, so a `/fight` compete always faces a non-empty board.

## Goal

Remove the 6-bot gauntlet pre-gate so a submitted bot battles the sitting champions directly —
simpler, faster, legible — reshaping `/fight`, `/ring`, the home page, and the author-facing spec
to a pure King-of-the-Hill product with no "clear the gauntlet" anywhere.

## Context the slices lean on

- **The round-robin already does the work.** `handleFight` already round-robins the arena
  (`roundRobin` → `rankArena` → `settle`) for placement; the gauntlet `benchmark({ gauntlet })`
  pass + `buildFightReport` + the `if (!report.cleared) return` gate sit in FRONT of it. Dropping
  the gate is a deletion, not a rewrite — every valid bot flows straight to crowned/entered/unplaced.
- **The board already carries its telemetry (D8 is free).** `Placement.board` rows are
  `{ defender, ...toTitleFightReport(fight) }` — win-rate / net / W-L-D / endReasons / degrade per
  defender. Keeping per-row telemetry costs nothing; only the top-level `cleared` /
  `gauntlet.perOpponent` / `diagnostics` wrapper is dropped.
- **Dead code retires with the gate (D9).** After the gate goes, `FightDeps.gauntlet` +
  `gauntletNames` are unused in the handler (the House seed is built in `api/fight.ts` from
  `loadGauntlet()`, independent of these fields); `buildFightReport` / `FightReport` /
  `FightReportOpponent` / `toReportOpponent` (+ the gate-only `passedBy`/`winRateOf`) retire from
  `fight-report.ts`. `toTitleFightReport` / `TitleFightReport` **stay** (the board rows use them).
- **API↔`/ring` land together (single PR — find-gaps).** `/ring` keys on `body.cleared`; shipping
  the reshaped API before the UI shows "Didn't clear the gauntlet" for everything. No shape-tolerant
  shim: the handler contract reshape and the `/ring` reshape (+ home "Gauntlet" section removal +
  How-It-Works copy) are ONE PR — Slice 1.
- **Seed guarantees a non-empty board.** Post-S1 the arena always has ≥3 members and relegation
  preserves N, so a compete's `board` is never empty: the `/ring` "empty throne / first King"
  branches (`boardHasRows === false`) are now dead and simplify away.
- **Author-facing docs must stop lying (D16).** `/spec` (from `gen-spec.ts`, feeding `/spec-guide`
  + built `docs/spec.md`) and `llms.txt` tell authors to "clear all six gauntlet opponents"; a
  `gen-spec.ts` prose change forces `npm run gen:spec` (the `docs/spec.md` drift guard goes RED
  until regenerated) but moves neither `BENCHMARK_VERSION` nor `INPUT_HASH`.
- **Mirror hardening (D17).** Seeds carry an overridden display `model: "House"`, so a raw resubmit
  of a House champion slips today's byte-exact `mirrorSlot`. Comparing scoring content (doc minus
  `model`) closes it — http layer only, no engine/`sameDoc` touch.

## Acceptance Criteria

- [x] A valid bot competing runs **no gauntlet gate** — it is ranked by the arena round-robin alone
      and placed crowned / entered / unplaced (there is no "failed the gate" tier). — **Slice 1, PR #402**
- [x] `POST /fight` returns `{ version, title | projection }`, where the block is
      `{ outcome, rank?, board, displaced? }` and each `board` row keeps its per-defender telemetry;
      the body carries **no** `cleared`, `gauntlet.perOpponent`, or `diagnostics`. — **Slice 1**
- [x] `buildFightReport` / `FightReport` / `FightReportOpponent` and the now-unused
      `FightDeps.gauntlet` / `gauntletNames` are removed; `toTitleFightReport` remains. Typecheck +
      lint stay green (no dead references). — **Slice 1**
- [x] `/ring` after a compete shows an arena headline + the per-defender board as the primary
      result, with **zero** "gauntlet" language and no gauntlet scorecard; practice still previews a
      `projection` with a claim button (the two-step practice→claim survives). — **Slice 1**
- [x] The home page has **no "The Gauntlet" section**; the How-It-Works copy describes pure KotH
      (fight the sitting champions; out-rank the weakest to enter, beat the King to be crowned). — **Slice 1**
- [x] `/spec` + `llms.txt` describe fighting the sitting champions directly — no "clear all six /
      earn a title shot" gate language; `docs/spec.md` is regenerated; `INPUT_HASH` +
      `BENCHMARK_VERSION` are unchanged (D16). — **Slice 2 (this PR)**
- [ ] A raw resubmit of a seeded House champion (differs only by the inert `model`) is rejected
      `409 arena-mirror` naming its slot — it never competes or takes a slot; a byte-exact resubmit
      of a real member is still caught (D17).
- [ ] The engine and its TCB are untouched; determinism / bots-are-data / on-demand-replay
      invariants hold.

## Slices

Classified per the planning contract. Slice 1 is a **behavior change** (RED-GREEN + mutation /
manual web scan). Slice 2 is a **behavior change** for the author-facing contract (the doc-drift
guard + spec tests are the RED). Slice 3 is a **behavior change** (mutation on the http mirror
guard). `src/http/` is in Stryker node scope (mutants meaningful); `web/` is NOT (exhaustive
exact-assertion tests + a manual mutator scan, per the project norm); `gen-spec.ts` is string
assembly (low-value mutation → alternate evidence via the byte-drift guard + spec tests).

Slices 2 and 3 are mutually independent and may swap; the mirror (Slice 3) is a small isolated
diff on the reshaped handler and could even precede Slice 1 — it is sequenced last to avoid rebase
friction. Slice 2 is sequenced right after Slice 1 so the author-facing docs stop lying promptly.

### Slice 1: Drop the gate — a bot fights the champions directly, and `/fight` + `/ring` show the arena result — ✅ SHIPPED (PR #402, `main`@`bd53a71`)

**Shipped as**: `handle-fight.ts` (gate pass + `buildFightReport` + `!cleared` return deleted; `settle` →
`{ version, title|projection }`); `fight-report.ts` shrunk to `toTitleFightReport`; `FightDeps.gauntlet`/
`gauntletNames` + `api/fight.ts` wiring retired; `RingPage.tsx` arena-only headlines + scorecard removed +
dead empty-board branches gone; home "Gauntlet" section/component deleted, Nav + How-It-Works + Podium +
`/ring` meta de-gauntleted. Full suite 2259 green; MUTATE http 100% (130/130); net −876 lines.

**Value**: Bot author — a submission no longer clears a 6-bot gate; it fights the sitting champions
directly and the ring shows the arena outcome. The headline S2 ask, delivered end-to-end.
**Path**: `POST /fight` → `handleFight` → (no gauntlet pass) → `readArenaOrSeed` → `mirrorSlot` →
`roundRobin` vs the seeded arena → `rankArena` → `settle` → `{ version, title|projection }` →
`/ring` renders the arena headline + per-defender board. Home page drops its "Gauntlet" section.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing` (http), `refactoring`
(assess the `settle`/`fight-report` seams after the retirement). Web: exhaustive exact-assertion
tests + manual mutator scan (web ∉ Stryker).
**Reduction program**: N/A (behavior change, not a reduction program — though it retires D9 dead
code as a natural consequence).
**Transition/terminal evidence**: N/A.
**Acceptance criteria** (confirm before coding):

- A compete request runs no `benchmark({ gauntlet: deps.gauntlet })` pass; the response is
  `{ version, title|projection: { outcome, rank?, board, displaced? } }` with no `cleared` /
  `gauntlet` / `diagnostics` keys, and each `board` row carries `winRate/net/wins/losses/draws/
  bouts/endReasons/degrade`.
- Every valid bot is placed (crowned / entered / unplaced) — there is no early "didn't clear"
  return; an unplaced compete still commits its archive record and leaves the arena byte-identical.
- Practice (`X-Compete` ≠ true) returns the same placement as a `projection` (never a `title`),
  writing nothing.
- `buildFightReport` / `FightReport` / `FightReportOpponent` / `toReportOpponent` and the unused
  `FightDeps.gauntlet` / `gauntletNames` are gone; `api/fight.ts` compiles without them;
  `toTitleFightReport` is retained.
- `/ring`: an arena headline (crowned → "dethroned the reigning King"; entered → "joined the arena
  at #k"; unplaced → "didn't crack the top ranks"), the per-defender board as the primary result,
  the gauntlet scorecard removed, loading copy no longer says "Running the gauntlet", and **no**
  "gauntlet"/"clear" wording anywhere; the now-dead empty-board "first King" branches are removed.
- Home page: the "The Gauntlet" section is removed (`home/Gauntlet.tsx` + test deleted, `App.tsx`
  no longer renders it); How-It-Works copy describes pure KotH with no gate language.

**RED**: (http) `handle-fight.test.ts` — reshape the gate cases: a competing bot that would have
"failed the gauntlet" now still places (or goes unplaced) by arena rank; assert the response has
`title|projection` and **lacks** `cleared`/`gauntlet`; an unplaced compete leaves the arena
unchanged; practice returns `projection`. (web) `RingPage.test.tsx` — a crowned/entered/unplaced
body renders the arena headline + board with no "gauntlet"/"clear" text and no scorecard.
`Gauntlet.test.tsx`/`App.test.tsx`/`HowItWorks.test.tsx` — the home section is absent and the copy
is gate-free.
**GREEN**: Delete the gauntlet benchmark pass + `buildFightReport` call + the `!report.cleared`
return; `settle` returns `{ version: deps.version, title|projection: placement }`; retire the dead
`fight-report.ts` exports + `FightDeps` fields + `api/fight.ts` wiring; reshape `RingPage.tsx`
(headlines, drop scorecard + `cleared` guard + dead empty-board branches); remove `home/Gauntlet.tsx`
+ its render; refresh How-It-Works copy.
**MUTATE**: Stryker on the changed `src/http` files (`handle-fight.ts`, `fight-report.ts`) — kill
mutants on the compete/practice branch, the `settle` title-vs-projection selection, and the
unplaced-still-commits path. Web: manual mutator scan over the reshaped headline/board logic
(exact-assertion tests).
**KILL MUTANTS**: Strengthen tests for survivors (ask if a survivor's value is ambiguous).
**REFACTOR**: Assess whether `settle` simplifies now that it no longer spreads a report, and whether
`fight-report.ts` should shrink to just the title-fight helper.
**Done when**: ACs met, mutation report clean/justified + web scan recorded, typecheck + lint green
(format only touched files), commit approved.

### Slice 2: The author-facing spec + `llms.txt` describe fighting the champions directly (D16)

**Built as** (this PR): `gen-spec.ts` — overview + `## Benchmark rules` reframed to the sitting-champions
arena (opening reworded; the 6-bot `GAUNTLET_ARCHETYPES` roster + `GAUNTLET_NAMES` use deleted; a new
**The climb** paragraph teaches crowned/entered/unplaced), submit bullets de-gated, header hash gloss
`gauntlet`→`opponents`; `docs/spec.md` regenerated (`INPUT_HASH` + `v20` byte-unchanged). `api/spec.ts`
`/fight` envelope blurb + `web/public/llms.txt` (intro, `/fight`, home bullet) reframed to the arena.
Stale `src/http/README.md` gate line (left by S2.1) corrected. RED = new spec-content assertions + the
`docs/spec.md` byte-drift guard + the `/spec` envelope byte-pin + the `llms.txt` discovery lock; MUTATE
N/A (string assembly). Suite 2258 green; typecheck + lint clean.

**Value**: LLM bot author — the canonical prompt context (`/spec`) and `llms.txt` stop instructing
"clear all six gauntlet opponents" and describe the real path (fight the sitting champions;
out-rank the weakest to enter, beat the King to be crowned), so authored bots target the actual game.
**Path**: `gen-spec.ts` prose → `npm run gen:spec` → `docs/spec.md` (+ prerendered `/spec-guide`,
raw `/spec`); `web/public/llms.txt` edited in place. No engine or handler change.
**Class**: Behavior change (the author-facing contract text is the observable output).
**Required implementation skills**: `tdd`, `testing`; `mutation-testing` **N/A** (string assembly —
alternate evidence: the `docs/spec.md` byte-drift guard `gen-spec.test.ts` + the spec-content
assertions + `spec-schema.test.ts`).
**Reduction program**: N/A.
**Transition/terminal evidence**: N/A.
**Acceptance criteria** (confirm before coding):

- `gen-spec.ts`'s "Benchmark rules", intro, and compete/practice sections no longer describe a
  6-bot clearance gate or "earn a title shot"; they describe fighting the sitting champions and how
  a bot is crowned/entered/unplaced. The WKF match mechanics, seeds, `maxTicks`, move list, and
  frame table sections are unchanged.
- The fixed per-opponent roster listing (the six "gauntlet opponents (archetypes only)" bios) is
  **removed** — the spec names no specific fighters (not even the three House seeds, which are
  transient). In its place the spec describes the climb: a submission fights the sitting champions —
  a live ladder of prior winners — entering by out-ranking the weakest of the top ranks and being
  crowned by reaching #1 / beating the King. Guardrail: no "clear the gauntlet / title shot" gate
  framing and no named fighters (D16).
- `llms.txt` `/fight` + intro blurbs describe the direct-arena fight (no "clear, then projection"
  gate); the home-page "the Gauntlet (reference opponents)" bullet is dropped (the section is gone
  after Slice 1).
- `npm run gen:spec` regenerates `docs/spec.md`; the byte-drift guard passes; `BENCHMARK_VERSION`
  and `INPUT_HASH` are unchanged (no scoring input moved).

**RED / preservation baseline**: Update the spec-content tests (`gen-spec.test.ts` /
`spec-schema.test.ts`) to expect the champions-directly framing and to assert the gate language is
absent; the `docs/spec.md` drift guard goes RED until the doc is regenerated.
**GREEN**: Rewrite the `gen-spec.ts` sections + `llms.txt`; run `npm run gen:spec`.
**MUTATE**: N/A (string assembly) — alternate evidence: the drift guard + spec-content assertions +
the schema test.
**KILL MUTANTS**: N/A.
**REFACTOR**: N/A.
**Done when**: ACs met, spec regenerated, all spec/drift tests green, `INPUT_HASH` unchanged,
typecheck + lint green, commit approved.

### Slice 3: A raw resubmit of a House champion is rejected as a mirror (D17)

**Value**: Bot author / board integrity — resubmitting a seeded House champion unchanged (differing
only by the inert `model`) gets a clear `409 arena-mirror` instead of running a redundant fight and
possibly occupying a board slot with a copy of an existing champion; the seed's variety is protected.
**Path**: `POST /fight` → `handleFight` → `mirrorSlot` compares **scoring content** (doc minus
`model`) against each arena member → 409 for a House clone (and any same-doc copycat under a
different `model`). Http layer only.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing` (http).
**Reduction program**: N/A.
**Transition/terminal evidence**: N/A.
**Acceptance criteria** (confirm before coding):

- Given a seeded arena, a compete whose document equals a member's champion in everything but the
  `model` field is rejected `409 /problems/arena-mirror` naming that member's 1-based slot; nothing
  is written and no benchmark runs.
- A byte-exact resubmit of a real member (same `model`) is still rejected (the model-agnostic check
  is a superset of the byte-exact one).
- A genuinely different bot is unaffected — it competes and is placed as before.
- No engine / `sameDoc` / benchmark change: the `model`-stripping compare lives in `src/http/`.

**RED**: `handle-fight.test.ts` — a seeded arena + a submission equal to a member's champion except
`model` expects a 409 `arena-mirror` at the right slot (fails today: byte-exact `sameDoc` lets it
through); plus a genuinely-different bot still competes.
**GREEN**: In `mirrorSlot` (or a small http-local helper), strip `model` from both sides before the
serialization deep-equal; leave `sameDoc`/the engine untouched.
**MUTATE**: Stryker on `handle-fight.ts` — kill mutants on the model-stripped compare and the
slot-index reporting (off-by-one, wrong side stripped, negative-index guard).
**KILL MUTANTS**: Strengthen tests for survivors.
**REFACTOR**: Assess whether the scoring-content compare deserves a named http helper reused by any
future member-equality check.
**Done when**: ACs met, mutation report clean/justified, typecheck + lint green, commit approved.

## Pre-PR Quality Gate

Before each PR:
1. Mutation (Slices 1 & 3) on the changed `src/http` files; Slice 2 records the `N/A` + alternate
   evidence (drift guard + spec tests). Web (Slice 1): manual mutator scan recorded.
2. Refactoring assessment (`settle` / `fight-report` shrink in Slice 1; mirror helper in Slice 3) —
   `N/A` if no value.
3. `npm run typecheck` + `npm run lint` green; format only touched files (repo has pre-existing
   `format:check` drift — never `prettier --write .`).
4. No DDD glossary in this project — N/A.

## Notes / open facts for implementation

- **Spec roster resolved (2026-07-23):** the spec names no specific fighters — the per-opponent
  roster is removed and replaced with the climb mechanics (see the Slice 2 AC + D16). The
  crowned/entered/unplaced `/ring` headlines + How-It-Works copy already shipped in Slice 1. The
  remaining Slice 2 microcopy (the exact climb wording) is written during implementation with the
  spec in context; guardrail: no "gauntlet" / "clear the gauntlet" / "title shot" wording, no named
  fighters.
- **`/variety` is parked** (Parking Lot, `pure-koth-stories.md`): the board's "frozen gauntlet
  move-usage" framing stays for now — the 6 bots survive as internal tooling + the seed roster (D6),
  so the data is unchanged; a reframe is an optional follow-up, not part of S2.
- **Grep the retirement surface** during Slice 1: confirm nothing outside `handle-fight.ts` imports
  `buildFightReport` / `FightReport` / `FightReportOpponent` before deleting; update `paths.ts`'s
  `FIGHT_PATH` comment ("The gauntlet + King-of-the-Hill title bout") to drop "gauntlet".
- **This plan doc + the design-trail updates (D16/D17, S2 row, Warnings, Parking Lot) ship as one
  `docs(plans)` PR** on `docs/pure-koth-s2-plan`, mirroring how S1's #396 seeded its plan.

---

_Delete this file when the plan is complete (archive it under `docs/archive/` per the project's
"archive, don't delete" convention). If `plans/` is empty, delete the directory._
