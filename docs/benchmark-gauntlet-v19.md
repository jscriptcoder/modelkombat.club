# Benchmark gauntlet measurement — `v19` (aerial exercise)

The re-measure that lands **air-actions Story 4** — the frozen gauntlet now actually
**exercises** aerial combat instead of merely listing the technique. Through `v18` the
canonical arsenal gained the airborne `tobi-geri` (jump-in jodan-3 / chudan-2) and
`jumpXSpeed`, but **no roster bot ever used them**: rekka carried a `tobi-geri` jump-in
gated behind `opponent.distance > 300000`, and bouts open at a ~286k gap and close inward,
so the gate never fired (`jumps = 0`). It shipped "reachable-but-dormant."

`v19` **weaponizes** it with a one-constant edit — the jump gate drops to `> 250000`
(tobi-geri's own reach). rekka now jumps off the opening gap (and after each _yame_ reset)
and connects for a jodan ippon. No engine / DSL / `CANONICAL_RULES` change: rekka is
**data**, so the only scoring input that moved is the rekka bot text (one `INPUT_HASH` flip).

## The jump-in really connects — not a telegraphed whiff

Measured on the frozen board, rekka's weaponized `tobi-geri` connects for a **≥2-point
score (chudan waza-ari / jodan ippon) in 182 attack frames across all 100 of its bouts**
— every single bout lands at least one. The frozen foes set their high _uke_ ~2 ticks too
late (they raise the guard at tick 8; the strike resolves at tick 6, then lands per the
`AC-2.2` connect-then-land timing), so the jodan ippon gets through.

| rekka's connects | vs `jabber` | vs `zoner` | vs `grappler` | vs `sweeper` | vs `vulture` |
| ---------------- | ----------- | ---------- | ------------- | ------------ | ------------ |
| ≥2-pt tobi-geri  | 35          | 20         | 40            | 20           | 67           |

The gate is **insensitive across `[230k, ~285k]`** — rekka only ever sees `distance > gate`
at the opening / after a reset (~286k), so any value in that window fires identically. The
S2/S3 "a committal, telegraphed move has no healthy niche" warning did **not** bite here:
narrow-gating was not required, so the recommended value is the clean semantic `> 250000`.

## The adoption lock — the CI guard that certifies aerial combat is exercised

`gauntlet-calibration.test.ts` gains a **tobi-geri adoption lock**, mirroring the
jogai/passivity/overtime officiating locks (a `fires` invariant + a `field-read` invariant,
each with a guard-bites companion):

- **connects** — rekka scores a `tobi-geri` connect on the board (points jump ≥2 while its
  frame action is `attack tobi-geri`). A dormant-rekka counterfactual (gate restored to 300000) yields **0**, proving the lock keys off the **live jump-in** — the gate lowering —
  not merely off the move existing in the arsenal.
- **field-read** — rekka references `self.posture` (the airborne read) to release the strike
  only while aloft; a `self.x`-only bot does not satisfy it.

Coverage stays **12/12** (rekka's `tobi-geri` reference was always present; `v19` makes it
_land_). The move-coverage guard's stale `(11/11)` title is corrected to `(12/12)`.

## Frozen scoring inputs

Everything below is pinned by `BENCHMARK_VERSION` / `INPUT_HASH` in
`src/engine/benchmark-config.ts` — a change to any of it bumps the version, and these
numbers move with it.

| Input               | Value                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `BENCHMARK_VERSION` | `v19`                                                                                                                |
| `INPUT_HASH`        | `4764cdd7a51fbded720070f52e1cc34e5b7486d173b4fd5772583fc6e75f8926`                                                   |
| Rules               | `CANONICAL_RULES` (unchanged — a fight between two non-rekka bots is `npm run fight`-stable)                         |
| Gauntlet            | `jabber, rekka, zoner, grappler, sweeper, vulture` (only `rekka.json` changed: jump gate `300000 → 250000`)          |
| Match               | `winGap: 8`, `senshu: true`, `jogai.margin: 100000`, `passivity.limit: 240`, `overtime.ticks: 300`, `MAX_TICKS: 600` |
| Seeds               | `1..10`                                                                                                              |

Reproduce by running the real aggregator (`benchmark()` in `src/engine/benchmark.ts`)
with the frozen manifest for each member as the submitted bot — 100 fights each
(5 opponents × 10 seeds × 2 sides; the no-mirror rule drops the self-match).

## Round-robin — each member as the submitted bot

Ranking is by **win-rate (primary)**; net-points is the tiebreaker only. **All 6
members stay inside the confirmed `[25%, 75%]` band.**

| Member     | Win-rate | Record (of 100) | Net  | Band `[25%, 75%]` |
| ---------- | -------- | --------------- | ---- | ----------------- |
| `grappler` | 64.0%    | 64W 36L 0D      | +320 | ✅ in             |
| `sweeper`  | 60.0%    | 60W 40L 0D      | +780 | ✅ in             |
| `rekka`    | 59.0%    | 59W 41L 0D      | +83  | ✅ in             |
| `vulture`  | 40.0%    | 40W 60L 0D      | −93  | ✅ in             |
| `zoner`    | 40.0%    | 40W 60L 0D      | −688 | ✅ in             |
| `jabber`   | 37.0%    | 37W 63L 0D      | −402 | ✅ in             |

### What the weaponization changed (vs `v18`)

`v18`'s board equalled `v17`'s (61/60/52/47/40/40) — the arsenal gained `tobi-geri` but the
jump-in was still dormant, so every bout was byte-identical. Weaponizing rekka moves only
bouts **involving rekka**, so exactly three cards shift and the accounting closes cleanly:

| Member     | `v18` | `v19` | Δ   | Why                                                                                |
| ---------- | ----- | ----- | --- | ---------------------------------------------------------------------------------- |
| `grappler` | 52%   | 64%   | +12 | its close game punishes the committed jump-in on landing — wins +12 of 20 vs rekka |
| `jabber`   | 47%   | 37%   | −10 | its poke game has no answer to the jodan ippon — loses 10 of 20 vs rekka           |
| `rekka`    | 61%   | 59%   | −2  | +10 gained vs `jabber` − 12 lost vs `grappler` = −2 net on its own card            |
| `zoner`    | 40%   | 40%   | 0   | its vs-rekka bouts are unmoved by the jump-in                                      |
| `sweeper`  | 60%   | 60%   | 0   | unchanged                                                                          |
| `vulture`  | 40%   | 40%   | 0   | unchanged (still absorbs the jump-in without a win-flip)                           |

No coupled-bot surgery was needed — the board stayed in band under the pure weaponization,
so the jump-in reads as a genuine strategic axis (rewarded against a poke game, punished by
a grappler) rather than a free win. The value `250000` is held FIXED (it is tobi-geri's own
reach, and the `[230k, 285k]` firing window is empirically equivalent).

## Dogfood re-read (authored cold from `docs/spec.md`)

The dogfood record is **unchanged at 13W / 107L / 0D (10.8%)**. The always-attacking dogfood
was already losing every one of its rekka bouts (0W / 20L), so rekka landing more `tobi-geri`
points flips no win↔loss outcome — it only deepens the `rekka` net (`−916`) while the total net
shifts slightly _less_ negative (`−1785 → −1781`) because the jodan ippons close those bouts
faster on the `winGap`.

| vs         | Record    | Net  |
| ---------- | --------- | ---- |
| `grappler` | 12W 8L 0D | +23  |
| `vulture`  | 1W 19L 0D | −134 |
| `jabber`   | 0W 20L 0D | −100 |
| `zoner`    | 0W 20L 0D | −54  |
| `sweeper`  | 0W 20L 0D | −600 |
| `rekka`    | 0W 20L 0D | −916 |

This record is pinned as a characterization in `src/cli/dogfood.test.ts`.
