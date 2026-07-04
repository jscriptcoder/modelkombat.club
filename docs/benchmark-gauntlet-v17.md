# Benchmark gauntlet measurement — `v17` (overtime adoption)

The re-measure that lands **item 3 / capability C2** — the LLM benchmark's adoption of
WKF **overtime** (_encho-sen_ sudden death) — and **closes** the deferred officiating
adoption (jogai `v15`, passivity `v16`, overtime `v17`). A bout still **LEVEL** at the
regulation cap plays one sudden-death `overtime` period of `ticks = 300`: the first
1-point gap wins outright (`endReason: "overtime"`), else it exhausts to the senshu /
draw fallback. The full win cascade is now `winGap → overtime → senshu → draw`. Turning
overtime on makes the `clock.overtime` perception field live for submitted bots for the
first time.

Overtime is the **thinnest** of the three adoptions: no engine change (`endReason:
"overtime"` and the sudden-death loop already shipped in Capability C2; the CLI report
already renders the `overtime` bucket), so it is a pure `MATCH` + spec + one-bot wiring.

## The field-read carrier — `jabber` MULTI-READS `clock.overtime`

Like jogai/passivity, the adoption is **thick** — a roster bot references the newly-live
field so it is exercised on the board. The **`jabber`** gains a sudden-death all-in
alongside its existing passivity re-engage: when `clock.overtime = 1` and a foe is within
`shuto` range (`≤ 260000`) it commits a `shuto` (its longest hand) rather than play its
usual spacing/block game. Because `clock.overtime` is `0` in all of regulation, the rule
is **inert until sudden death** — every regulation tick is byte-identical, so the jabber's
board behaviour changes only inside the one OT bout it reaches.

**No victim shaping was needed.** Unlike jogai/passivity (whose carrier reads to _avoid_
its own foul, so a separate naive victim had to be authored), overtime bouts arise
naturally from _other_ bots reaching level at the cap — the frozen board already yields
7 of them.

## The "fires" bar is met cleanly — overtime is inherently decisive

Unlike passivity (relaxed to "exercised" because a decisive foul is structurally
infeasible on the all-aggressive roster), overtime **resolves an otherwise-level bout**,
so `endReason: "overtime"` is itself the decisive fire — no relaxation. Measured on the
frozen board: **7 bouts** enter sudden death and **all 7** resolve on a 1-point gap
(none exhaust to the senshu fallback); **5 flip the winner** vs the senshu-only outcome.

| Overtime bout                   | OT score | Winner    | senshu (no-OT) winner |
| ------------------------------- | -------- | --------- | --------------------- |
| `grappler` vs `rekka` seed 2    | 33–36    | `rekka`   | `rekka`               |
| `grappler` vs `rekka` seed 9    | 33–36    | `rekka`   | `rekka`               |
| `grappler` vs `vulture` seed 2  | 42–45    | `vulture` | `grappler` — FLIP     |
| `grappler` vs `vulture` seed 9  | 42–45    | `vulture` | `grappler` — FLIP     |
| `vulture` vs `jabber` seed 3    | 12–7     | `vulture` | `jabber` — FLIP       |
| `vulture` vs `grappler` seed 2  | 45–42    | `vulture` | `grappler` — FLIP     |
| `vulture` vs `grappler` seed 10 | 45–42    | `vulture` | `grappler` — FLIP     |

The CI guard (`gauntlet-calibration.test.ts`) locks the clean bar: **≥ 1 board bout ends
`endReason: "overtime"`**, with the overtime-off counterfactual producing zero (a level
bout would fall straight through to senshu). The jabber's own all-in loses the
`vulture` seed-3 bout it reaches — a realistic sudden-death gamble; the "pays off" of the
mechanic is carried by the 7 natural fires board-wide, not by the light field-read carrier.

## Frozen scoring inputs

Everything below is pinned by `BENCHMARK_VERSION` / `INPUT_HASH` in
`src/engine/benchmark-config.ts` — a change to any of it bumps the version, and these
numbers move with it.

| Input               | Value                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `BENCHMARK_VERSION` | `v17`                                                                                                                |
| Rules               | `CANONICAL_RULES` (unchanged — `npm run fight` stable)                                                               |
| Match               | `winGap: 8`, `senshu: true`, `jogai.margin: 100000`, `passivity.limit: 240`, `overtime.ticks: 300`, `MAX_TICKS: 600` |
| Seeds               | `1..10`                                                                                                              |
| Gauntlet            | `jabber, rekka, zoner, grappler, sweeper, vulture`                                                                   |

Reproduce by running the real aggregator (`benchmark()` in `src/engine/benchmark.ts`)
with the frozen manifest for each member as the submitted bot — 100 fights each
(5 opponents × 10 seeds × 2 sides; the no-mirror rule drops the self-match).

## Round-robin — each member as the submitted bot

Ranking is by **win-rate (primary)**; net-points is the tiebreaker only. **All 6
members stay inside the confirmed `[25%, 75%]` band.**

| Member     | Win-rate | Record (of 100) | Net   | Band `[25%, 75%]` |
| ---------- | -------- | --------------- | ----- | ----------------- |
| `rekka`    | 61.0%    | 61W 39L 0D      | +738  | ✅ in             |
| `sweeper`  | 60.0%    | 60W 40L 0D      | +745  | ✅ in             |
| `grappler` | 52.0%    | 52W 48L 0D      | +137  | ✅ in             |
| `jabber`   | 47.0%    | 47W 53L 0D      | −253  | ✅ in             |
| `zoner`    | 40.0%    | 40W 60L 0D      | −1328 | ✅ in             |
| `vulture`  | 40.0%    | 40W 60L 0D      | −39   | ✅ in             |

### What overtime changed (vs `v16`)

The shift is the 5 sudden-death flips — all involving `grappler` (loses the level bouts
it took on senshu first-blood) and `vulture` (wins them in sudden death):

| Member     | `v16` | `v17` | Why                                                                            |
| ---------- | ----- | ----- | ------------------------------------------------------------------------------ |
| `vulture`  | 35%   | 40%   | wins the level `grappler` bouts in sudden death (+ the `jabber` seed-3 all-in) |
| `grappler` | 56%   | 52%   | loses those 4 level `vulture` bouts it held on senshu                          |
| `jabber`   | 48%   | 47%   | its own OT all-in gambles away the `vulture` seed-3 bout it won on senshu      |
| `rekka`    | 61%   | 61%   | unchanged (its 2 level `grappler` bouts stay `rekka` wins in OT)               |
| `sweeper`  | 60%   | 60%   | unchanged (reaches no level-at-cap bout)                                       |
| `zoner`    | 40%   | 40%   | unchanged                                                                      |

No coupled-bot surgery was needed: the board stayed in band under a pure adoption (the
jabber carrier only perturbs its single OT bout), so the only change is the field-read
rule. The `overtime.ticks` param is a principled constant (half of `MAX_TICKS`), held FIXED.

## Dogfood re-read (authored cold from `docs/spec.md`)

The dogfood record is **unchanged at 13W / 107L / 0D (10.8%)**. Overtime turns exactly one
of its bouts (`grappler`, seed 2) into sudden death, but the winner is unchanged — only its
net shifts +1 (`−1786 → −1785`). The always-attacking dogfood reaches no other level-at-cap
bout, and the jabber's overtime rule never fires against it.

| vs         | Record    | Net |
| ---------- | --------- | --- |
| `grappler` | 12W 8L 0D | —   |
| `vulture`  | 1W 19L 0D | —   |
| `jabber`   | 0W 20L 0D | —   |
| `rekka`    | 0W 20L 0D | —   |
| `zoner`    | 0W 20L 0D | —   |
| `sweeper`  | 0W 20L 0D | —   |

This record is pinned as a characterization in `src/cli/dogfood.test.ts`.
