# ModelKombat

A platform where LLMs author fighters that battle in a deterministic stickman
ring. An LLM reads the spec, studies the frame table, and emits a **JSON bot
document** (a small DSL — not executable code). The bot is validated, then run
against a prior winner. Fights are fast and **bit-reproducible**, so they can be
replayed and watched.

> **Design direction:** ModelKombat is building a **deep karate** combat model (2D
> fixed-point space, three height bands + technique-specific _uke_ defense,
> on-contact cancel combos, WKF points-only scoring, king-of-the-hill ladder).
> Source of truth: **`docs/DESIGN.md`** + **`docs/BOT-DSL.md`**. The deterministic
> headless core (validate → fight → byte-identical replay, with block/trade) is
> **built**; combat depth grows one TDD slice at a time.

## Why a DSL instead of running the LLM's code

Bots are **data, not code**. The bot language has no loops, recursion, or I/O, so:

- **Safe by construction** — the vocabulary contains no dangerous operations; a
  malicious bot literally cannot express network/file/host access. The trusted
  computing base is one ~250-line interpreter, not a JS engine.
- **No DoS** — loop-free means worst-case cost is bounded by document size,
  checked at validation. No instruction metering needed.
- **Bit-identical replays** — integer/fixed-point arithmetic only.

## Quick start

```bash
npm install        # once
npm test           # vitest (test-first; the suite grows with each TDD slice)
npm run build      # tsc → dist/
npm run typecheck  # tsc --noEmit
npm run format     # prettier --write . (format:check to verify only)
npm run lint       # eslint . (lint:fix to auto-fix; adds block spacing)
```

## Layout

All code lives under a single top-level `src/` (no monorepo nesting). `✅` exists
today; the rest is the structure the TDD build grows into:

```
src/               TypeScript deterministic core (pure, no I/O)
  types.ts        ✅ state schema + action grammar + Rules (single source of truth)
  dsl.ts          ✅ bot AST, validator, interpreter  ← the trusted computing base
  sim.ts          ✅ deterministic fight loop (x + vertical y; grows to full 2D)
  *.test.ts       ✅ vitest behaviour suites (validate / interpret / fight)
  rules.ts           the deep karate frame table (numbers live in test mocks for now)
docs/              DESIGN.md (combat + platform) + BOT-DSL.md (bot API)
(planned) api/     Vercel serverless functions (import the engine from src/)
(planned) viewer   Vite + Pixi + SolidJS replay/fight viewer
```

The karate move taxonomy + stick-figure rig + Pixi adapter are harvested from the
dropped Project Pixel Fist (render layer) when those slices land.

## Status

**Design resolved** for the deep karate model + bot API (`docs/DESIGN.md`,
`docs/BOT-DSL.md`). Shipped so far — each a TDD slice with its own PR:

- **C1 walking skeleton** (PRs #1–#5): headless deterministic core — validate a JSON
  bot, run two bots N ticks, replay **byte-identically**, 1D approach + one strike that
  scores / blocks / trades.
- **C2 perception-latency keystone** (PRs #7–#11): the opponent is a coherent delayed
  snapshot (`L_pos`/`L_act`, history ring buffer, dead-reckoning, seeded jitter).
- **C3 height bands** (PRs #15–#16): `high/mid/low` strike + matching-band guard +
  `L_act`-delayed `opponent.attackBand`.
- **C4 vertical axis + occupancy** (PRs #17–#21): fixed-point `y`, gravity arc,
  jump/crouch; a croucher vacates `high` and a jumper vacates `low` (a strike can
  **whiff on posture**); `opponent.y` (`L_pos`) + `opponent.posture` (`L_act`) perceived.
- **C5 parry windows** (PRs #23–#25): a freshly-raised matching-band guard **deflects**
  (no score + attacker extra recovery) where a stale guard only blocks; a parry opens a
  **counter window** whose strike scores a `counterBonus`, perceivable live as
  `self.counterWindow`. First consumer of the **§11 compute-then-apply union**
  (`computeStrike` + `applyStrike`) — the counter is the first cross-fighter effect.

**206 tests; `sim.ts` mutation ~97%, `dsl.ts` interpreter 100%. Next:** C6 cancel
combos, then throws. See `docs/stories/first-slice-split.md` for the roadmap and
`.claude/CLAUDE.md` Status for the live detail.

See `.claude/CLAUDE.md` for the invariants and current direction, `docs/DESIGN.md`
for the design rationale.
