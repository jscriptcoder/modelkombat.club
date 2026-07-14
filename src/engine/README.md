# `src/engine/` — the deterministic core

This is ModelKombat's heart: the pure, deterministic combat engine and the **trusted
computing base (TCB)** that keeps LLM-authored bots safe. Everything else in the
repository — the CLI, the HTTP API, the website — is a consumer of this directory. The
engine consumes nothing: no runtime dependencies, no filesystem, no network, no clock,
no `Math.random`.

## The four invariants this directory protects

These are stated canonically in [`../../docs/DESIGN.md`](../../docs/DESIGN.md); every
file here exists to uphold them.

1. **Determinism** — the outcome path is integer / fixed-point only (sub-units, with
   `SCALE = 1000`), driven by a single seeded PRNG. No floats on the outcome path, no
   wall-clock, no ambient randomness ⇒ replays are bit-identical across machines.
2. **Security / TCB** — bots are **data, never code**. The allowlists in
   [`dsl.ts`](dsl.ts) _are_ the security boundary: a bot cannot express an operation
   outside the whitelisted vocabulary, so it cannot touch the host.
3. **Bounded DSL** — no loops, recursion, or I/O in the bot language. Worst-case cost is
   bounded by document size and checked at validation, so no instruction metering is
   needed.
4. **Same pre-tick snapshot** — both fighters decide against the _same_ frozen snapshot
   of tick `T`, then both actions resolve together. No fighter sees the other's
   just-decided move within the same tick.

> ⚠️ **Read the invariants before changing anything here.** A change that could violate
> determinism, widen the TCB, or break replay must be flagged, not merged.

## Files

### The contract

| File                   | Purpose                                                                                                                                                                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`types.ts`](types.ts) | The **single source of truth** for the data contract — the per-fighter `State` the interpreter reads, the `Action` a bot returns, the `MoveId` roster of WKF techniques, and the `Rules` frame table. Grows _additively_ (a new field never invalidates a previously-valid bot). Never redeclare these shapes elsewhere. |

### The trusted computing base

| File               | Purpose                                                                                                                                                                                                                                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`dsl.ts`](dsl.ts) | **The TCB.** The bot AST, the validator, and the interpreter. The field-read allowlist, the op allowlist, the move allowlist, and the document `LIMITS` here are the security boundary. Validate before run; reject with structured errors. Never add an op or field that can reach the host, network, filesystem, time, or randomness. |

### The simulation

| File                   | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`sim.ts`](sim.ts)     | The deterministic fight loop — `runFight`. Runs two already-validated bots on a fixed timestep and emits a bit-reproducible integer event log. Implements the whole combat model: movement, commitment, height-banded guard/block, the perception-latency snapshot, the vertical axis + occupancy, parry / counter / cancel windows, the throw triangle, sweeps + okizeme, air actions, and the stamina economy. Also owns WKF match structure (_yame_ resets, win gap, senshu, overtime). |
| [`prng.ts`](prng.ts)   | The seeded PRNG (mulberry32), returning integer `uint32`s only so nothing on the outcome path touches floats. A single seeded instance threads the whole sim; the same seed yields the same fight.                                                                                                                                                                                                                                                                                         |
| [`rules.ts`](rules.ts) | `CANONICAL_RULES` — the authoritative frame table the platform fights on. Every number is **proven by a behavioral `runFight` test** in `rules.test.ts` (the design inequalities + WKF scoring), not asserted in isolation. Supersedes the old provisional demo rules.                                                                                                                                                                                                                     |

### The scoring & analysis reducers

Pure, read-only reductions over the fights `runFight` produces — they change no outcome,
no DSL op, and cannot move `INPUT_HASH` or the benchmark version.

| File                                         | Purpose                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`benchmark.ts`](benchmark.ts)               | The benchmark aggregator — runs a submitted bot over every (opponent × seed × side) fight and reduces them to the ranking figures (win-rate primary, Σ net-points tiebreak) with a per-opponent breakdown.                                                                                                          |
| [`benchmark-config.ts`](benchmark-config.ts) | The **frozen, versioned benchmark manifest** — the gauntlet roster names, run parameters, `BENCHMARK_VERSION`, and `INPUT_HASH` (a pinned digest of every scoring input). A guard test fails CI if any scoring input drifts without a version bump. A score is only comparable against another at the same version. |
| [`telemetry.ts`](telemetry.ts)               | Variety telemetry — pools every _honoured_ technique commitment across fights into a per-technique usage histogram, answering "is the arsenal broadly used, or collapsing onto a few moves?"                                                                                                                        |

### Tests

Every module has a co-located `*.test.ts` (plus behavior suites like `run-fight.test.ts`,
`perception.test.ts`, and `interpret-tick.test.ts`). Tests are behavior-driven and run
through the public API. The engine is the mutation-tested part of the codebase — see the
per-slice mutation scores logged in [`../../docs/STATUS.md`](../../docs/STATUS.md).

## Design notes

- **Optional `Rules` fields degrade gracefully.** Almost every capability sits behind an
  optional `Rules` field; when it is absent the engine is _byte-identical_ to the engine
  before that capability existed. This is how the combat tree was grown one TDD slice at
  a time without ever breaking replay.
- **The `§11` compute-then-apply union.** Cross-fighter effects (counters, throws,
  finishes) are computed from the frozen pre-tick snapshot and then applied atomically in
  both directions, so the tick stays swap-symmetric regardless of resolution order.

For the full rationale, capability history, and the master inequalities, see
[`../../docs/DESIGN.md`](../../docs/DESIGN.md) and the generated
[`../../docs/spec.md`](../../docs/spec.md).
