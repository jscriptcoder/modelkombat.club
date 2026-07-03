# Benchmark gauntlet measurement — `v4` (senshu tie-resolution)

The re-measure that closes **Capability D1** — the LLM benchmark's adoption of WKF
**senshu** first-blood tie-resolution. A level-at-cap bout that used to **draw** is
now decided by first blood (the first fighter to score a technique point), so
win-rate discriminates the close, low-scoring matchups. It records the gauntlet
spread and the dogfood re-read under the `v4` metric, on the same post-Slice-6
frame table as `v3` (`knockdownDuration` de-walled `30 → 18`).

This is a **report-only** re-characterization: senshu is WKF-correct, so we adopt
it and record the honest numbers — **no gauntlet rebalance** is part of D. See the
go/no-go section for the out-of-band shifts it surfaced (all deferred).

## Frozen scoring inputs

Everything below is pinned by `BENCHMARK_VERSION` / `INPUT_HASH` in
`src/engine/benchmark-config.ts` — a change to any of it bumps the version, and
these numbers move with it.

| Input               | Value                                              |
| ------------------- | -------------------------------------------------- |
| `BENCHMARK_VERSION` | `v4`                                               |
| Rules               | `CANONICAL_RULES` (`knockdownDuration: 18`)        |
| Match               | `winGap: 8`, `senshu: true`, `MAX_TICKS: 600`      |
| Seeds               | `1..10`                                            |
| Gauntlet            | `jabber, rekka, zoner, grappler, sweeper, vulture` |

Reproduce by running the real aggregator (`benchmark()` in
`src/engine/benchmark.ts`) with the frozen manifest for each member as the
submitted bot — 100 fights each (5 opponents × 10 seeds × 2 sides; the no-mirror
rule drops the self-match).

## Round-robin — each member as the submitted bot

Ranking is by **win-rate (primary)**; net-points is the tiebreaker only. Under
senshu **every bout is decisive — 0 draws everywhere** (a level cap is resolved by
first blood).

| Member     | Win-rate | Record (of 100) | Net   | Band `[25%, 75%]` |
| ---------- | -------- | --------------- | ----- | ----------------- |
| `sweeper`  | 82.0%    | 82W 18L 0D      | +1430 | ❌ **out (high)** |
| `rekka`    | 72.0%    | 72W 28L 0D      | +1483 | ✅ in             |
| `grappler` | 66.0%    | 66W 34L 0D      | +265  | ✅ in             |
| `zoner`    | 36.0%    | 36W 64L 0D      | −1329 | ✅ in             |
| `jabber`   | 28.0%    | 28W 72L 0D      | −1566 | ✅ in             |
| `vulture`  | 16.0%    | 16W 84L 0D      | −283  | ❌ **out (low)**  |

**4 of 6 members inside the confirmed `[25%, 75%]` band.**

### What senshu changed (vs `v3`)

Net-points are **identical to `v3`** — senshu rewrites only the winner of a level
bout, never a score. Only the win/draw tally moves, as each member's former draws
resolve by whether it held first blood:

| Member     | `v3` win-rate | `v4` win-rate | Former draws resolved to |
| ---------- | ------------- | ------------- | ------------------------ |
| `sweeper`  | 69.0% (13D)   | 82.0%         | all 13 → **wins**        |
| `rekka`    | 70.0% (2D)    | 72.0%         | 2 → wins                 |
| `grappler` | 61.0% (8D)    | 66.0%         | 5 wins, 3 losses         |
| `zoner`    | 27.0% (9D)    | 36.0%         | all 9 → wins             |
| `jabber`   | 25.0% (3D)    | 28.0%         | all 3 → wins             |
| `vulture`  | 16.0% (29D)   | 16.0%         | all 29 → **losses**      |

The signal is coherent with each archetype: the aggressive scorers (`sweeper`,
`zoner`) held first blood in nearly all their level bouts and gained; the reactive
`vulture`, which rarely scores first, lost every one of its 29 former draws. Senshu
does exactly what it is for — it rewards drawing first blood.

## Rebalance go/no-go

D is **adoption-only** — no member is retuned here. Two members sit out of band;
both are logged, neither is addressed in D:

- **High tail — NEW under senshu, DEFERRED.** `sweeper` rises `69% → 82%` because
  all 13 of its former level-bout draws were fights it had already scored first in.
  This is a senshu-surfaced observation, not a regression of the Slice-6 de-wall
  (net is unchanged). A retune, if ever wanted, is a separate rebalance capability
  — out of scope for adoption.
- **Low tail — carried over, DEFERRED.** `vulture` (16%) stays below the band; its
  former draws simply became losses. It is a pure reactive defender that rarely
  scores first, so it rarely holds senshu. It needs the deliberate parry→counter
  redesign already logged as the **vulture follow-up story**, not a naive buff.

`zoner` (36.0%) and `jabber` (28.0%) sit comfortably inside the low edge.

## Dogfood re-read (authored cold from `docs/spec.md`)

The dogfood bot exercises the spec's sweep→cancel→finish okizeme combo. Under the
`v4` match metric (WKF match + senshu), versus the full gauntlet (6 opponents × 10
seeds × 2 sides = 120 fights):

| Metric   | Value               |
| -------- | ------------------- |
| Win-rate | 13.3% (16W 104L 0D) |
| Net      | −1715               |

| vs         | Record    | Net  |
| ---------- | --------- | ---- |
| `grappler` | 12W 8L 0D | +22  |
| `vulture`  | 4W 16L 0D | −115 |
| `jabber`   | 0W 20L 0D | −48  |
| `zoner`    | 0W 20L 0D | −54  |
| `sweeper`  | 0W 20L 0D | −600 |
| `rekka`    | 0W 20L 0D | −920 |

A **weak but legitimate** competitor: it takes genuine wins (beating `grappler`,
splitting some off `vulture`) rather than the degenerate 0-wins read the raw metric
produced. Its lone `v3` draw (vs `grappler`) resolves to a first-blood **win** under
senshu (`11W 1D → 12W`), lifting it `12.5% → 13.3%`; net is untouched. This record
is pinned as a characterization in `src/cli/dogfood.test.ts`.

**Net is not hard-bounded.** In matchups where _both_ bots run okizeme/cancel loops
(dogfood vs `rekka` −920, vs `sweeper` −600), the fights still farm toward the cap
because both sides mutually starve the _yame_ trigger — the same mechanism Slice 6
fixed only for the one-sided (passive-foe) case. Senshu does not touch this (it only
resolves the terminal tally): ranking is by **win-rate**, which is discriminating;
net is only the tiebreaker. A deeper two-sided yame-starvation fix, if ever wanted,
is a separate capability.
