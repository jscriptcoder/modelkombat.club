# ModelKombat — Bot authoring spec

> **GENERATED — do not edit by hand.** Regenerate with `npm run gen:spec`.
> Every allowlist, limit, and frame-table number below is read directly from
> the engine, so this document cannot lie about how a fight resolves.

- **Benchmark version:** `v1` — a score is comparable only against another at the same version.
- **Input hash:** `32418ed2718cc084f8e912928cf7172105597281c5422a93bff7ce81e6a84e0a` (pins the scoring inputs: rules + gauntlet + run params).

A bot is a **JSON document, not code**: no I/O, no loops, no recursion. It is
validated once against the allowlists below (the security boundary), then run
unchanged. The engine calls it **once per tick**; rules are evaluated
top-to-bottom against one coherent (latency-delayed) snapshot, and the first
rule whose `when` holds and that carries a `do` returns the tick's `Action`.

## Limits

Hard caps enforced at validation time — a document that exceeds any of these
is rejected. The engine needs no instruction metering: worst-case cost is
bounded by document size. Every expression node (numeric or boolean) counts
against `maxNodes` and nesting against `maxDepth`.

- `maxBytes` — 32768
- `maxNodes` — 4000
- `maxDepth` — 32
- `maxRules` — 96
- `maxCells` — 24
- `intMin` — -2147483648
- `intMax` — 2147483647

## Document shape

```jsonc
{
  "version": 1,
  "name": "string (1..64 chars)",
  "memory": { "cellName": 0 },   // optional: declared int cells, persist across ticks within a fight
  "rules": [ <Rule>, ... ],      // priority-ordered; first matching `do` wins
  "default": <Action>            // taken when no rule fires
}
```

```jsonc
// Rule: if `when` holds, apply `set` writes; a `do` (if present) is the terminal action.
// A rule with no `do` is a TRACKER (updates memory, evaluation continues).
{ "when": <BoolExpr>, "set": [ { "cell": "name", "to": <NumExpr> } ], "do": <Action> }
```

## Expressions

All values are **fixed-point integers**. Arithmetic is **int32-saturating**:
every op clamps its result to [`-2147483648`, `2147483647`];
`div` truncates toward zero and division by zero yields `0`. These rules make
every evaluation bit-reproducible across platforms.

**Numeric expressions** (`NumExpr`):

- leaves: `const` (`{op:"const",value}`), `field` (`{op:"field",path}`), `mem` (`{op:"mem",cell}`), `rule` (`{op:"rule",path}`)
- all `op` tags (leaves + arithmetic): `const`, `field`, `mem`, `rule`, `add`, `sub`, `mul`, `div`, `min`, `max`, `neg`, `abs`

**Boolean expressions** (`BoolExpr`):

- operators: `gt`, `lt`, `gte`, `lte`, `eq`, `neq`, `and`, `or`, `not`

## State read surface (`field`)

The whitelisted state leaves a bot may read via `{op:"field",path}`. Opponent
fields are served from a latency-delayed snapshot (see the perception
constants in the frame table); `opponent.points` is a live scoreboard read.

- `self.x`
- `self.facing`
- `self.points`
- `self.canAct`
- `self.phaseRemaining`
- `self.counterWindow`
- `self.cancelWindow`
- `self.finishWindow`
- `self.stamina`
- `self.gassed`
- `opponent.x`
- `opponent.y`
- `opponent.facing`
- `opponent.distance`
- `opponent.attacking`
- `opponent.attackBand`
- `opponent.posture`
- `opponent.throwing`
- `opponent.knockdown`
- `opponent.vx`
- `opponent.predictedDistance`
- `opponent.stamina`
- `opponent.gassed`
- `opponent.points`
- `ring.width`
- `clock.tick`
- `clock.ticksRemaining`

## Ruleset read surface (`rule`)

The frozen frame-table constants a bot may read symbolically via
`{op:"rule",path}` — e.g. `rule("moves.mae-geri.reach")` instead of the literal.
An unconfigured constant reads the sentinel `0`. Their current values are in
the frame table below.

- `tickRate`
- `walkSpeed`
- `ring.width`
- `startGap`
- `moves.gyaku-zuki.startup`
- `moves.gyaku-zuki.active`
- `moves.gyaku-zuki.recovery`
- `moves.gyaku-zuki.score`
- `moves.gyaku-zuki.reach`
- `moves.gyaku-zuki.staminaCost`
- `moves.sweep.startup`
- `moves.sweep.active`
- `moves.sweep.recovery`
- `moves.sweep.score`
- `moves.sweep.reach`
- `moves.sweep.staminaCost`
- `moves.kizami-zuki.startup`
- `moves.kizami-zuki.active`
- `moves.kizami-zuki.recovery`
- `moves.kizami-zuki.score`
- `moves.kizami-zuki.reach`
- `moves.kizami-zuki.staminaCost`
- `moves.mae-geri.startup`
- `moves.mae-geri.active`
- `moves.mae-geri.recovery`
- `moves.mae-geri.score`
- `moves.mae-geri.reach`
- `moves.mae-geri.staminaCost`
- `moves.mawashi-geri.startup`
- `moves.mawashi-geri.active`
- `moves.mawashi-geri.recovery`
- `moves.mawashi-geri.score`
- `moves.mawashi-geri.reach`
- `moves.mawashi-geri.staminaCost`
- `moves.mawashi-geri.scoreByBand.high`
- `throw.startup`
- `throw.active`
- `throw.recovery`
- `throw.reach`
- `throw.score`
- `throw.staminaCost`
- `jumpImpulse`
- `gravity`
- `lowClearance`
- `parryWindow`
- `parryRecovery`
- `counterWindow`
- `counterBonus`
- `cancelWindow`
- `knockdownDuration`
- `finishWindow`
- `finishScore`
- `perception.lPos`
- `perception.lAct`
- `perception.jitter`
- `stamina.max`
- `stamina.regen`
- `stamina.blockChip`
- `stamina.parryChip`
- `stamina.gasThreshold`
- `stamina.gasRecoveryPenalty`

## Action grammar

A bot returns exactly **one** action per tick. `dir` is relative to facing:
`+1` toward the opponent, `-1` away, `0` hold.

- action types: `idle`, `move`, `block`, `crouch`, `jump`, `attack`, `sweep`, `throw`, `throw-break`
- `attack` takes a `move` and a `band`.
- attack moves: `kizami-zuki`, `gyaku-zuki`, `mae-geri`, `mawashi-geri`
- bands: `high`, `mid`, `low`

## Frame table

The authoritative numbers the platform fights on (`CANONICAL_RULES`).

### Techniques

| technique | startup | active | recovery | score | reach | cost | bands |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `sweep` | 7 | 2 | 13 | 0 | 180000 | 40 | — |
| `kizami-zuki` | 7 | 2 | 13 | 1 | 210000 | 15 | high/mid |
| `gyaku-zuki` | 7 | 3 | 14 | 1 | 240000 | 20 | high/mid |
| `mae-geri` | 9 | 3 | 16 | 2 | 270000 | 35 | mid |
| `mawashi-geri` | 11 | 3 | 18 | 2 | 300000 | 45 | high/mid |

### Global constants

- `tickRate` — 60
- `walkSpeed` — 4000
- `ring.width` — 600000
- `startGap` — 300000
- `throw.startup` — 7
- `throw.active` — 2
- `throw.recovery` — 14
- `throw.reach` — 120000
- `throw.score` — 3
- `throw.staminaCost` — 40
- `jumpImpulse` — 12000
- `gravity` — 4000
- `lowClearance` — 8000
- `parryWindow` — 2
- `parryRecovery` — 12
- `counterWindow` — 10
- `counterBonus` — 1
- `cancelWindow` — 6
- `knockdownDuration` — 30
- `finishWindow` — 10
- `finishScore` — 3
- `perception.lPos` — 1
- `perception.lAct` — 6
- `perception.jitter` — 1
- `stamina.max` — 100
- `stamina.regen` — 10
- `stamina.blockChip` — 5
- `stamina.parryChip` — 15
- `stamina.gasThreshold` — 30
- `stamina.gasRecoveryPenalty` — 6

## Validation-error catalog

A rejected document reports structured `{ path, reason }` issues. The reason
families an author hits:

- **node budget exceeded** — the document has more expression nodes than `maxNodes`.
- **too deeply nested** — an expression exceeds `maxDepth`.
- **field not allowed** / **rule not allowed** — a `field`/`rule` path outside the read surface.
- **unknown move** / **unknown band** — an `attack` naming a move/band outside the allowlist.
- **undeclared cell** — a `mem` read or `set` write to a cell not declared in `memory`.
- **unknown numeric/boolean op** — an unrecognised expression operator.

## Benchmark rules

A submitted bot is scored deterministically against a frozen, versioned
gauntlet — the spec is the only input; there is no feedback loop.

- `metric` — Σ net-points over every (opponent × seed × side) fight; win-rate breaks ties.
- `seeds` — 1..10 (10 seeds), each matchup played twice (bot as A and as B).
- `maxTicks` — 600
- gauntlet opponents:
  - `jabber`
  - `rekka`
  - `zoner`
  - `grappler`
  - `sweeper`
  - `vulture`
