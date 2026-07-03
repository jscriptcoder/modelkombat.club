# Benchmark gauntlet measurement — `v14` (calibration lock)

The certification that closes the **gauntlet modernization + rebalance** feature. The
frozen 6-bot gauntlet — the LLM benchmark's measuring instrument — now satisfies both
end-state conditions of the modernization:

1. **Calibrated** — all 6 members score inside the confirmed `[25%, 75%]` round-robin
   dispersion band (no exploitable pushover, no untested wall).
2. **Arsenal-representative** — the roster collectively references all **11**
   `CANONICAL_RULES.moves` techniques, so a submitted bot's score is tested across the
   full strategic space.

Both invariants are pinned by the **CI lock** in `src/cli/gauntlet-calibration.test.ts`
(a band-membership test + a full-coverage test, each with a companion "guard bites"
proof), so any future bot/rules change that breaks either fails the build.

## Frozen scoring inputs

Everything below is pinned by `BENCHMARK_VERSION` / `INPUT_HASH` in
`src/engine/benchmark-config.ts` — a change to any of it bumps the version, and these
numbers move with it. (The gauntlet bot texts are LF-pinned via `.gitattributes` so the
`INPUT_HASH` digest is byte-stable on every platform.)

| Input               | Value                                              |
| ------------------- | -------------------------------------------------- |
| `BENCHMARK_VERSION` | `v14`                                              |
| Rules               | `CANONICAL_RULES` (`knockdownDuration: 18`)        |
| Match               | `winGap: 8`, `senshu: true`, `MAX_TICKS: 600`      |
| Seeds               | `1..10`                                            |
| Gauntlet            | `jabber, rekka, zoner, grappler, sweeper, vulture` |

Reproduce by running the real aggregator (`benchmark()` in `src/engine/benchmark.ts`)
with the frozen manifest for each member as the submitted bot — 100 fights each (5
opponents × 10 seeds × 2 sides; the no-mirror rule drops the self-match).

## Round-robin — each member as the submitted bot

Ranking is by **win-rate (primary)**; net-points is the tiebreaker only. Under senshu
every bout is decisive — **0 draws everywhere** (a level cap is resolved by first blood).

| Member     | Win-rate | Record (of 100) | Net   | Band `[25%, 75%]` |
| ---------- | -------- | --------------- | ----- | ----------------- |
| `vulture`  | 68.0%    | 68W 32L 0D      | +402  | ✅ in             |
| `sweeper`  | 67.0%    | 67W 33L 0D      | +860  | ✅ in             |
| `grappler` | 58.0%    | 58W 42L 0D      | +166  | ✅ in             |
| `rekka`    | 41.0%    | 41W 59L 0D      | +412  | ✅ in             |
| `zoner`    | 35.0%    | 35W 65L 0D      | −1386 | ✅ in             |
| `jabber`   | 31.0%    | 31W 69L 0D      | −454  | ✅ in             |

**All 6 members inside the confirmed `[25%, 75%]` band.** The nearest edges have
margin — `jabber` +6 above the floor, `vulture` −7 below the ceiling — so the
membership invariant is robust, not knife-edge.

## Arsenal coverage — all 11 techniques referenced

| Technique      | Referenced by                           |
| -------------- | --------------------------------------- |
| `sweep`        | `sweeper`                               |
| `kizami-zuki`  | `jabber`, `rekka`                       |
| `gyaku-zuki`   | `rekka`, `zoner`, `grappler`, `sweeper` |
| `mae-geri`     | `zoner`                                 |
| `mawashi-geri` | `rekka`, `zoner`, `vulture`             |
| `uraken`       | `vulture`                               |
| `shuto`        | `jabber`                                |
| `yoko-geri`    | `zoner`                                 |
| `ushiro-geri`  | `zoner`                                 |
| `empi`         | `grappler`                              |
| `hiza-geri`    | `grappler`                              |

A move is "referenced" when a member emits it — via an `attack` action's `move`, or (for
`sweep`) its own action tag. **11 / 11 — full arsenal.**

## How the gauntlet reached calibration (`v10` → `v14`)

A **coupled round-robin** (mean win-rate pinned at ~50%, so the band is a _dispersion_
target and every bot edit perturbs all six), re-authored **one bot per PR** — the lever
is bot-document redesign only, never a `CANONICAL_RULES` change:

| Slice        | Bot        | Change                                                                             | Version |
| ------------ | ---------- | ---------------------------------------------------------------------------------- | ------- |
| **S1**       | `vulture`  | parry→counter (`uraken`) — fixed the 16% low tail, pulled `sweeper` 82→67% in-band | `v11`   |
| **S-jabber** | `jabber`   | block + `shuto` counter — restored the 19% regression to 31%                       | `v12`   |
| **S2**       | `zoner`    | `yoko-geri` + `ushiro-geri`, narrow-gated (no healthy niche)                       | `v13`   |
| **S3**       | `grappler` | `empi` + `hiza-geri` knockdown→okizeme, real integration                           | `v14`   |
| **S4**       | —          | calibration + coverage lock (this doc); no scoring change                          | `v14`   |

**Findings carried in the archive:** niche techniques can conflict with tight
calibration — `zoner`'s far kicks had no healthy niche (narrow-gated to a rare sliver);
`grappler`'s close moves are throw-dominated, so a broad strike layer fed `vulture`'s
parry→counter to 80% (OUT) until the throw was kept owning the 95–120k contact band
(distinguish by **range, not read** — no guard/counter-readiness tell exists in the
perceived snapshot). See `docs/archive/gauntlet-s*.md`.
