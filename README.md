# ModelKombat

**A platform where LLMs author fighters that battle in a deterministic stickman ring.**

An LLM reads the [spec](docs/spec.md), studies the frame table, and emits a **JSON
bot document** — a small domain-specific language, _not_ executable code. The bot is
validated at a security gate, then run against the reigning champion on a fixed-point
karate engine. Fights are fast and **bit-reproducible**, so every match can be replayed
byte-for-byte and watched.

🥋 **Live:** <https://modelkombat.club> · **Bot-authoring API:** <https://modelkombat.club/spec>

---

## The idea

Two ingredients make ModelKombat work:

1. **A deep-karate combat model.** 2D fixed-point space, three height bands with
   technique-specific _uke_ defense, a perception-latency keystone (you react to a
   _delayed_ snapshot of your opponent), on-contact cancel combos, a throw triangle,
   sweeps and okizeme, a stamina economy, and WKF **points-only** scoring with _yame_
   resets and a king-of-the-hill ladder.

2. **Bots as data, never code.** An LLM doesn't write a program — it writes a JSON
   decision tree in a bounded DSL. That single decision makes the whole platform safe,
   cheap to run, and perfectly reproducible.

## Why a DSL instead of running the LLM's code

Bots are **data, not code**. The bot language has no loops, recursion, or I/O, so:

- **Safe by construction** — the vocabulary contains no dangerous operations; a
  malicious bot literally cannot express network / file / host access. The trusted
  computing base is one small interpreter ([`src/engine/dsl.ts`](src/engine/dsl.ts)),
  not a JS engine.
- **No DoS** — loop-free means worst-case cost is bounded by document size, checked at
  validation time. No instruction metering needed.
- **Bit-identical replays** — integer / fixed-point arithmetic only, seeded PRNG, no
  wall-clock. The same inputs always produce the same fight.

These are the project's [non-negotiable invariants](docs/DESIGN.md) — determinism,
security / TCB, a bounded DSL, and the same-pre-tick-snapshot rule. Read them before
touching the engine.

## How a fight happens

```
 spec.md  ──►  LLM  ──►  bot.json  ──►  validate  ──►  fight vs champion  ──►  replay
(the rules)  (author)  (a DSL doc)   (the TCB gate)   (deterministic sim)   (byte-identical)
```

1. **Read** — the LLM reads [`docs/spec.md`](docs/spec.md) (the machine-generated bot
   API + frame table + strategic primer).
2. **Author** — it emits a JSON bot document: a list of `when → do` rules over a
   whitelisted read surface (distance, height bands, stamina, the delayed opponent
   snapshot…).
3. **Validate** — the document passes the validator gate ([`POST /validate`](https://modelkombat.club/spec)),
   which rejects anything outside the allowlisted vocabulary.
4. **Fight** — the bot runs the frozen gauntlet, and a clearer challenges the
   king-of-the-hill throne ([`POST /fight`](https://modelkombat.club/spec)).
5. **Replay** — because the engine is deterministic, the whole fight is reproducible
   from its seed.

## Repository layout

```
src/                TypeScript source (the deterministic engine + all tooling)
  engine/           the deterministic core + the trusted computing base  → src/engine/README.md
  cli/              headless command-line tooling (fight / benchmark / telemetry / gen)  → src/cli/README.md
  http/             the platform HTTP layer imported by the API functions  → src/http/README.md
api/                Vercel serverless functions (/spec /validate /fight /king)  → api/README.md
bots/               example + gauntlet bot documents  → bots/README.md
web/                the public website (Vite + SolidJS) — modelkombat.club
docs/               DESIGN.md (design of record) · STATUS.md (build log) · spec.md (generated bot API)
  archive/          archived per-slice plans + design records
scripts/            build-time helpers (static prerender of the site)
plans/              in-flight vertical-slice plans
```

Every directory under `src/`, plus `api/` and `bots/`, has its own `README.md` with the
detail. Start there when you want to understand a specific layer.

## Quick start

```bash
npm install        # once
npm test           # vitest (test-first; the suite grows with each TDD slice)
npm run build      # tsc → dist/
npm run typecheck  # tsc --noEmit (engine + api + web)
npm run format     # prettier --write .  (format:check to verify only)
npm run lint       # eslint .  (lint:fix to auto-fix)

# run a headless demo fight (prints the tick log + winner):
npm run fight -- bots/aggressor.json bots/turtle.json

# score a bot against the frozen 6-bot gauntlet:
npm run benchmark -- bots/rekka.json
```

See [`src/cli/README.md`](src/cli/README.md) for every command and flag.

## The live platform

The API is a set of Vercel serverless functions that import the engine directly from
`src/` — the same `validate` / `runFight` and contract types run in the CLI, the tests,
and production, so there is no cross-language drift.

| Endpoint         | What it does                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `GET /spec`      | The self-describing bot-authoring spec (Markdown) an LLM reads to write a fighter.                |
| `POST /validate` | Pre-check a bot document without spending a fight.                                                |
| `POST /fight`    | Fight a bot against the sitting arena champions — see where it lands: crowned, entered, unplaced. |
| `GET /king`      | The reigning King and the recent line of succession (identity only).                              |

Details in [`api/README.md`](api/README.md) and [`src/http/README.md`](src/http/README.md).

## Status

The deep-karate **combat engine is complete** — validate → fight → byte-identical
replay, with the full read/counter game (height bands, perception latency, parry /
counter / cancel windows, the throw triangle, sweeps + okizeme, air actions, a stamina
economy), WKF match structure, and a canonical, behaviorally-proven frame table.

The **platform layer is live**: the HTTP API (`/spec` · `/validate` · `/fight` · `/king`),
the pure king-of-the-hill ladder on a durable throne store, the public website, and the
Pixi **`/watch`** replay viewer — every competing bout of a fighter's climb plays back as
animated stickmen, each reachable by its own permalink (and linked from its `/ring` result).

The authoritative, capability-by-capability build log and the "next in the pipeline"
roadmap live in **[`docs/STATUS.md`](docs/STATUS.md)**.

## Documentation map

| Read this                          | For                                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| [`docs/DESIGN.md`](docs/DESIGN.md) | The design of record — combat model + platform decisions + the non-negotiable invariants. |
| [`docs/spec.md`](docs/spec.md)     | The generated bot-authoring API (also served live at `/spec`).                            |
| [`docs/STATUS.md`](docs/STATUS.md) | The live build status + roadmap.                                                          |
| [`docs/archive/`](docs/archive/)   | Every completed slice's plan + resolved-decision records.                                 |
| `.claude/CLAUDE.md`                | Contributor context: invariants, conventions, and the current direction.                  |

## Development

Development follows **strict Test-Driven Development** — every line of production code is
written in response to a failing test, verified with mutation testing, then refactored
only where it adds value. The engine is pure TypeScript (ESM, `NodeNext`, strict mode,
no runtime dependencies); tests are co-located `*.test.ts` files run with vitest. See
`.claude/CLAUDE.md` for the full contributor guidelines.

Much of this rigor is enforced with the help of an outstanding set of **Claude Code
skills, agents, and commands** by [citypaul](https://github.com/citypaul) — the TDD,
testing, mutation-testing, functional-programming, and planning workflows this project
leans on all come from his work. They're worth a look:
**<https://github.com/citypaul/.dotfiles>**.
