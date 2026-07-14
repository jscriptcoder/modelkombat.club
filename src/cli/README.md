# `src/cli/` — headless command-line tooling

The command-line surface of ModelKombat. These tools run the [engine](../engine/) from
your terminal: play a fight, score a bot against the frozen gauntlet, gather arsenal
telemetry, and generate the committed documentation. They are how you exercise the engine
without the HTTP platform.

## The pattern: thin shell over a pure core

Every command follows the same shape so the interesting logic stays testable:

- A **thin entry point** (`fight.ts`, `benchmark.ts`, …) owns the messy edges — argument
  parsing, filesystem reads, `stdout` / `stderr` writes, and the process exit code. It
  does no real work of its own.
- A **pure core** (`run-benchmark.ts`, `run-telemetry.ts`, the `gen-*.ts` generators)
  takes injected dependencies and returns a plain `{ stdout, stderr, code }` (or a
  string) — no process, no ambient I/O — so it can be driven directly in tests.

Exit codes follow the Unix convention: `0` success, `1` a handled failure (e.g. a
rejected bot), `2` bad usage.

## Commands (npm scripts)

| Command                              | Entry point                            | What it does                                                                                                                                                                                                    |
| ------------------------------------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run fight -- <a.json> <b.json>` | [`fight.ts`](fight.ts)                 | Loads two bot documents through the validator gate, runs them head-to-head on `CANONICAL_RULES`, and prints the tick log + result.                                                                              |
| `npm run benchmark -- <bot.json>`    | [`benchmark.ts`](benchmark.ts)         | Scores a bot against the frozen 6-bot gauntlet (every opponent × seed × side) and prints the ranking report. Also accepts `--from-reply <reply.txt>` to extract the bot JSON straight out of a raw model reply. |
| `npm run telemetry`                  | [`telemetry.ts`](telemetry.ts)         | Runs the gauntlet's both-sides round-robin and prints the pooled move-usage histogram over the technique roster.                                                                                                |
| `npm run gen:spec`                   | [`write-spec.ts`](write-spec.ts)       | Writes the generated bot-authoring spec to [`docs/spec.md`](../../docs/spec.md).                                                                                                                                |
| `npm run gen:variety`                | [`write-variety.ts`](write-variety.ts) | Writes the generated variety board to [`docs/variety.md`](../../docs/variety.md).                                                                                                                               |

The generated docs (`docs/spec.md`, `docs/variety.md`) are **committed** and pinned to
the generator output by a byte-for-byte drift test — so regenerate and commit them
whenever their inputs change.

## Modules

### Entry points (imperative shells)

| File                                   | Role                                                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [`fight.ts`](fight.ts)                 | Fight-runner shell: arg parsing, bot loading, stream writes, exit codes.                                          |
| [`benchmark.ts`](benchmark.ts)         | Benchmark shell: wires the real filesystem + frozen manifest, delegates to `run-benchmark.ts`.                    |
| [`telemetry.ts`](telemetry.ts)         | Telemetry shell: defers the gauntlet load so an unreadable roster fails cleanly, delegates to `run-telemetry.ts`. |
| [`write-spec.ts`](write-spec.ts)       | Writes `generateSpec()` output to `docs/spec.md`.                                                                 |
| [`write-variety.ts`](write-variety.ts) | Writes `generateVariety()` output to `docs/variety.md`.                                                           |

### Pure cores & helpers

| File                                     | Role                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`run-benchmark.ts`](run-benchmark.ts)   | The testable core of `npm run benchmark` — takes argv + injected deps, returns `{ stdout, stderr, code }`, renders the ranking table.                                                                                                                                                                         |
| [`run-telemetry.ts`](run-telemetry.ts)   | The testable core of `npm run telemetry` — resolves the population (frozen gauntlet by default, or supplied override paths) and reduces it.                                                                                                                                                                   |
| [`telemetry-deps.ts`](telemetry-deps.ts) | Shared frozen-gauntlet dependency builder used by both `telemetry.ts` and `gen-variety.ts`, so the roster wiring lives in one place.                                                                                                                                                                          |
| [`gen-spec.ts`](gen-spec.ts)             | The pure `generateSpec()` generator — emits `docs/spec.md` straight from the engine's single sources (DSL allowlists + `LIMITS`, `CANONICAL_RULES`, the benchmark manifest) so the spec can never drift from the engine, plus a hand-authored strategic primer with every number interpolated from the rules. |
| [`gen-variety.ts`](gen-variety.ts)       | The pure `generateVariety()` generator — reuses the exact `npm run telemetry` report verbatim under a thin scaffold, so the board can never diverge from the tool.                                                                                                                                            |
| [`load.ts`](load.ts)                     | Bot intake for the CLI: untrusted JSON text → a validated `BotDoc` or the structured issues that reject it, routing every path through the real `safeParse` + `validate` TCB gate.                                                                                                                            |
| [`extract.ts`](extract.ts)               | Lenient bot-JSON extraction from a raw model reply (the `--from-reply` stage). Selects the most-likely JSON substring only; it never parses or validates, so it adds no trust.                                                                                                                                |
| [`submission.ts`](submission.ts)         | The ranking policy: a submission is either _scored_ or _invalid_; `compareSubmission` orders every valid bot above every invalid one, valid bots by win-rate then net-points.                                                                                                                                 |
| [`format.ts`](format.ts)                 | Pure pretty-printer for a `FightResult` — the fight runner's output layer. Renders the event log in a collapsed "changes" view and a per-tick "full" view.                                                                                                                                                    |

### Tests

Behavior lives in co-located `*.test.ts` files, including archetype suites
(`grappler.test.ts`, `jabber.test.ts`, `vulture.test.ts`, `zoner.test.ts`) and the
`dogfood.test.ts` end-to-end check. Because the cores are pure and dependency-injected,
these tests never touch the real process or filesystem.

## See also

- [`../engine/README.md`](../engine/README.md) — the engine these tools drive.
- [`../../bots/README.md`](../../bots/README.md) — the bot documents you pass to `fight`
  and `benchmark`.
- [`../../docs/spec.md`](../../docs/spec.md) — the generated bot-authoring spec (`gen:spec`).
