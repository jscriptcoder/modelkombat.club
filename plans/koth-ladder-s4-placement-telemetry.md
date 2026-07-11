# Plan: KotH ladder — S4 (placement telemetry — the per-defender board)

**Branches**: `feat/arena-placement-telemetry` (S4.1) → S4.2 branch TBD at the slice
**Status**: Active. **S4.1 ✅ MERGED** (PR #260 — board on `/fight`, additive). **S4.2 code-complete**
(`/ring` renders the per-defender board; web reads only `board`; TDD + manual mutator scan), awaiting
commit approval. **S4.3** (retire the flat scout from `/fight`) next. Slicing split confirmed 2026-07-12.
**Story**: S4 in `plans/koth-ladder-stories.md`. **Design source of truth**: `plans/koth-ladder-decisions.md`
— **C7** (response contract: an arena-placement report at gauntlet fidelity), **D2** (rank key), **D-C**
(the King fight doubles as the title scout).
**Builds on**: S1 arena skeleton + S2 ranked arena (PRs #251–#255) + S3 podium/`/king` read the arena
(PRs #257–#258). The arena round-robin already fights the challenger against **every** defender in
`handle-fight.ts` `roundRobin`, but the response surfaces **only** the King fight
(`kingFight = challengerFights[0]`) as a flat `scout`. S4 generalizes PR #250's single-King title
telemetry (`toTitleFightReport` in `src/http/fight-report.ts`) from **1 King → N defenders**.

## Goal

Every gauntlet-clearing submission — crowned, entered, OR unplaced — sees how its fighter fared against
**each** of the N arena defenders it fought, not just the King: a rank-ordered per-defender board of
`{ defender identity } + { winRate / W-L-D / net / endReasons / degrade }`, at the same fidelity a
gauntlet row carries. Non-placers get the full board too (the PR #250 parity ethos: diagnose _why_,
don't guess from a lone win-rate). Defender **documents are never exposed** — identity only; the ranked
standings are already public via `/king` + podium (C5).

## Non-negotiables (held throughout)

- **Platform-layer only** (`src/http` + its web consumer `web/`). No DSL op, no engine change — **TCB
  untouched** (invariant #2). No `INPUT_HASH` / `BENCHMARK_VERSION` bump.
- **Identity only, never the doc.** Every board/`displaced` entry is `memberIdentity(...)` (name / model
  / handle, control-char sanitized). No defender `champion` / rules / spec leaks into the response.
- **No spec change.** `generateSpec` / `docs/spec.md` is silent on the response `title` block (verified);
  S4 touches neither.
- **The engine's per-fight results are the single source.** The board reads the already-computed
  `challengerFights` (challenger vs each defender) — no re-fight, no recompute; deterministic (#1).

## Response contract (finalized here — C7 left field names to this slice)

The `/fight` `title` block, after S4:

```jsonc
title: {
  outcome: "crowned" | "entered" | "unplaced",   // ranked #1 | ranked #2..N | cleared-but-below-a-full-arena
  rank: 1..N,                                     // present for crowned/entered; ABSENT for unplaced
  board: [                                        // rank-ordered, board[0] = King; [] for the empty-arena bootstrap crown
    {
      defender: { name, model, handle },          // identity only (memberIdentity), never the doc
      winRate, net, wins, losses, draws, bouts,   // the challenger vs THIS defender (per-defender telemetry)
      endReasons, degrade                          // same shape a TitleFightReport carries, per defender
    }
    // ... one entry per defender fought, in arena rank order
  ],
  displaced: { name, model, handle }              // OPTIONAL — only when a full arena shed its weakest to seat the entrant
}
```

- The board entry is `{ defender: ChampionIdentity } & TitleFightReport` — it **reuses** the existing
  `toTitleFightReport` shaper (the #250 parity fields) per defender, so `losses = bouts − wins − draws`
  and the `endReasons` / `degrade` tallies are the same knowledge, derived once.
- `board[0]` **is** the King — so the flat top-level King scout (`...toTitleFightReport(kingFight)` +
  `incumbent`) becomes **redundant** and is retired in S4.2. During S4.1 it stays (additive, non-breaking).

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without a failing test.
Before any code changes for a slice, load `tdd`, `testing`, `mutation-testing`, and `refactoring`.

### Slice S4.1: `/fight` returns the per-defender board (additive)

**Value**: An LLM/API client reading the `/fight` JSON gets full per-defender diagnostics for every
clearer — crowned, entered, or unplaced — instead of a lone King line. Additive to the contract
(the flat King scout stays), so the web `/ring` consumer is untouched and keeps working.
**Path**: `POST /fight` → gauntlet gate → `roundRobin` (already fights challenger vs every defender) →
`handle-fight` threads **all** `challengerFights` out (not only `kingFight`) → a pure board shaper maps
each `(arena.members[i], challengerFights[i])` → `{ defender: memberIdentity(...), ...toTitleFightReport(...) }`
→ `title.board` in the JSON response. Empty-arena bootstrap crown → `board: []` (contract uniformity).
No web change; the flat `scout` + `incumbent` remain for S4.2 to retire.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (present at CONFIRM before any code):

- Given a crowned clearer (non-empty arena, ranks #1), then `title.board` has one entry per defender
  fought, in **arena rank order** (`board[0]` = the King), each entry = that defender's identity
  (name/model/handle) + the challenger's telemetry vs it (winRate/net/wins/losses/draws/bouts/endReasons/degrade).
- Given an `entered` clearer (rank 2..N), then the same full board is present.
- Given an `unplaced` clearer (cleared but ranked below a full arena), then the full board is **still**
  present (the parity ethos) alongside `outcome: "unplaced"`.
- Given the empty-arena bootstrap crown (first-ever champion), then `title.board` is `[]`.
- Given any board entry, then **no** defender document / rules / champion field appears — identity only.
- Given a board over ≥2 defenders, then each entry's per-defender telemetry comes from **its own**
  matchup (board[i] ↔ defender i), not the King's — i.e. `board[1].degrade`/`endReasons`/`net` reflect
  the challenger-vs-defender-1 fight, distinct from `board[0]` (the King).
- Given S4.1, then the existing flat King scout (`title.winRate` / `bouts` / `incumbent` / …) is
  **unchanged** (additive slice — the web still reads it).

**RED** ✅ — 5 board tests in `handle-fight.test.ts`: crowned board (rank-order, King first),
per-defender provenance (`board[i] ↔ defender i`, distinct rows), non-placer full board (identity-only,
no doc leak), empty-arena `board: []`, and flat-scout-coexists (additive). All failed on missing
`title.board`.
**GREEN** ✅ — `roundRobin` now returns `challengerFights` (was only `kingFight`); the board is built
**inline** in `handleFight` as `arena.members.map((m, i) => ({ defender: memberIdentity(m), ...toTitleFightReport(challengerFights[i]) }))`
and added to the three title returns (`board: []` on the empty-arena bootstrap crown).
**MUTATE** ✅ — Stryker over `handle-fight.ts`: **100%** (112 killed, 0 survived, 0 no-cover). No new
`fight-report.ts` code (the board reuses `toTitleFightReport`, whose `losses` derive is already killed).
**KILL MUTANTS** ✅ — none survived.
**REFACTOR** — no extraction: the inline `map` hits 100% mutation via behavioral tests (don't extract
for testability); the `board[0]` / flat-scout overlap is the intentional transient redundancy S4.2 removes.
**Done when**: all ACs met ✅, mutation report reviewed ✅, node (1586) + web suites green ✅,
typecheck/lint clean ✅ — **awaiting commit approval**. (The plan file lands with this PR, per the S3 precedent.)

> **Split confirmed 2026-07-12**: at the CONFIRM gate the planned "render + retire" was split into
> **S4.2 (web render, additive)** + **S4.3 (retire the flat scout, pure `src/http`)** — the web render +
> ~10 fight-card test migrations is a full PR on its own, and mixing it with the contract retirement +
> ~15 node-test migrations couples web+http and muddies review. Render-first is dead-safe (the flat scout
> stays in the response, unused). Mirrors S3.1 (add the new read) → S3.2 (retire the old path).

### Slice S4.2: `/ring` renders the per-defender board (additive read)

**Value**: The human courier at `/ring` sees a per-defender breakdown (all N rows) on the fight card,
not just the King line — the same diagnostic they hand back to the LLM. Additive: the flat scout stays
in the response but is now fully unused by the web (S4.3 removes it).
**Path**: `web/src/RingPage.tsx` — `titleView` reshapes to read `title.board`; `outcomeHeadline` decides
first-King vs dethrone by **board emptiness** (not the flat `incumbent`); the render swaps the single
King scout block for a rank-ordered defender list; `ring.css` swaps `.ring-incumbent`/`.ring-title-*`
for `.ring-defender-*`. After this slice the web reads **only** `board` (+ `outcome`/`rank`).
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (confirmed 2026-07-12):

- Given a crowned/entered/unplaced fight card with a board of N defenders, then `/ring` shows one row
  per defender in board order (board[0] first), each with name + model mark + handle by-line + win-rate
  (%) + beat/lost text (winRate > 0.5 = "beat", never colour alone).
- Given board[0], then its row is marked as the reigning **King** (text marker, not colour alone).
- Given a `crowned` outcome, then the "See the throne" link (`/#king`) shows; `entered`/`unplaced` omit it.
- Given the first-ever crown (`board: []`), then the throne link shows and **no** defender rows render.
- Given the headline, then first-King vs dethrone is decided by board emptiness (empty → "first King").
- Given any row, then no defender document leaks (identity + numbers only); malformed board entries are
  dropped (defensive filter), not rendered as `NaN%` or a crash.
- Given a cleared body with no well-formed board and not crowned, then the title section omits (degrade).

**RED** ✅ — browser-mode `RingPage` tests: N-row board (count + rank order + King marker), rate +
beat/lost incl. the 0.5 → "lost" boundary, per-defender identity (model mark + handle by-line), null
model/handle → generic mark + no by-line, entered/unplaced full board + no crown link, first-crown empty
board, graceful degrade, identity-only DSL-smuggle, and malformed-entry filtering.
**GREEN** ✅ — `readBoard` (sibling of `readIncumbent`) + reshaped `titleView`/`outcomeHeadline` +
`beatLabel` (sibling of `resultLabel`) + the defender-list render + `.ring-defender-*` CSS.
**MUTATE** ✅ — manual mutator scan (web isn't Stryker-reachable): the `> 0.5` threshold, `index === 0`
King flag, graceful-degrade `&&`/`length === 0`, `board.length > 0` headline split, and the defensive
filter are each killed by an exact-assertion test; `readBoard`'s redundant `isRecord` guard is equivalent.
**KILL MUTANTS** ✅ — added the malformed-entry-filter test to demand + pin the defensive drop.
**REFACTOR** — none: the new helpers mirror existing siblings; no duplication.
**Done when**: all ACs met ✅, manual scan reviewed ✅, node + web suites green (**1589**) ✅,
typecheck/lint clean ✅ — **awaiting commit approval**.

### Slice S4.3: retire the redundant flat King scout from `/fight` (pure `src/http`)

**Value**: The `/fight` `title` block simplifies to `{ outcome, rank?, board, displaced? }` — `board[0]`
is the King, so the flat `...toTitleFightReport(challengerFights[0])` spread + top-level `incumbent`
are dead weight. Web already reads `board` (S4.2), so this is a safe, web-invisible cleanup.
**Path**: `handle-fight.ts` drops the `scout` composition from the unplaced + placement returns (keep
`board`); `handle-fight.test.ts` migrates the ~15 flat-scout assertions (the S2.1 incumbent + telemetry
blocks, the unplaced test) to read `board[0]`. Pure platform-layer; no web change.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (present at CONFIRM before any code):

- Given any cleared placement, then `title` has no top-level `winRate`/`net`/`wins`/`losses`/`draws`/
  `bouts`/`endReasons`/`degrade`/`incumbent` — the King fight is read from `board[0]`.
- Given the King telemetry, then `board[0]` still carries it at full fidelity (net / W-L-D / endReasons /
  degrade + identity) — nothing is lost, only de-duplicated.
- Given the empty-arena bootstrap crown, then `title` is `{ outcome: "crowned", rank: 1, board: [] }`.

**RED**: migrate the node `handle-fight` telemetry/incumbent assertions to `board[0]`; add an assertion
that the flat scout keys are absent. **GREEN**: remove the `scout` spread from the two returns.
**MUTATE**: Stryker over `handle-fight.ts` (node) — expect 100%. **REFACTOR**: assess whether the
`scout` local + `toTitleFightReport(challengerFights[0])` call fully retire. **Done when**: ACs met,
mutation 100%, suites green, human approves commit.

## Pre-PR quality gate (each slice)

1. Mutation testing — Stryker over the changed `src/http` files (node project); manual mutator scan for
   any `web/` presentation logic (browser project isn't Stryker-mutable).
2. Refactoring assessment.
3. Typecheck + lint pass. Format **only my own files** (eslint --fix → prettier --write) — leave the
   4 pre-existing `web/` drift files alone.
4. Node + web suites green; `npm run fight` byte-identical (no engine touch — sanity).

## Open questions for the CONFIRM gate

- **Empty-arena bootstrap crown board**: `board: []` (recommended, for a uniform contract) vs omit
  `board` entirely on the first crown. Recommend `[]`.
- **Board field names**: `defender` (identity) + inlined `TitleFightReport` fields vs a nested
  `telemetry: { … }`. Recommend inlined (flat, matches the gauntlet-row ethos), finalized at CONFIRM.
- **`/ring` board columns** (S4.2): identity + win-rate + pass/fail (lean) vs full W-L-D/net/endReasons.
  Recommend lean columns + the raw JSON already copyable for the LLM. Decide at S4.2's CONFIRM.

---

_Archive this file under `docs/archive/` (+ a README entry) when S4 is complete — do not delete
(project convention)._
