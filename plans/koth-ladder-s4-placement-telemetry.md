# Plan: KotH ladder — S4 (placement telemetry — the per-defender board)

**Branches**: `feat/arena-placement-telemetry` (S4.1) → S4.2 branch TBD at the slice
**Status**: Active — **S4.1 code-complete** (board on `/fight`, additive; TDD + 100% mutation on
`handle-fight.ts`), awaiting commit approval. S4.2 (web render + retire the flat scout) next.
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

### Slice S4.2: `/ring` renders the board + retire the redundant flat King scout

**Value**: The human courier at `/ring` sees a per-defender breakdown (all N rows) on the fight card,
not just the King line — the same diagnostic they hand back to the LLM. With the web reading the board,
the now-duplicated flat King scout is dropped from the `/fight` contract (`board[0]` is the King),
simplifying the title block to `{ outcome, rank?, board, displaced? }`.
**Path**: `web/src/RingPage.tsx` reads `title.board` and renders a rank-ordered per-defender table
(identity + winRate/W-L-D/net; King row marked) → then `handle-fight.ts` drops the flat
`...toTitleFightReport(kingFight)` spread + top-level `incumbent` (board[0] carries both) → the web
view-model (`TitleScout` / `readIncumbent`) reads the King from `board[0]`.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria** (present at CONFIRM before any code):

- Given a crowned/entered/unplaced fight card, then `/ring` shows one row per defender (identity +
  win-rate + pass/fail), rank-ordered, with the King row distinguished.
- Given the first-ever crown (`board: []`), then `/ring` shows the existing empty/first-crown copy (no
  board rows), and still links to the (now-yours) throne.
- Given S4.2, then the `/fight` `title` block no longer carries the flat King scout fields
  (`winRate`/`bouts`/`incumbent` at the title top level) — the King is read from `board[0]`; the node
  `handle-fight` tests assert their absence.
- Given any rendered row, then no defender document is exposed (identity + numbers only).
  **RED**: browser-mode `RingPage` test — the card lists all N defender rows for a placement, King marked;
  empty-board first-crown path; identity-only. Node `handle-fight` test — the flat scout fields are gone;
  `board` is the sole King source.
  **GREEN**: render the board table in `RingPage`; migrate the view-model to `board[0]`; remove the flat
  scout composition from `handle-fight`.
  **MUTATE**: Stryker over `handle-fight.ts` (node); manual mutator scan for the web presentation (browser
  project isn't Stryker-mutable — exhaustive exact-assertion + manual scan, per house rule).
  **KILL MUTANTS**: address survivors; manual scan kills the aria/identity-leak + empty-copy mutants.
  **REFACTOR**: assess the `RingPage` view-model now that the King reads from `board[0]`.
  **Done when**: all ACs met, mutation report reviewed, node + web suites green, typecheck/lint clean,
  human approves commit.

**Sub-split lever (decide at S4.2's CONFIRM gate)**: if "render the board" + "retire the flat scout"
proves too big for one PR, split into **S4.2 render** (web reads `board`, ignores the still-present flat
scout) → **S4.3 retire** (pure `src/http` removal of the flat scout, web already migrated) — mirroring
S3.1 → S3.2. Recommended default is the single coupled slice (the web is the only consumer; migrating it
and dropping the dead field is one coherent "the board is the title card's source of truth" change).

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
