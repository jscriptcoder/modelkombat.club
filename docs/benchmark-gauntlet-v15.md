# Benchmark gauntlet measurement — `v15` (jogai adoption)

The re-measure that lands **item 3 / capability A** — the LLM benchmark's adoption
of WKF **jogai** (ring-out). A fighter driven into the outer `margin = 100000` strip
of the `600000` ring rings out: a _yame_-style neutral reset **plus** a shared
category-2 penalty (the first ring-out is a free warning; the second and beyond each
award the opponent +1). Turning jogai on makes the officiating perception fields
(`self.x`-vs-edge, `self.penalties` / `opponent.penalties`) live for submitted bots
for the first time.

Unlike the adoption-only Cap D (senshu), this adoption is **thick**: two roster bots
are re-authored so the mechanic actually _fires and pays off_ on the frozen board —

- **`zoner` (the field-read carrier)** becomes **ring-aware**: its two retreat rules
  now gate on `self.x` sitting inside the safe band `(110000, 490000)` — a near-edge
  boundary read — so it zones without ever back-pedalling itself out. It rings out
  **0** times.
- **`sweeper` (the naive victim)** gains a panic rule: when it cannot get on the board
  against a patient, non-attacking foe (`self.points ≤ 0 ∧ opponent.attacking = 0 ∧
opponent.distance ≤ 180000`) it back-pedals. Against the defensive `vulture` — which
  it can never score on — this spirals it into repeated ring-outs.

## Frozen scoring inputs

Everything below is pinned by `BENCHMARK_VERSION` / `INPUT_HASH` in
`src/engine/benchmark-config.ts` — a change to any of it bumps the version, and these
numbers move with it.

| Input               | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| `BENCHMARK_VERSION` | `v15`                                                                 |
| Rules               | `CANONICAL_RULES` (unchanged — `npm run fight` stable)                |
| Match               | `winGap: 8`, `senshu: true`, `jogai.margin: 100000`, `MAX_TICKS: 600` |
| Seeds               | `1..10`                                                               |
| Gauntlet            | `jabber, rekka, zoner, grappler, sweeper, vulture`                    |

Reproduce by running the real aggregator (`benchmark()` in `src/engine/benchmark.ts`)
with the frozen manifest for each member as the submitted bot — 100 fights each
(5 opponents × 10 seeds × 2 sides; the no-mirror rule drops the self-match).

## Round-robin — each member as the submitted bot

Ranking is by **win-rate (primary)**; net-points is the tiebreaker only. **All 6
members stay inside the confirmed `[25%, 75%]` band.**

| Member     | Win-rate | Record (of 100) | Net   | Band `[25%, 75%]` |
| ---------- | -------- | --------------- | ----- | ----------------- |
| `vulture`  | 73.0%    | 73W 27L 0D      | +508  | ✅ in             |
| `grappler` | 60.0%    | 60W 40L 0D      | +179  | ✅ in             |
| `sweeper`  | 60.0%    | 60W 40L 0D      | +725  | ✅ in             |
| `rekka`    | 41.0%    | 41W 59L 0D      | +427  | ✅ in             |
| `zoner`    | 35.0%    | 35W 65L 0D      | −1389 | ✅ in             |
| `jabber`   | 31.0%    | 31W 69L 0D      | −450  | ✅ in             |

### What jogai changed (vs `v14`)

The rule itself barely perturbs the board (±1pt); the shift is the two re-authored
bots plus the sweeper's decisive feed to the vulture:

| Member     | `v14` | `v15` | Why                                                                                 |
| ---------- | ----- | ----- | ----------------------------------------------------------------------------------- |
| `zoner`    | 35%   | 35%   | ring-aware, but the tightened guard (δ = 10000) keeps its zoning game — rings out 0 |
| `jabber`   | 31%   | 31%   | unchanged                                                                           |
| `rekka`    | 41%   | 41%   | unchanged                                                                           |
| `grappler` | 58%   | 60%   | mild round-robin drift                                                              |
| `sweeper`  | 67%   | 60%   | now the victim — loses its `vulture` matchup to self-ring-outs                      |
| `vulture`  | 68%   | 73%   | beneficiary of the sweeper's ring-outs                                              |

### The decisive fire (jogai "fires" on the real board)

The sweeper vs `vulture` matchup is a natural 0-0 draw (both defensive). Under jogai
the sweeper's panic rule spirals it into **9 ring-outs**, handing the vulture an 8-0
gap win — a clean **draw → vulture** flip, reproducible on **every seed, both sides**
(20 bouts). No other member rings out ≥2 in any bout, so this is the sole — and very
stable — decisive jogai fire the CI guard locks (`fouls.sweeper.jogai ≥ 2`, deciding
the bout).

**Rebalance note (decision 5 ladder).** Making the zoner ring-aware initially
weakened it (35% → 29%) and inflated the vulture (68% → 74%), and the sweeper's feed
pushed the vulture to 79% (out). The fix stayed on the carrier lever: tightening the
zoner's safe-band guard from δ = 30000 to δ = 10000 restored its zoning strength
(back to 35%), which pulled the vulture back to 73% (in band). No coupled bot beyond
the two carriers was touched; the `jogai.margin` param was held fixed.

## Dogfood re-read (authored cold from `docs/spec.md`)

The dogfood record is **unchanged from `v14` — 18W 102L 0D (15.0%)**. It attacks (so
the sweeper's flee-when-shut-out never triggers against it) and never rings itself
out, so jogai does not touch its matchup outcomes. Net moves slightly with the
re-authored zoner/sweeper trajectories.

| vs         | Record    | Net  |
| ---------- | --------- | ---- |
| `grappler` | 12W 8L 0D | +22  |
| `vulture`  | 6W 14L 0D | −74  |
| `zoner`    | 0W 20L 0D | −54  |
| `jabber`   | 0W 20L 0D | −100 |
| `sweeper`  | 0W 20L 0D | −600 |
| `rekka`    | 0W 20L 0D | −920 |

Its 18 wins come entirely from `grappler` (12) and `vulture` (6). This record is
pinned as a characterization in `src/cli/dogfood.test.ts`.
