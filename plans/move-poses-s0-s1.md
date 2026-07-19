# Plan: Move poses — S0 (move identity on the tape) + S1 (a kick renders with a foot)

**Branch**: `feat/move-poses-s0-fields` (slice 1), `feat/move-poses-s1-kick` (slice 2)
**Status**: Active

Child stories S0 + S1 from `plans/move-poses-stories.md`. Decisions 1–10 and mechanics M1–M11
are resolved in `plans/move-poses-decisions.md` — **do not re-litigate them here**.

## Goal

A spectator watching a replay sees a `mae-geri` thrown with a **foot** instead of a hand — the
first move in the arsenal with its own look, delivered through the real production path.

## Acceptance Criteria

- [x] The render tape carries which move a fighter committed to, and which phase of it they are in
      _(slice 1)_
- [x] Committing a move never changes a fight's outcome: determinism/replay tests stay green and
      `BENCHMARK_VERSION` remains `v19` (M11) _(slice 1)_
- [ ] A `mae-geri` in its active window draws its **front foot** at the mid band, with the front
      hand left at stance
- [ ] The drawn foot still tracks the real opponent distance — two different gaps produce two
      different foot positions (the S5 reach-to-target property is preserved)
- [ ] A move with no descriptor yet (any of the other 12) still draws today's generic pose

## Slices

Two slices, two PRs. Slice 1 is `src/`-only and **Stryker-reachable** ⇒ real mutation testing.
Slice 2 is `web/`-only and **not Stryker-reachable** ⇒ mutation `N/A` with the project's
established alternate evidence (exhaustive exact-assertion tests + a manual mutator scan +
`/dojo` visual sign-off), exactly as every prior `web/` slice has done.

---

### Slice 1: The render tape carries which move a fighter committed to, and which phase of it

**Value**: A viewer (and `/dojo`) can distinguish `mae-geri` from `gyaku-zuki` at all, and tell a
wind-up from a committed extension. Nothing renders differently yet — this slice's own value is
**validation**: it proves a move id can be threaded through committed state without touching the
outcome path. If it can't, the whole arc's design is wrong and we learn it here for one PR.
**Path**: bot `{type:"attack", move, band}` → `interpretTick` commit → `AttackingState` carries the
id → `renderFrame` emits it → `RenderTape` → `/replay` JSON → web `ReplayFrame` mirror.
**Class**: Behavior change (the render tape's observable output gains two fields).
**Required implementation skills**: `tdd`, `testing`, `mutation-testing` (src is Stryker-reachable),
`refactoring` (assess after green).
**Reduction program**: `N/A`.
**Transition/terminal evidence**: `N/A`.

**Acceptance criteria** _(present and confirm before writing code)_:

1. Given a bot committing `{type:"attack", move:"gyaku-zuki", band:"mid"}`, when the tape renders,
   the frames during the commitment carry `attackMove: "gyaku-zuki"`.
2. Given a committed move with `startup: 7, active: 3`, when the tape renders, `attackPhase` is
   `1` while `elapsed < 7`, `2` at `elapsed 7..9`, and `3` from `elapsed 10` onward (M1 encoding,
   M5 boundary rule).
3. Given a fighter in `neutral`, `airborne` (no attack), or `downed`, when the tape renders, the
   frame carries `attackMove: ""` and `attackPhase: 0`.
4. Given a `{type:"sweep"}` commitment, when the tape renders, `attackMove` is `"sweep"`; given
   `{type:"throw"}`, it is `"throw"`; given an airborne `tobi-geri`, it is `"tobi-geri"` (M2's
   per-state coverage table, TOTAL).
5. Given the full suite, when this slice lands, determinism/replay tests pass **and**
   `BENCHMARK_VERSION` is unchanged at `v19` (M11).

**RED**: New behaviour tests in `src/engine/render-tape.test.ts` driving `renderTape` over small
bot/rules fixtures — one per acceptance criterion above. Boundary cases are written **first and
explicitly** (`elapsed === startup` ⇒ `2`, `elapsed === startup + active` ⇒ `3`), because the
phase derivation is two comparisons and the `<`/`<=` boundary mutants are the ones most likely to
survive (see the `mutation-testing` skill's mutator rules).

**GREEN**, the minimum change:

- `MoveState`: `attacking` and `air-attacking` each gain `move: string`.
- `startAttack(spec, band, move)` — 3 call sites: the cancel path (`sim.ts:599`, `action.move`),
  the neutral commit (`sim.ts:646`, `action.move`), and the sweep (`sim.ts:661`, the literal
  `"sweep"`).
- `startAirAttack(spec, band, vy, vx, move)` — 1 call site (`sim.ts:622`, `action.move`).
- **A FIFTH site this plan originally missed** (found during RED): the air-strike **landing
  conversion** (`sim.ts:1040-1052`) builds an `attacking` state as an object literal rather than
  via `startAttack`, so it must carry `move: st.move` or a landed `tobi-geri` loses its identity
  through its grounded recovery. TypeScript forces the fix; a test pins that it is `st.move` and
  not `""`.
- `throwing` needs **no** threading: `kind === "throwing"` already implies `"throw"` at the render
  site. Same for `neutral` / `airborne` / `downed` ⇒ `""`.
- `RenderFrame` gains `attackMove: string` + `attackPhase: number`, emitted in the same object
  literal that already computes `attackReach` (`sim.ts:285-290`) and reusing its existing state
  branches.
- Web mirror: `replay-contract.ts` gains `attackMove?: string` and `attackPhase?: number`,
  optional and read defensively (M2, M7) — the loader casts the wire wholesale.

**MUTATE**: Run Stryker on `src/engine/sim.ts`. Expect survivors concentrated on the phase
comparisons and the state-branch ternaries.
**KILL MUTANTS**: Strengthen the boundary tests. Ask before killing any mutant whose value is
ambiguous (e.g. an unreachable state combination).
**REFACTOR**: Assess whether phase derivation wants extraction as a named pure helper alongside
`BAND_CODE`/`POSTURE_CODE`. Only if it reads better — the prior arc's lesson is that extraction is
worth it when it forces both branches of a shared rule to be exercised.

**Done when**: all five criteria met, Stryker report presented, `BENCHMARK_VERSION` verified
unchanged, and the human approves the commit.

**Outcome (2026-07-19)** — all five criteria met. Full suite 2069 passed / 0 failed, including the
determinism + replay-byte-identity tests; `BENCHMARK_VERSION` unchanged at `v19` and
`benchmark-config.ts` untouched, so **M11's gate holds: the move id did not leak into the outcome
path.** Scoped Stryker on the changed logic: **95.45%, 42 killed / 2 survived**, both survivors
the _equivalent_ `rules.throw?.x → rules.throw.x` pair — unreachable because `sim.ts:748` returns
`"inert"` when `rules.throw` is undefined, so a `throwing` state cannot exist without it (the `?.`
is required by the optional type, not by any reachable state; the adjacent `attackReach` line
carries the identical pattern). The first pass scored 81.82% with 6 real survivors, all from
asserting a throw's and an air strike's _id_ but never their _phase_ — killed by two added tests.

Two incidental fixes rode along: `vitest.node.config.ts` gained `testTimeout: 30_000` (the
gauntlet-driving `gen-variety` tests run ~1s plainly but overran vitest's 5s default under
Stryker's instrumentation, failing the mutation dry run), and the phase derivation was pinned to
the engine's OWN active-window inequality (`sim.ts:802-803`) because a rendered frame's `elapsed`
is already advanced — see the timing note atop the test block.

---

### Slice 2: A `mae-geri` draws its front foot instead of its front hand

**Value**: A spectator sees a front kick as a **kick** — the first move in the arsenal with its own
look. Burns the arc's riskiest assumption: that a foot can be driven through the same
`reachTargetX` solver as a hand, with the knee re-deriving off `hip→footR` and the support leg
staying planted.
**Path**: tape `attackMove` → `scene()` descriptor lookup → `poseFor` drives `footR` → `scalePose`
→ `figures.ts` strokes it → visible in `/dojo` and on `/watch`.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `refactoring`. `mutation-testing` is **`N/A`
by tooling** — `web/` is outside Stryker's reach; alternate evidence is exhaustive
exact-assertion `.test.tsx` tests + a manual mutator scan + a `/dojo` visual sign-off, the
standing convention for every `web/` slice in this repo.
**Reduction program**: `N/A`.
**Transition/terminal evidence**: `N/A`.

**Scope note — phase is deliberately NOT consumed here.** S0 emits `attackPhase`, but this slice
ignores it and draws the descriptor's driven endpoint whenever the fighter is attacking. So a kick
still holds its extension for the whole commitment, exactly as a punch does today — strictly
better than now, and it keeps the risky foot-solver question unentangled from the chamber work.
Phase consumption is **S2**.

**Acceptance criteria** _(present and confirm before writing code)_:

1. Given the challenger committed to `mae-geri` in range, when the scene renders, `footR` is the
   driven endpoint at the mid band and `handR` remains at its stance position.
2. Given the same, when the scene renders, `footL` is unchanged from its stance position
   (M8.2 support integrity — the fighter neither slides nor floats).
3. Given two different fighter gaps, when each renders, the driven `footR.x` differs
   (M8.5 — the reach-to-target solve is retained, not replaced by a constant).
4. Given `attackMove: "gyaku-zuki"` (no descriptor yet), an unknown string, or `""`, when the
   scene renders, today's generic front-hand pose draws (M7 fallback, TOTAL).
5. Given a rendered `mae-geri`, when the scene renders, `kneeR` lies off the straight
   `hip → footR` line (M8.6 — the leg reads jointed at its new position).
6. Given `/dojo` on first load, when the page renders, the challenger throws a `mae-geri`
   (`DEFAULT_CHALLENGER_CONTROLS.attackMove`, M7).

**RED**: Behaviour tests in `web/src/pages/replay/scene.test.tsx` — note the extension: the web
vitest project includes only `src/**/*.test.tsx` (`web/vitest.config.ts:13`), so a `.test.ts`
file would silently never run. Assertions follow M8: **relations, not tuned literals**, so the
descriptor's numbers stay free to retune without breaking a test.

**GREEN**, the minimum change:

- New `web/src/pages/replay/move-descriptors.ts`: the descriptor table + its type, with one
  entry (`mae-geri`) naming its driven endpoint. Aesthetic data only — deliberately **not**
  merged with `reach-presets.ts`, which is an engine mirror with the opposite test discipline
  (decision 10).
- `scene.ts`: the committed-strike layer looks up the descriptor and applies the solved position
  to the **driven** endpoint rather than hard-coding `handR`. `reachTargetX` and `deriveBend` are
  reused unchanged.
- `controls.ts`: `DEFAULT_CHALLENGER_CONTROLS` gains `attackMove: "mae-geri"`;
  `DEFAULT_KING_CONTROLS` gains `""`.
- The decision-10 key-set coverage test, asserting `move-descriptors.ts`, `reach-presets.ts` and
  `Arsenal.tsx` cover the same move ids.

**MUTATE**: `N/A` (tooling). Alternate evidence: a manual mutator scan over the new descriptor
lookup and the driven-endpoint application, plus a `/dojo` visual sign-off confirming the kick
reads as a kick.
**KILL MUTANTS**: `N/A` — surviving-mutant analysis replaced by the manual scan above.
**REFACTOR**: Assess whether the strike/throw/guard layers in `poseFor` now want a shared
"apply a driven endpoint" helper, or whether that is premature with one descriptor.

**Done when**: all six criteria met, manual mutator scan recorded, `/dojo` signed off visually,
and the human approves the commit.

## Pre-PR Quality Gate

Before each PR:

1. Mutation evidence — Stryker report (slice 1) or the recorded manual scan + visual sign-off
   (slice 2)
2. Refactoring assessment — run `refactoring`; record `N/A` if nothing adds value
3. `npm run typecheck` and `npm run lint` pass
4. `npm test` passes — **note there is no CI test workflow in this repo** (Vercel build/deploy
   only), so this gate is local-only and must not be skipped
5. `npm run format:check` passes
6. Slice 1 only: `BENCHMARK_VERSION` verified unchanged at `v19` (M11)
7. DDD glossary check — `N/A`, this project does not use a DDD glossary

---

_When both slices land, **archive** this file under `docs/archive/` and add an entry to the
archive [`README.md`](../docs/archive/README.md) — this repo archives completed plans rather than
deleting them (overrides the planning skill's default footer)._
