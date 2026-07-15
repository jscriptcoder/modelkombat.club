# Plan: `/fight` practice-by-default, compete opt-in

**Branch**: feat/fight-practice-compete
**Status**: Active — Slice 1 COMPLETE (pending commit approval); Slice 2 next

## Goal

Decouple **evaluating** a bot from **mutating the arena** on `POST /fight`: a bare request is a
footprint-free practice run that projects where the bot would land; `X-Compete: true` opts into
actually contesting the throne — and every LLM-facing contract surface teaches this.

## Context / source of truth

Resolved design decisions: `plans/practice-compete-decisions.md` (grill-me, 2026-07-15). This plan
covers the **API + contract-copy** story (grill "slice 1"). The interactive ring two-step UX
(grill "slice 2") is a **separate future plan** — not covered here. Platform-layer only: no DSL op,
no `src/engine/` TCB change, no `INPUT_HASH` / `BENCHMARK_VERSION` bump (invariant #2).

## Deploy-safety constraint (why the slice order is what it is)

The live `/ring` page POSTs `/fight` **without** `X-Compete` today (`RingPage.tsx:45`). If the API
default flips to practice before the ring opts in, the live ring silently stops crowning. And per
the decisions, **no LLM-facing surface may teach a stale flow** once the default flips. So the
default-flip, the ring opt-in, and every contract-copy edit must land in **one atomic PR** (Slice 2).
Slice 1 adds the practice machinery as a pure, backward-compatible **opt-in** (default stays compete),
isolating the projection logic from all that coordination.

## Acceptance Criteria (whole plan)

- [ ] `POST /fight` with no `X-Compete` (final state, after Slice 2) clears the gauntlet and returns a
      `projection` object, and the throne store is **not written** (arena + archive untouched).
- [ ] `POST /fight` with `X-Compete: true` behaves exactly as `/fight` does today — seats/crowns under CAS,
      appends the repro record, returns a `title`.
- [ ] `X-Compete: false` → practice; a non-`true`/`false` value → `400 /problems/malformed-request`.
      Parsing is case-insensitive.
- [ ] A practice run of a byte-identical current arena member still returns `409 /problems/arena-mirror`
      (mirror-reject fires in both modes), with mode-neutral wording.
- [ ] `X-Author-Handle` remains required in both modes.
- [ ] The generated spec (`docs/spec.md` / `/spec` / `/spec-guide` / raw `/spec.md`), `web/public/llms.txt`,
      and `HowItWorks.tsx` (starter prompt, curl, steps) all describe practice-default + `X-Compete: true`.
- [ ] Every intermediate merge is deployable and green; the live ring never stops crowning.

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without a failing test.
Read the project CLAUDE.md + `testing` / `mutation-testing` rules before writing slices.

### Slice 1: An API client can request a footprint-free projection via `X-Compete: false` — ✅ DONE (100% mutation, 148 killed)

**Value**: An API client (LLM tooling) can evaluate a clearing bot without mutating the arena — opt-in for
now, so the change is a pure, reversible addition with zero impact on existing callers or the ring.
**Path**: `POST /fight` + `X-Compete: false` → `readValidatedBot` → `readHandle` → **`readCompete`** (new, strict
parse) → `readArena` → mirror-reject (unchanged, both modes) → `benchmark` gate → **practice branch**: shape the
same round-robin/placement into a `projection` object and return it **without any `commitArena` call**. Default
(no header) and `X-Compete: true` keep the existing compete-and-commit path byte-for-byte. Ring, spec, and all
copy intentionally untouched this slice.
**Required implementation skills**: load `tdd`, `testing`, `mutation-testing`, `refactoring` before code.
**Acceptance criteria** (confirm before coding):
  - `X-Compete: false` + a clearing bot vs a **non-empty** arena → response has `projection: { outcome, rank,
    board, displaced? }`, **no** `title`, and the injected store's `commitArena` is **never called** (spy asserts 0 calls).
  - `X-Compete: false` + a clearing bot vs an **empty** arena → `projection: { outcome: "crowned", rank: 1, board: [] }`,
    no write.
  - `X-Compete: false` + a bot that **does not clear** → the plain gauntlet report, no `projection`, no `title`, no write
    (same as today).
  - `X-Compete: true` and **absent** header → unchanged compete-and-commit behavior (existing tests stay green).
  - `X-Compete: "yes"` (or any non-`true`/`false`) → `400 /problems/malformed-request`; `X-Compete: "TRUE"`/`"False"`
    parse case-insensitively.
  - `X-Compete: false` + a byte-identical current member → `409 /problems/arena-mirror` (mirror still fires).
  - `X-Compete: false` with a missing/blank handle → `400` (handle still required, checked before the compete parse).
**RED**: `handle-fight.test.ts` — drive `handleFight` with an injected idle gauntlet + in-memory store + a
`commitArena` spy. Cases above. Mutator-aware: assert the **exact** `projection` field name and that `title` is
**absent** (kills a "rename projection→title" / "always include title" mutant); assert **zero** `commitArena` calls
(kills a "call commit anyway" mutant); assert the strict parse rejects a near-miss like `"tru"` with 400 (kills a
"substring/truthy match" mutant); assert both `"true"` and `"false"` map correctly (kills a boundary/negation mutant).
**GREEN**: add `readCompete(req)` mirroring `readHandle` (absent/`false`→practice, `true`→compete, else 400,
case-insensitive); thread a `compete: boolean` through the post-gate logic; when `!compete`, build the projection
from the existing `rankArena`/`board` shaping and return, skipping all three commit sites.
**MUTATE**: run `mutation-testing` on `src/http/handle-fight.ts` (the S4 precedent: 100% on this file).
**KILL MUTANTS**: strengthen tests for any survivor; extract a pure `projection`-shaper if it makes a mutant observable
(the PR #250 extract-to-pure lesson).
**REFACTOR**: assess sharing the board/placement shaping between the practice and compete branches (avoid duplication)
— only if it adds value.
**Done when**: all AC met, mutation report reviewed, human approves commit. No copy/ring/spec change in this slice.

### Slice 2: Practice becomes the default, and every contract surface teaches `X-Compete`

**Value**: An LLM (and its human) reading any surface learns the real flow — iterate for free, then claim the throne
— and a bare `/fight` no longer pollutes the ladder. Atomic so no deploy is stale or breaks the ring.
**Path**: flip `readCompete` so **absent → practice** (one line + its tests); update every contract surface **and** the
ring opt-in in the **same PR**:
  - `src/cli/gen-spec.ts` `submitSection()` — rewrite the "clear → title shot" line + curl to teach practice-default +
    `X-Compete: true`; regenerate `docs/spec.md` (drift test forces it).
  - `web/public/llms.txt` — authoring-loop summary (line 7), `POST /fight` blurb (line 17), `/ring` blurb (line 12,
    contract level only).
  - `web/src/pages/home/HowItWorks.tsx` — `starterPrompt()`, `fightSnippet()` curl, `clear-gauntlet` + `challenge-king`
    STEP descriptions.
  - `web/src/pages/ring/RingPage.tsx` — send `x-compete: true` on the existing submit so the web courier keeps crowning
    exactly as today (the ring's interactive two-step UX is the future grill-slice-2 plan).
**Required implementation skills**: load `tdd`, `testing`, `mutation-testing`, `refactoring` before code.
**Acceptance criteria** (confirm before coding):
  - Absent `X-Compete` + clearing bot → `projection`, **no** `title`, no write (the default is now practice).
  - `X-Compete: true` still competes-and-commits (regression stays green).
  - `gen-spec.test.ts` `## Submitting` assertions updated: the section names `X-Compete`, states the default is a
    practice run, and the curl shows the compete header; `docs/spec.md` regenerated and the drift test passes.
  - `ring-discovery.test.tsx` (or the llms.txt content test) asserts the updated `/fight` blurb mentions the practice
    default + `X-Compete`.
  - `HowItWorks.test.tsx` asserts the starter prompt + steps mention `X-Compete: true` / claiming the throne.
  - `RingPage.test.tsx` asserts the POST includes `x-compete: true` (via the injected `postFight`/fetch seam), so the
    courier still crowns.
**RED**: the flipped-default tests in `handle-fight.test.ts` (absent → projection/no-write); exact-string assertions in
`gen-spec.test.ts`, the llms.txt test, `HowItWorks.test.tsx`, and `RingPage.test.tsx`. Mutator-aware for the web/spec
copy (web + scripts are outside Stryker per the repo pattern): exact-assertion + a manual mutator scan; assert the ring
sends the header value `"true"` exactly (kills a "send any/empty value" mutant).
**GREEN**: flip the `readCompete` default; edit the four copy surfaces + regen spec; add the ring header.
**MUTATE**: run `mutation-testing` on `src/http/handle-fight.ts` (the default-flip line); web/spec copy relies on
exact-assertion + manual scan (Stryker excludes `web/**` + `scripts/**`).
**KILL MUTANTS**: address survivors on the API line; manual mutator scan on each copy assertion.
**REFACTOR**: assess only if valuable.
**Done when**: all AC met, mutation report reviewed, every surface consistent, human approves commit.

## Pre-PR Quality Gate (each slice)

1. Mutation testing — `mutation-testing` skill (100% on `handle-fight.ts`, the S4 bar).
2. Refactoring assessment — `refactoring` skill.
3. `npm run typecheck` + `npm run lint` pass; `npm test` green.
4. Format only the files this slice touches (`prettier --write` reflows hand-wrapped live plan docs — do not run repo-wide).

## Out of scope (this plan)

- The interactive ring two-step UX (projection preview → "Claim the throne" button) — future grill-slice-2 plan.
- Placement semantics (join-if-room, per-author slot limits) — decisions doc #8.
- Rate-limiting the practice path — no rate limiting exists today; practice adds no new compute.

---
*Delete this file when the plan is complete. If `plans/` is empty, delete the directory.*
