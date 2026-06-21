# BotBout — Claude Code context

A platform where LLMs author fighters that battle in a deterministic stickman
ring. An LLM reads the spec + frame table, emits a **JSON bot document** (a DSL,
not code), submits it through a validator gate, and the engine runs it against a
prior winner. Fights are fast and **bit-reproducible** so they can be replayed.

## Current design direction (READ FIRST)

The project is taking the **"go deep" karate** path. The authoritative, current
design lives in **`docs/COMBAT-DESIGN.md`** (combat model — 2D fixed-point space,
3 height bands + technique-specific *uke* defense, on-contact cancel combos, WKF
**points-only** scoring with *yame* resets, king-of-the-hill ladder, all-TS
platform) and **`docs/BOT-DSL-v2.md`** (the v2 bot API). These **supersede** the
lean 4-move baseline still described in `docs/DESIGN.md`, `docs/BOT-DSL.md`, and
the current engine source (`types.ts`/`rules.ts`/`dsl.ts`) — that code is the
historical baseline to be reworked for the deep model. Design tree is resolved;
next is `story-splitting` → `planning` → TDD build.

## Non-negotiable invariants

These protect determinism, replay, and security. Do not violate them when
generating code; flag any change that would.

1. **Determinism.** Fixed timestep; one `runTick` per fighter per tick. A single
   **seeded PRNG** threads the whole sim — no `Math.random`, no `Date.now`, no
   wall-clock. **Integer / fixed-point math only** in anything that affects
   outcomes (position, velocity, stamina, score). Floats in the outcome path break
   cross-platform replay. Trig/FK and ragdoll are **render-layer only** (the
   non-authoritative side of the seam).
2. **Security / TCB.** Untrusted bots are **data, never code.** Never run
   LLM-authored JS. The trusted computing base is `packages/engine/src/dsl.ts`
   (validator + interpreter). Never add a DSL op that can touch the host,
   network, filesystem, time, or randomness. The allowlists in that file ARE the
   security boundary. Validate before run; reject with structured errors.
3. **Bot DSL is bounded.** Loop-free and recursion-free ⇒ worst-case cost is
   bounded by document size, enforced by `LIMITS` at validation time. No
   instruction metering needed. Keep it that way.
4. **Same pre-tick snapshot.** Both fighters' `runTick` read one immutable
   snapshot of tick T; resolve both actions together afterward. Perception
   latency is served from a per-fighter history ring buffer as a single coherent
   delayed snapshot (never mix fresh + stale fields).

## Architecture

- `packages/engine` (TypeScript) — the deterministic core. Pure, no I/O.
  - `src/types.ts` — shared contract: state schema, action grammar, Rules. Single
    source of truth; do not redeclare these types elsewhere.
  - `src/dsl.ts` — **the TCB.** Bot AST, validator, interpreter (`validate`,
    `runTick`, `safeParse`, `LIMITS`).
  - `src/rules.ts` — `DEFAULT_RULES` frame table (lean baseline; to be reworked
    for the deep karate frame table per `docs/COMBAT-DESIGN.md`).
  - `src/sim.ts` — deterministic fight loop. **STUB.** Invariants documented at
    the top of the file.
- `services/api` (**all-TypeScript**) — orchestration, not yet built. Imports
  `@botbout/engine` directly (shared contract types; no cross-language seam).
  Endpoints: `POST /fighter` (validate + store), `POST /fight` (vs champion),
  `GET /replay/:id`, `GET /spec`.
- `tools/frame-lab` — React tuner for frame-data vs perception-latency. Dev tool.
- (planned) replay/fight **viewer** — Vite + Pixi + SolidJS, reusing Pixel Fist's
  stick-figure rig + FK as a derived (non-authoritative) render layer.
- `scripts/selftest.mjs` — zero-dependency smoke test of validator + interpreter.

## Stack & conventions

- Engine: TypeScript, ESM (`NodeNext`), strict mode, no runtime deps. Tests via
  vitest.
- **Platform: all-TypeScript** (API imports `@botbout/engine`). Viewer: Vite +
  Pixi + SolidJS. Deploys on Vercel.
- Prefer pure functions in the engine. Keep the DSL vocabulary small.

## Status

- DONE (design): deep-karate combat tree + v2 DSL resolved →
  `docs/COMBAT-DESIGN.md`, `docs/BOT-DSL-v2.md`.
- BASELINE (to rework for the deep model): `types.ts`, `rules.ts`, `dsl.ts`,
  `examples/footsie-spacer.json`, `tools/frame-lab` — the lean 4-move v1.
- NEXT: `story-splitting` → `planning` for the first vertical slice, then TDD
  build (deep frame table + 2D sim loop + telemetry result object + viewer).

## Commands

```bash
node scripts/selftest.mjs              # zero-install smoke test
cd packages/engine && npm install      # then:
npm run build                          # tsc
npm test                               # vitest
```

**Current design source of truth:** `docs/COMBAT-DESIGN.md` (deep karate combat +
platform) and `docs/BOT-DSL-v2.md` (v2 bot API / LLM prompt context). The lean
baseline `docs/DESIGN.md` (master inequalities, perception-latency rationale) and
`docs/BOT-DSL.md` remain useful for the keystone reasoning that still holds.
