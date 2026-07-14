# `src/http/` — the platform HTTP layer

The request-handling logic behind ModelKombat's live API. The Vercel serverless functions
in [`../../api/`](../../api/) are deliberately thin: each one wires its production
dependencies and delegates to a handler here. Keeping the logic in `src/http/` (rather
than in the function files) makes the whole request flow **unit-testable** — the tests
drive these handlers directly with an in-memory throne store and a small fixture gauntlet,
no HTTP server required.

Everything here is pure transport + orchestration over the deterministic
[engine](../engine/). No handler is a DSL op; the trusted computing base (invariant #2)
is never widened by anything in this directory.

## The request flow

```
  POST /fight  ──►  handle-fight.ts
                      │  readValidatedBot        (envelope.ts — method/size/parse/validate gate)
                      │  benchmark() vs gauntlet  (gauntlet.ts — the frozen 6-bot gate)
                      │  arena round-robin        (arena-standings.ts + rank-arena.ts)
                      │  atomic CAS commit        (throne-store*.ts)
                      ▼
                    fight-report.ts  ──►  the /fight response

  GET /king   ──►  handle-king.ts  ──►  ranked arena (throne store)  ──►  identity-only projection
```

## Modules

### Request handlers

The two orchestration seams the API functions wrap. Dependencies (throne store, version,
arena size) are injected so tests can substitute fakes.

| File                                 | Purpose                                                                                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`handle-fight.ts`](handle-fight.ts) | `handleFight` — the `POST /fight` flow: validate → gauntlet gate → arena round-robin → CAS-guarded atomic commit. A bot must clear the frozen gauntlet before it earns a title shot at the king-of-the-hill arena. |
| [`handle-king.ts`](handle-king.ts)   | `handleKing` — the `GET /king` read: an identity-only projection of the version-scoped ranked arena (the King + the defenders in waiting). Stateless and cacheable; it never touches the write path.               |

### King-of-the-Hill ladder (pure, engine-free)

The ranking arithmetic `handle-fight` feeds — extracted so it is unit-testable without
running any fights.

| File                                       | Purpose                                                                                                                                                                                                         |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`arena-standings.ts`](arena-standings.ts) | Reduces the pairwise round-robin scores into each contestant's Copeland win-count + Σ net-points, attributing every bout to both sides. Produces the `Standing[]` that `rank-arena` consumes.                   |
| [`rank-arena.ts`](rank-arena.ts)           | The crowning decision — a strict total-order sort (win-count → net-points → seniority), the keep-top-N cut, and the `crowned` / `entered` / `unplaced` / relegation verdict for a gauntlet-clearing challenger. |
| [`fight-report.ts`](fight-report.ts)       | Reshapes the engine's `BenchmarkResult` into the `/fight` response contract — the per-opponent gauntlet-gate report, plus the single-opponent title-fight telemetry for a challenger.                           |
| [`gauntlet.ts`](gauntlet.ts)               | Loads the frozen 6-archetype gauntlet roster (`bots/<name>.json` at the current `BENCHMARK_VERSION`) through the same validator gate the CLI runner uses — one source of truth for the benchmark opponents.     |

### Throne-store persistence (port + adapters)

A `ThroneStore` port over the top-N ranked arena, with a dev fake and a prod adapter
chosen at startup.

| File                                                   | Purpose                                                                                                                                                                                                                                                         |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`throne-store.ts`](throne-store.ts)                   | Defines the version-scoped `ThroneStore` port (`readArena` / `commitArena` / `readArchive`), its core types (`ArenaMember`, `ArenaRecord`, `ReproRecord`, …), and the **in-memory fake** used as the test / local default.                                      |
| [`throne-store-upstash.ts`](throne-store-upstash.ts)   | The **production adapter** — Upstash Redis over its REST API via raw `fetch` (no SDK). One atomic Lua `EVAL` does compare-generation + set-arena + archive append / eviction, so a commit can never tear.                                                       |
| [`throne-store-select.ts`](throne-store-select.ts)     | `selectThroneStore` — the composition-root wiring that picks the durable Upstash store when a URL + token resolve from the environment (across the several Vercel / Upstash naming schemes), else falls back to the in-memory fake.                             |
| [`throne-store.contract.ts`](throne-store.contract.ts) | `runThroneStoreContract` — a shared, reusable contract-test suite (it emits `it()`s, so it is _not_ a standalone `*.test.ts`). Pins the port's semantics once, run against the fake in the ordinary suite and against live Upstash in the env-gated smoke test. |

### Shared request/response helpers

| File                                           | Purpose                                                                                                                                                                                                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`envelope.ts`](envelope.ts)                   | The shared RFC 9457 request envelope for the POST bot-authoring endpoints — `problem()` (`application/problem+json` responses) and `readValidatedBot()` (method → size → parse → validate intake), reused verbatim by `/validate` and `/fight`. |
| [`champion-identity.ts`](champion-identity.ts) | `memberIdentity` — the single shaper that projects an arena member to its **public** identity (sanitized name + provenance only, never the bot document), behind `/king`'s entries and `/fight`'s board blocks.                                 |

### Tests

Co-located `*.test.ts` files drive the handlers and the pure ladder logic directly. The
Upstash adapter has both a unit test (`throne-store-upstash.test.ts`) and an env-gated
live smoke test (`throne-store-upstash.smoke.test.ts`) that runs the shared contract
against a real Redis.

## Design notes

- **Version-scoped throne.** Everything is scoped to `BENCHMARK_VERSION`. A version bump
  starts a fresh, empty ladder — a new "season" — and never mutates a live competition.
- **Public identity only.** No endpoint ever returns a champion's bot document; a bot's
  DSL is private. `champion-identity.ts` is the one place that enforces this projection.

## See also

- [`../../api/README.md`](../../api/README.md) — the Vercel functions that wrap these handlers.
- [`../engine/README.md`](../engine/README.md) — the deterministic engine + benchmark manifest.
