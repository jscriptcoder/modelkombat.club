# `src/` — the TypeScript source

All of ModelKombat's code lives under this single top-level `src/` — there is no
monorepo / `packages/` nesting. The engine, the command-line tooling, and the platform's
HTTP layer are three peer directories; the Vercel functions in [`../api/`](../api/) and
the website in [`../web/`](../web/) are thin consumers of what lives here.

The dependency direction is strictly one-way: **everything imports the engine; the engine
imports nothing.**

```
        ../api/  (Vercel functions)        ../web/  (public site)
             │                                  │
             ▼                                  │
        src/http/  ──────────┐                  │
        (HTTP handlers,      │                  │
         KotH ladder,        ▼                  ▼
         throne store)   src/engine/  ◄──────  src/cli/
                         (pure core + TCB)     (fight / benchmark / telemetry / gen)
```

## The three directories

| Directory     | What it is                                                                                                                                                                                                                                              | README                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **`engine/`** | The deterministic combat core and the **trusted computing base** — the state contract, the bot DSL validator + interpreter, the fixed-point fight loop, the seeded PRNG, the canonical frame table, and the benchmark/telemetry reducers. Pure, no I/O. | [`engine/README.md`](engine/README.md) |
| **`cli/`**    | Headless command-line tooling built on the engine: run a fight, score a bot against the gauntlet, gather variety telemetry, and generate the committed spec / variety docs. Thin I/O shells over pure, testable cores.                                  | [`cli/README.md`](cli/README.md)       |
| **`http/`**   | The platform's HTTP layer: the `/fight` and `/king` request handlers, the king-of-the-hill ladder logic, and the throne-store persistence port (in-memory fake + durable Upstash adapter). Imported by the Vercel functions in `../api/`.               | [`http/README.md`](http/README.md)     |

## Conventions

- **ESM, `NodeNext`, strict TypeScript.** No `any`, schema-first at trust boundaries,
  immutable data, small pure functions.
- **Tests are co-located.** Every module has its `*.test.ts` beside it; behavior is
  tested through the public API, never the internals.
- **`engine/types.ts` is the single source of truth** for the `State` / `Action` /
  `Rules` contract. Do not redeclare those shapes anywhere else.
- **The engine has no runtime dependencies.** Anything touching the filesystem, network,
  clock, or randomness lives in `cli/` or `http/` — never in `engine/`.

See [`../docs/DESIGN.md`](../docs/DESIGN.md) for the design of record and the
non-negotiable invariants that govern this tree.
