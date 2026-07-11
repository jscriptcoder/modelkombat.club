# Plan: KotH ladder — S3 (the podium + `/king` show the ranked arena)

**Branches**: `feat/king-arena-podium` → `refactor/retire-single-throne-lineage`
**Status**: Active — product decisions **confirmed 2026-07-11** (podium = **"The Arena"**, full arena with
**King as gold**, spotlighted separately in the hero; **drop the "Gen N" card sub-label** and `generation`
from the `/king` entry contract). **S3.1 ✅ CODE-COMPLETE** on `feat/king-arena-podium` (`/king` + podium
read the ranked arena; 1619 tests green; mutation **100%** on `handle-king` — 26 killed; web presentation
manual-scanned). Awaiting commit + PR. **S3.2** (retire the single-throne lineage + crown path) remains.
**Story**: S3 in `plans/koth-ladder-stories.md`. **Design source of truth**: `plans/koth-ladder-decisions.md`
(C5 — `/king` + podium semantics change; D2 — rank order; C6 — store re-arch).
**Builds on**: S1 arena skeleton (`docs/archive/koth-ladder-s1-arena-skeleton.md`) + S2 ranked arena
(`docs/archive/koth-ladder-s2-ranked-arena.md`, PRs #251–#255). The arena record (`readArena` /
`commitArena`, `ArenaRecord` / `ArenaMember`) already exists and is populated by `/fight`; S3 makes the
**read side** (podium + `/king`) reflect it.

## Goal

A viewer (and any `/king` JSON consumer) sees the **live top-N ranked arena** — King + defenders-in-waiting
by **rank** — instead of the last-N champions by crowning time. This retires the append-only lineage
"bridge" and the prod-unused single-throne crown path, leaving the arena record as the single source of
truth for both the write side (`/fight`) and the read side (`/king` + podium).

## Non-negotiables (held throughout)

- **Platform-layer only** (`src/http` + its web consumer `web/`). No DSL op, no engine change — **TCB
  untouched** (invariant #2). No `INPUT_HASH` / `BENCHMARK_VERSION` bump.
- **Identity only, never the doc.** `/king` and the podium expose `name` / `model` / `handle` — never a
  champion's `champion` doc or `rules` (doc-privacy; scout by behavior, as designed).
- **Store parity is within-slice.** Any change to the `ThroneStore` port extends the in-memory fake **and**
  the Upstash adapter **and** the shared `runThroneStoreContract` **together** (the contract enforces parity).
- **Invariant #1**: no fight tapes stored (the reproduction archive is S5; not in S3).

---

## Confirmed decisions (2026-07-11)

- **P1 — Podium = "The Arena", King as gold.** The `Podium` renders the **full** ranked arena as
  gold/silver/bronze: gold = **King** (arena #1, with a `(King)` marker), silver/bronze = defenders #2/#3.
  The King is **also** spotlighted in the existing `Current King` hero above (deliberate emphasis, matching
  the S3 story AC "gold = King"). Heading text changes **"Hall of Kings" → "The Arena"**.
- **P2 — Drop the "Gen N" sub-label; drop `generation` from the `/king` entry contract.** `ArenaMember`
  has no per-member `generation` (only `seniority`), and the throne CAS token was never meant to be public.
  Each card shows `name` + optional `model` logo + optional `by {handle}` — no generation line. `/king`
  per-entry shape becomes `{ name, model, handle }`; **rank is conveyed by array order** (`current` = #1,
  `recent[0]` = #2, …).
- **P3 — `/king` contract: `current` = arena[0], `recent` = arena[1..] by rank.** `recent` is the
  **defenders** (#2..N) in **rank** order (not crowning time, not reversed). Empty arena → `current: null`,
  `recent: []` (unchanged empty-throne success shape). The podium composes `[current, ...recent]` into the
  three medal slots.
- **P4 — Slice the user-visible move as ONE coherent slice (S3.1).** The endpoint contract change and the
  podium rendering change are coupled: shipping the endpoint first renders the live home page with wrong
  medals/labels; shipping the web first expects a shape the endpoint doesn't serve. So `/king` + podium move
  together. The dead-code retirement (S3.2) is genuinely independent (already zero prod callers) and follows
  as pure cleanup.

---

## Acceptance Criteria (feature-level)

- [x] `GET /king` returns the live arena: `current` = arena[0] identity (`{name, model, handle}`, **no
      `generation`**), `recent` = arena[1..] identities in **rank** order. _(S3.1)_
- [x] Empty arena → `200 { current: null, recent: [] }`; store throw → `503 /problems/throne-unavailable`;
      non-GET → `405`; `cache-control: public, max-age=30` on 200. (All preserved from today.) _(S3.1)_
- [x] The home page podium is headed **"The Arena"** and shows `[King, #2, #3]` as gold/silver/bronze, gold
      marked as King; fewer than 3 members → dimmed `—` placeholders; empty arena → the existing empty state.
      No card shows a "Gen N" line. _(S3.1)_
- [x] No `/king` response or podium card exposes a champion's document. _(S3.1)_
- [ ] The single-throne lineage + crown path (`read` / `recent` / `compareAndSwap` / `CROWN_SCRIPT` /
      `buildCrownRequest` / `interpretCrownReply` / the `commitArena` lineage append) is **removed** from the
      port, fake, Upstash adapter, and shared contract, with the full suite green and the arena path still at
      100% mutation. _(S3.2)_
- [x] No `INPUT_HASH` / `BENCHMARK_VERSION` / TCB change. _(S3.1)_

---

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without a failing test.
Before code changes for a slice, load `tdd`, `testing`, `mutation-testing`, and `refactoring`.

### Slice S3.1 — `/king` + podium show the ranked arena

**Value**: Viewers (and JSON consumers) see the **live ranked arena** — King + defenders by rank — not the
last-N by crowning time. First read-side reflection of the multi-champion ladder S2 made real.
**Path**: `GET /king` → `handleKing` reads `store.readArena(version)` → shapes `current` = arena[0],
`recent` = arena[1..] via `memberIdentity` (identity only) → JSON. `App` fetches `/king` → `King` (hero) +
`Podium` (composes `[current, ...recent]` → gold/silver/bronze, heading "The Arena", `(King)` on gold, no
"Gen N"). Skipped intentionally: dead-code removal (S3.2); per-defender telemetry (S4).
**Files (expected)**: `src/http/handle-king.ts` (read `readArena`, shape via `memberIdentity`, drop
`.reverse()` and `generation`); `src/http/handle-king.test.ts` (reseed via `commitArena`/arena, not
`compareAndSwap`); `web/src/Podium.tsx` (heading "The Arena", compose `[current, ...recent]`, `(King)` marker,
drop `podium-gen`); `web/src/King.tsx` (drop `king-gen`; local `Champion` type drops `generation`);
`web/src/App.tsx` (`KingResponse` view-model unchanged in shape beyond the dropped field; still one fetch);
web `*.test.tsx` (Podium/King/App).
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring` (+ the web browser-mode
convention: exhaustive exact-assertion tests + a manual mutator scan, since `web/` is outside the node-only
Stryker scope).
**Acceptance criteria** (present + confirm before RED):

- `handleKing` over an **empty** arena (`readArena` → undefined) → `200 { current: null, recent: [] }`.
- Over arena `[King]` → `current` = King's `{name, model, handle}` (**no `generation` key**), `recent: []`.
- Over arena `[King, #2, #3]` → `current` = King, `recent` = `[#2, #3]` in **rank** order (a mutation that
  reverses, `slice(0)`s, or time-orders is killed).
- Identity only: a champion whose `champion` doc / `rules` would leak does not appear in the response; a
  control-char-laden name is sanitized (asserted at the `/king` boundary).
- Non-GET → `405` (`allow: GET`); store throw → `503 /problems/throne-unavailable`; `cache-control` on 200.
- Web: `Podium` headed **"The Arena"**; given `current = King` + `recent = [#2, #3]`, renders gold=King with
  a `(King)` marker, silver=#2, bronze=#3, **no** "Gen N" text; given `recent = []` renders gold=King +
  two dimmed `—` slots; given `current = null` renders the existing empty-hall state. `King` hero shows no
  "Gen N". A single `/king` fetch still feeds both; `Retry` from either refetches.
  **RED**: handle-king behavior tests over fake arenas (empty / 1 / 3 members) asserting the exact response
  shape + order + no-`generation`; web browser-mode tests asserting the "The Arena" heading, the composed
  gold=King ordering, the `(King)` marker, the absence of any `Gen`/generation text (exact-string negative
  assertion), and the sparse/empty states. Mutator gaps to pre-empt: `slice(1)` vs `slice(0)`; array order
  (reverse); `members[0]` vs `[1]`; `undefined` → empty vs throw; the `(King)`-only-on-gold conditional.
  **GREEN**: repoint `handleKing` at `readArena`; map with `memberIdentity`; compose the podium; delete the
  generation lines; drop `generation` from the web `Champion` type.
  **MUTATE**: Stryker on `src/http/handle-king.ts` (node scope). Web presentation → manual mutator scan
  (exact-name kills the identity leak; the negative `Gen` assertion kills a re-added generation line; the
  order assertion kills a reversed/duplicated composition).
  **KILL MUTANTS**: strengthen any survivor (ask if a survivor's value is ambiguous).
  **REFACTOR**: assess only if it adds value (e.g. a shared `arenaToKingView` shaper if `handleKing` grows).
  **Done when**: all ACs met; handle-king at 100% mutation; web manual scan clean; typecheck + lint +
  format:check green; you approve the commit. **Note:** the lineage keeps being written (harmlessly, now
  unread) until S3.2 — no removal here.

### Slice S3.2 — retire the single-throne lineage + crown path

**Value**: The arena record becomes the **single source of truth**; the append-only lineage and the
prod-unused single-throne crown path stop existing, shrinking the TCB-adjacent store surface and the Upstash
Lua footprint. No user-visible change.
**Path**: with `/king` off `read`/`recent` (S3.1) and `/fight` never on `compareAndSwap` (since S2), all old
symbols are dead in production. Remove them from the port + fake + Upstash + contract; drop the `commitArena`
lineage append; refactor the one remaining `lineageEntryOf` use off the write path.
**Files (expected)**: `src/http/throne-store.ts` (drop `read` / `recent` / `compareAndSwap` from the port +
fake; drop the `lineageEntryOf` append + `sameKing` gate in `commitArena`; remove `lineage()` from the fake
if unused; keep `readArena`/`commitArena`); `src/http/throne-store-upstash.ts` (delete `CROWN_SCRIPT`,
`buildCrownRequest`, `interpretCrownReply`, `buildReadRequest`/`interpretReadReply`,
`buildRecentRequest`/`interpretRecentReply`, the `read`/`recent`/`compareAndSwap` methods, and the
conditional `RPUSH champions:<v>` + ARGV[3] + `lineageEntryOf` import in `COMMIT_ARENA_SCRIPT` /
`buildCommitArenaRequest`); `src/http/champion-identity.ts` (keep `memberIdentity`; retire
`championIdentity`/`generation` only if fully unused); `src/http/handle-fight.ts` (refactor
`incumbentOf(lineageEntryOf(arena))` → `memberIdentity(arena.members[0])` — identity-preserving); the shared
contract `throne-store.contract.ts` (remove the OLD-path cases + the lineage-bridge assertions inside the
arena cases); `throne-store-upstash.test.ts` + `handle-fight.test.ts` (migrate any `store.read` post-fight
assertions to `readArena`).
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`. This is a
**refactor/removal** slice — TDD evidence is "the suite stays green as dead code is removed" (see the `tdd`
skill's refactoring-commit exception), plus a proof-of-no-callers.
**Acceptance criteria** (present + confirm before code):

- No production or test file references `read` / `recent` / `compareAndSwap` / `CROWN_SCRIPT` /
  `buildCrownRequest` / `interpretCrownReply` / the removed Upstash builders (a repo-wide grep is empty).
- `commitArena` no longer touches any lineage; the Upstash `COMMIT_ARENA_SCRIPT` no longer `RPUSH`es
  `champions:<v>`; `handle-fight`'s incumbent scout is byte-identical (same `{name, model, handle}`) via
  `memberIdentity`.
- The full suite (node + web) is green **unchanged in behavior**; the arena path (`throne-store` fake +
  `handle-fight` + `handle-king`) holds **100% mutation**; the Upstash arena builders keep their
  documented smoke-verified exception.
- `/king` and `/fight` responses are byte-identical to their S3.1 selves (characterization).
  **RED**: none new — this is removal. Guard with a characterization assertion that `/fight`'s incumbent scout
  and `/king`'s response are unchanged across the refactor, plus the empty-grep proof.
  **GREEN**: delete the dead symbols + the lineage append; refactor the one `lineageEntryOf` caller.
  **MUTATE**: re-run Stryker on `throne-store.ts` / `handle-fight.ts` / `handle-king.ts` — arena path stays
  100%; confirm no new survivors from the simplified `commitArena`.
  **KILL MUTANTS**: address any survivor introduced by the simplification.
  **REFACTOR**: this slice _is_ the refactor; assess only incidental readability wins.
  **Done when**: grep-empty of the retired symbols; suite green; arena-path mutation 100%; typecheck + lint +
  format:check green; you approve the commit.

---

## Pre-PR Quality Gate (each slice)

1. Mutation testing — `mutation-testing` (node-only Stryker on the changed `src/http/*.ts`; web presentation
   is manual-scan, per the browser-mode convention).
2. Refactoring assessment — `refactoring`.
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass (format **only my own files** — leave
   the 4 pre-existing web drift files untouched).
4. Confirm no `src/engine` / DSL / TCB change; `INPUT_HASH` + `BENCHMARK_VERSION` untouched.

## Out of scope (later S-slices / roadmap — do not creep in)

- Per-defender placement telemetry board on `/fight` → **S4** (generalizes PR #250 from 1 King to N).
- Last-K reproduction archive → **S5**.
- `/replay` endpoint + Pixi viewer → separate roadmap items.
- Any N beyond the v1 default of 3, and exact K — tunable config, not S3.

---

_Archive under `docs/archive/` when complete (per repo convention — do not delete). The design trail
`plans/koth-ladder-{decisions,stories}.md` stays live until S5 lands._
