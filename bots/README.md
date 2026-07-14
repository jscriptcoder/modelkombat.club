# `bots/` — bot documents

Example and gauntlet fighters, one JSON file each. A **bot document** is what an LLM
authors in ModelKombat: not a program, but a small JSON decision tree in the bounded bot
DSL. The engine reads it, never executes it. These files are the demos you fight and
benchmark from the CLI, the frozen opponents a submission is scored against, and worked
references for anyone (human or model) learning to author a fighter.

The authoritative grammar and read surface live in [`../docs/spec.md`](../docs/spec.md)
(also served live at [`/spec`](https://modelkombat.club/spec)).

## What a bot document looks like

A bot is a **priority-ordered list of `when → do` rules** plus a `default` action. Each
tick, the engine evaluates the rules top-to-bottom against the current state and performs
the `do` of the first rule whose `when` is true; if none match, it performs the `default`.
Conditions read a whitelisted set of fields (distance, height bands, stamina, windows, the
_delayed_ opponent snapshot…) and do integer math only.

The simplest fighter, [`aggressor.json`](aggressor.json) — "when I can act and you're in
range, throw a reverse punch; otherwise walk forward":

```json
{
  "version": 1,
  "name": "aggressor",
  "model": "house",
  "rules": [
    {
      "when": {
        "op": "and",
        "args": [
          {
            "op": "eq",
            "args": [
              { "op": "field", "path": "self.canAct" },
              { "op": "const", "value": 1 }
            ]
          },
          {
            "op": "lte",
            "args": [
              { "op": "field", "path": "opponent.distance" },
              { "op": "const", "value": 240000 }
            ]
          }
        ]
      },
      "do": { "type": "attack", "move": "gyaku-zuki", "band": "high" }
    }
  ],
  "default": { "type": "move", "dir": 1 }
}
```

Its mirror image, [`turtle.json`](turtle.json), is the shortest legal bot: no rules at
all, just a `default` that guards mid forever. Together they are the "hello world" pair in
the top-level [Quick start](../README.md#quick-start).

## The `model` field

Every document carries a `model` provenance tag. It is **inert** — the interpreter never
reads it, so it can never affect a fight or a score — but it records who authored the bot:

- **`gauntlet`** — a member of the frozen benchmark roster (see below).
- **`house`** — a hand-authored example / demo fighter maintained in this repo.
- **a real model id** (e.g. an LLM name) — a genuine LLM submission.

## The gauntlet roster

The six `model: "gauntlet"` bots are the **frozen, versioned gauntlet** — the fixed
opponents every submission is scored against by `npm run benchmark` and the `/fight`
endpoint. They span the strategic axes so a bot can't win by countering a single style,
and their scoring content is pinned by `INPUT_HASH` (changing one requires a
`BENCHMARK_VERSION` bump). Their bios also front the [website's gauntlet section](https://modelkombat.club).

| Bot                         | Signature            | Style                                                                                                          |
| --------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| [`jabber`](jabber.json)     | `kizami-zuki`        | Death by a thousand cuts. Walks you down, reads your strike's height and blocks it, then answers with the jab. |
| [`rekka`](rekka.json)       | `tobi-geri`          | Flurry artist. Chains cancel into cancel, then leaps in for a jump-kick ippon.                                 |
| [`zoner`](zoner.json)       | `ushiro-geri`        | Fights at the fence — picks the exact-length kick for the gap and retreats the instant you close the distance. |
| [`grappler`](grappler.json) | `throw`              | Owns the clinch. Crowd him and he throws you to the mat, then punishes the knockdown with a reverse punch.     |
| [`sweeper`](sweeper.json)   | `sweep → gyaku-zuki` | Chops your base out with a foot sweep, then cashes the knockdown for a reverse-punch finish.                   |
| [`vulture`](vulture.json)   | `uraken`             | Patient predator. Baits the whiff, punishes it with a snap backfist — and feeds on a gassed opponent.          |

## The example fighters

The `model: "house"` bots are hand-authored references, ranging from one-liners to
elaborate decision trees. They are useful sparring partners for `npm run fight` and worked
examples of the DSL at different complexity levels (rule count is a rough guide to how much
of the read surface each one uses).

| Bot                           | Rules | The gist                                                                                                         |
| ----------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------- |
| [`aggressor`](aggressor.json) | 1     | Minimal pressure — close the gap and reverse-punch on sight.                                                     |
| [`turtle`](turtle.json)       | 0     | Minimal defense — hold a mid guard and never commit.                                                             |
| [`berserker`](berserker.json) | 2     | Relentless, low-read all-out offense.                                                                            |
| [`counter`](counter.json)     | 3     | Reactive — waits, then punishes off the counter window.                                                          |
| [`pacer`](pacer.json)         | 5     | Paces the fight and watches its stamina to avoid gassing out.                                                    |
| [`dogfood`](dogfood.json)     | 6     | The fighter authored during the spec "dogfood" exercise — proof the spec alone is enough to write a working bot. |
| [`vise`](vise.json)           | 10    | Clinch-and-crush grappling pressure.                                                                             |
| [`crane`](crane.json)         | 13    | A patient, kick-oriented stylist that plays the spacing game.                                                    |
| [`tactician`](tactician.json) | 14    | The most elaborate example — mixes ranges, reads, and windows.                                                   |

## Using these files

```bash
# fight two bots head-to-head (prints the tick log + winner):
npm run fight -- bots/aggressor.json bots/turtle.json

# score a bot against the frozen gauntlet:
npm run benchmark -- bots/vulture.json

# pre-check a document against the live validator gate:
curl -X POST https://modelkombat.club/validate \
  -H 'content-type: application/json' \
  --data-binary @bots/aggressor.json
```

## Authoring your own

1. Read [`../docs/spec.md`](../docs/spec.md) — the whitelisted fields, the ops, the move
   roster + frame table, and the scoring rules.
2. Write a JSON document with `version`, `name`, `model`, a `rules` list, and a `default`.
3. Validate it (`POST /validate`, or `npm run fight` which validates before running).
4. Benchmark it against the gauntlet, then challenge the throne via `POST /fight`.

Only the whitelisted vocabulary is accepted — anything outside it is rejected at the gate,
by design. See [`../src/engine/README.md`](../src/engine/README.md) for why bots are data,
not code.
