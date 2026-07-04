# Benchmark gauntlet measurement — `v16` (passivity adoption)

The re-measure that lands **item 3 / capability B** — the LLM benchmark's adoption
of WKF **passivity** (non-engagement). A fighter that goes `limit = 240` ticks without
landing any offense (a strike that hits, is blocked, or is parried, or a live grab —
a whiff at air does not count) is fouled: a _yame_-style neutral reset **plus** the
**same** shared category-2 penalty ladder as jogai (first foul a free warning; the
second and beyond each award the opponent +1). Turning passivity on makes the
`self.passivityRemaining` / `opponent.passivityRemaining` perception fields live for
submitted bots for the first time.

Like jogai (Cap A), this adoption is **thick** — two roster bots are re-authored so
the mechanic is _exercised_ on the frozen board:

- **`jabber` (the field-read carrier)** gains a last-ditch re-engage: when
  `self.passivityRemaining ∈ (0, 10]` and a foe is within `shuto` range (`≤ 260000`)
  it commits a `shuto` rather than turtle into its own foul. The `> 0` lower gate
  excludes the sentinel `0` (passivity-off), so the rule is inert everywhere except a
  genuine deep stall — its band is unchanged off-benchmark and it fouls essentially
  never on-board.
- **`vulture` (the exercised victim)** gains a standoff-idle rule: when the foe is not
  attacking (`opponent.attackBand = 0`) and out at range (`opponent.distance > 200000`)
  it holds instead of advancing. Against spacing/patient foes this lets its no-offense
  clock run out — it commits **23** passivity fouls across the round-robin, **2 in one
  bout** (vs `zoner`, seed 2), so the shared ladder actually **confers** a penalty point
  on the frozen roster.

## Calibration finding — `limit` moved 120 → 240 (once, by measurement)

The first-measured `limit = 120` **mis-flagged the jabber's legitimate patient
counter-game** (it out-points the spacing zoner by blocking its kick ladder — WKF
non-engagement, but its only non-turtle winning matchup), cratering it to 12% with no
bot edit able to recover it. A `limit` sweep showed **240** self-calibrates the whole
board while a pure turtle still fouls 80× — i.e. _paced fighters safe, pure stallers
flagged_. The param moved once, by measurement, then re-froze (it is not a per-board
balance lever).

## The "fires" bar is RELAXED to "exercised" for passivity

Unlike jogai (a ring-out _directly_ hands a point in an already-close bout ⇒ naturally
decisive), a **decisive** passivity fire is structurally infeasible on this roster: a
decisive foul needs a bot idle ~480 ticks (foul ≥2× to confer past the free warning)
in a bout that stays _close_ — but 480/600 idle ticks lose the bout on points anyway.
So the passivity board bar is **EXERCISED**: a real bot confers a penalty point (≥2
fouls in a bout, the vulture). That a conferred passivity point awards +1 and can decide
scoring stays proven by the built Capability-B engine unit tests — the move-coverage
analog (the board exercises the mechanic; unit tests prove its scoring).

## Frozen scoring inputs

Everything below is pinned by `BENCHMARK_VERSION` / `INPUT_HASH` in
`src/engine/benchmark-config.ts` — a change to any of it bumps the version, and these
numbers move with it.

| Input               | Value                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `BENCHMARK_VERSION` | `v16`                                                                                         |
| Rules               | `CANONICAL_RULES` (unchanged — `npm run fight` stable)                                        |
| Match               | `winGap: 8`, `senshu: true`, `jogai.margin: 100000`, `passivity.limit: 240`, `MAX_TICKS: 600` |
| Seeds               | `1..10`                                                                                       |
| Gauntlet            | `jabber, rekka, zoner, grappler, sweeper, vulture`                                            |

Reproduce by running the real aggregator (`benchmark()` in `src/engine/benchmark.ts`)
with the frozen manifest for each member as the submitted bot — 100 fights each
(5 opponents × 10 seeds × 2 sides; the no-mirror rule drops the self-match).

## Round-robin — each member as the submitted bot

Ranking is by **win-rate (primary)**; net-points is the tiebreaker only. **All 6
members stay inside the confirmed `[25%, 75%]` band.**

| Member     | Win-rate | Record (of 100) | Net   | Band `[25%, 75%]` |
| ---------- | -------- | --------------- | ----- | ----------------- |
| `rekka`    | 61.0%    | 61W 39L 0D      | +732  | ✅ in             |
| `sweeper`  | 60.0%    | 60W 40L 0D      | +745  | ✅ in             |
| `grappler` | 56.0%    | 56W 44L 0D      | +155  | ✅ in             |
| `jabber`   | 48.0%    | 48W 52L 0D      | −248  | ✅ in             |
| `zoner`    | 40.0%    | 40W 60L 0D      | −1328 | ✅ in             |
| `vulture`  | 35.0%    | 35W 65L 0D      | −56   | ✅ in             |

### What passivity changed (vs `v15`)

`limit = 240` self-calibrates the board; the shift is the two re-authored carriers
(chiefly the vulture becoming an exploitable staller):

| Member     | `v15` | `v16` | Why                                                                      |
| ---------- | ----- | ----- | ------------------------------------------------------------------------ |
| `vulture`  | 73%   | 35%   | the victim — its standoff-idle rule loses the bouts it holds in          |
| `rekka`    | 41%   | 61%   | rises — punishes the now-passive vulture                                 |
| `jabber`   | 31%   | 48%   | rises — beats the weaker vulture; its field-read holds the zoner matchup |
| `grappler` | 60%   | 56%   | mild round-robin drift                                                   |
| `zoner`    | 35%   | 40%   | mild round-robin drift                                                   |
| `sweeper`  | 60%   | 60%   | unchanged                                                                |

### The exercised fire (passivity is exercised on the real board)

The vulture's standoff-idle rule spirals it into **23 passivity fouls** across the
round-robin, reaching **2 in one bout** (vs `zoner`, seed 2) — so the shared ladder
confers a penalty point on the frozen roster. No foul is _decisive_ (a stalled bout
loses on points regardless), so the CI guard locks the relaxed **exercised** bar: a
real bot commits `≥ 2` passivity fouls in some board bout (`fouls.vulture.passivity`),
with the passivity-off counterfactual conferring nothing.

The **v15 jogai fire survives the pooled ladder**: `sweeper → vulture` still rings out
decisively (≥10 fires), locked unchanged.

**Rebalance note (decision 5 ladder).** No coupled-bot surgery was needed: `limit = 240`
self-balanced the board (all 6 ∈ band with no edits), so the only changes are the jabber
field-read (band-neutral) and the vulture victim (the intended drop from 73%). The
`passivity.limit` param moved once by measurement, then re-froze.

## Dogfood re-read (authored cold from `docs/spec.md`)

The dogfood record shifts **18W → 13W (107L 0D, 10.8%)**. It attacks every tick, so it
never commits a passivity foul of its own — the change is purely the re-authored jabber
and vulture flipping those two matchups.

| vs         | Record    | Net |
| ---------- | --------- | --- |
| `grappler` | 12W 8L 0D | —   |
| `vulture`  | 1W 19L 0D | —   |
| `jabber`   | 0W 20L 0D | —   |
| `rekka`    | 0W 20L 0D | —   |
| `zoner`    | 0W 20L 0D | —   |
| `sweeper`  | 0W 20L 0D | —   |

Its 13 wins come almost entirely from `grappler` (12) plus one vs `vulture`. This record
is pinned as a characterization in `src/cli/dogfood.test.ts`.
