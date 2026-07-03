# Gauntlet modernization + rebalance — child-story split

Feeds `planning` (one child story → one PR plan at a time). Resolved decision
tree captured in the grill session (2026-07-03); this split is condition (C):
**collective coverage of all 12 moves + all 6 members in the `[25%, 75%]` band.**

## Parent

The benchmark gauntlet is a **calibrated, arsenal-representative measuring
instrument**: all 6 members score within the confirmed `[25%, 75%]` round-robin
band, **and** the gauntlet collectively exercises all 12 moves of the post-Batch-1
arsenal — so an LLM-authored bot's benchmark score honestly discriminates
authoring skill across the full strategic space.

Current state (the constraint): `vulture` 16% (low — a whole reactive-defense axis
untested), `sweeper` 82% (high — senshu-surfaced in D1), and **0 of the 6 Batch-1
moves** (`uraken`, `shuto`, `yoko-geri`, `ushiro-geri`, `empi`, `hiza-geri`) used by
any member. It is a **coupled round-robin** (every bot change perturbs all six
win-rates) whose mean is pinned at 50% — so this is a **dispersion-tightening +
coverage** problem, executed **one bot per PR**. Lever is **bot-document redesign
only** — no `CANONICAL_RULES` change, `npm run fight` stays byte-identical.

## Recommended First Slice

**S1 — redesign `vulture` into a disciplined parry→counter defender** (gas-proof
`uraken` counter): fixes the low tail and covers the first Batch-1 move.

Why first: highest **value** (the actual defect) + highest **learning** (burns down
the core risk — can a reactive counter-bot land parries _and_ counters under 6-tick
`lAct` latency? a prior naive buff failed 16→7%) + a potential **bargain** (a strong
`vulture` may drag `sweeper`'s 82% back in-band via the round-robin, making S2/S3
coverage-only and lower-risk).

## Split Candidates

| Slice                                                 | Value                                                                                             | Includes                                                                                                                                                                                                                                                                                                                                                 | Defers                                                                      | Acceptance Examples                                                                                                                                                                                                                                                                                                          | Release           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **S1 · `vulture` parry→counter**                      | Fixes low tail; covers `uraken`; tests the "strengthen the field" thesis                          | New rule `self.counterWindow>0 → attack` with a **gas-proof** `uraken` counter; keep defensive core + throw-break + block-by-band; re-measure round-robin; bump `v11`; re-pin `INPUT_HASH`; update `dogfood.test.ts` characterization; note in gauntlet doc                                                                                              | zoner/grappler; the capability band/coverage acceptance tests (until green) | **Behavioral (RED vs current):** foe strikes into `vulture`'s fresh matching guard → `vulture` parries, lands `uraken` within `counterWindow`, scores the +1 bonus. **Coverage:** `vulture` references `uraken`. **Characterization:** `vulture` v11 win-rate pinned; dogfood record updated; `npm run fight` byte-identical | Shippable (`v11`) |
| **S2 · `zoner` long-range**                           | Covers `yoko-geri`+`ushiro-geri`+`shuto`; lifts low-ish `zoner` (36%); erodes `sweeper` high tail | `zoner` gains beyond-neutral pokes gated to their reach bands; re-measure; bump `v12`; `INPUT_HASH`; dogfood update; doc note                                                                                                                                                                                                                            | grappler; final lock                                                        | **Behavioral (RED):** at a gap where sweep/reverse whiff (>300k), `zoner` lands `yoko-geri` and scores. **Coverage:** references `yoko-geri`, `ushiro-geri`, `shuto`. **Characterization:** round-robin re-pin; **overshoot guard** `zoner ≤ 75%`                                                                            | Shippable (`v12`) |
| **S3 · `grappler` close-range**                       | Covers `empi`+`hiza-geri` ⇒ **full 12-move coverage**; deepens close game                         | `grappler` gains point-blank `empi` + `hiza-geri` knockdown→okizeme finish; re-measure; bump `v13`; `INPUT_HASH`; dogfood update                                                                                                                                                                                                                         | final lock if convergence not yet reached                                   | **Behavioral (RED):** point-blank, `grappler` lands `hiza-geri` knockdown then finishes inside `finishWindow` for 3. **Coverage:** references `empi`, `hiza-geri` ⇒ all 12 covered. **Characterization:** round-robin re-pin                                                                                                 | Shippable (`v13`) |
| **S4 · calibration lock + close-out** _(contingency)_ | Certifies the instrument: CI-enforced balance + coverage; publishes the balanced gauntlet         | Land the **capability acceptance tests** (band-membership `[25,75]` for all 6 + full-coverage) once both hold; write final `gauntlet-vN.md`; update `docs/STATUS.md` + memory; archive this split. **If** a member is still out-of-band after S3 → this is the **one** balance-tuning PR (escalation cap); if still non-convergent → **halt + re-grill** | —                                                                           | **Band test:** all 6 ∈ `[25,75]` (green). **Coverage test:** every `CANONICAL_RULES.moves` key referenced (green). **Doc:** `gauntlet-vN` records + coverage map                                                                                                                                                             | Shippable (final) |

The capability acceptance tests (band + full-coverage) are **RED until both
conditions first hold**, so they land in whichever slice achieves them (likely S3
or S4), **not** S1 — keeping every increment green. Per-slice RED is a **focused
behavioral test**, not the capability acceptance test.

## Parking Lot

- **Baseline re-measure at `v10` — ✅ DONE (2026-07-03).** Byte-identical to the `v4`
  doc (`sweeper` 82% OUT-high, `vulture` 16% OUT-low; nets +1430/+1483/+265/−1329/−1566/−283;
  coverage 5/11, uncovered = the 6 Batch-1 moves). Confirms the Batch-1 keys are
  outcome-neutral while unused. `sweeper` needs ≥7pts to re-enter band; `vulture`
  meets it in 20 fights ⇒ S1 may pull `sweeper` in on its own (the bargain hypothesis).
- **Round-robin tooling** — 6× `benchmark()` runs; consider a small measurement
  helper + whether the band test is a **slower/dedicated suite** (precedent:
  `dogfood.test.ts` runs 120 fights).
- **Escalation contingency** — if S1 alone brings all in-band, S2/S3 become
  **coverage-only** (still wanted for representativeness). If S4 tuning still won't
  converge → halt + re-grill (a design finding, not more tuning).
- **`jabber`/`rekka`/`sweeper` intentionally NOT re-armed** — end-state (C) coverage
  is met by S1–S3; touch them only if the balance escalation demands it.
- **No-Pareto-dominance property test** (STATUS "next" item 1) is orthogonal (rules,
  not bots) — not a dependency, but could be sequenced alongside.
- **Move-choice tuning** (exact counter move, exact `zoner` range gates) settled
  empirically in each slice's planning/TDD.

## Warnings

- **Looks like a component split.** Mitigation: each slice is a demonstrable
  **calibration+coverage increment of the instrument** (works, improves the score's
  honesty, generates re-measure feedback), not "build bot X." Each is independently
  shippable/testable.
- **Coupled round-robin** — exact win-rates can't be precision-dialed; acceptance is
  **band-membership**, not exact numbers. Every slice re-pins downstream
  characterizations (dogfood + round-robin + `INPUT_HASH`).
- **Overshoot risk** — arming `zoner` with the two longest kicks could push it >75%;
  S2 carries an overshoot guard + **redistribute-don't-cram**.

## Progress log

- **S1 (`vulture` parry→counter) — ✅ DONE (`v11`, branch `feat/vulture-parry-counter`).**
  Added one rule (`self.counterWindow > 0 → attack uraken high`). Re-measure:

  | Member     | v10   | **v11** | Band                                  |
  | ---------- | ----- | ------- | ------------------------------------- |
  | `sweeper`  | 82 ❌ | **67**  | ✅ (bargain held — no `sweeper` edit) |
  | `grappler` | 66    | **66**  | ✅                                    |
  | `vulture`  | 16 ❌ | **60**  | ✅ (fixed)                            |
  | `rekka`    | 72    | **52**  | ✅                                    |
  | `zoner`    | 36    | **36**  | ✅                                    |
  | `jabber`   | 28    | **19**  | ❌ **OUT low (new)**                  |

  Both original outliers fixed; net calibration 2 outliers → 1. The counter feasts on
  startup-7 punch-spam, so `jabber` (pure jab-spam) fell out — **accepted, deferred to a
  new slice** (escalation ladder: redistribute, don't nerf `vulture`). Coverage now 6/11
  (`uraken` added). Spec regenerated (embeds the `vulture` example + version).

- **S-jabber (`jabber` block+counter) — ✅ DONE (`v12`, PR #137; archived
  [`docs/archive/gauntlet-s-jabber.md`](../docs/archive/gauntlet-s-jabber.md)).** The
  planned `shuto` **range-poke failed** (it broke `jabber`'s only winning matchup,
  `zoner` → 0%); pivoted (user-approved) to a reactive **block-on-reaction + `shuto`
  counter**. Re-measure — all 6 back in band:

  | Member     | v11   | **v12** | Band                         |
  | ---------- | ----- | ------- | ---------------------------- |
  | `sweeper`  | 67    | **67**  | ✅                           |
  | `grappler` | 66    | **66**  | ✅                           |
  | `vulture`  | 60    | **60**  | ✅                           |
  | `rekka`    | 52    | **41**  | ✅ (jabber took wins here)   |
  | `zoner`    | 36    | **35**  | ✅                           |
  | `jabber`   | 19 ❌ | **31**  | ✅ (fixed — flipped `rekka`) |

  `jabber` flipped `rekka` 0→11/20 and held `zoner` 19→20/20. Coverage now **7/11**
  (`shuto`, via the counter — so `shuto` is REASSIGNED off S2). Tradeoff accepted:
  `jabber` gains a reactive layer that partly overlaps `vulture` (still distinct —
  `jabber` advances + pressures). `benchmark-config.ts` mutation 100% (10/10);
  dogfood record unchanged (18W/102L).

- **S2 (`zoner` long kicks) — ✅ DONE (`v13`, PR #139; archived
  [`docs/archive/gauntlet-s2-zoner.md`](../docs/archive/gauntlet-s2-zoner.md)).** `zoner`
  gained `yoko-geri` + `ushiro-geri`. **Finding:** these slow beyond-neutral kicks have
  **no healthy niche** — fired broadly they cost `zoner` its `vulture` matchup (`zoner`
  35→26, `vulture` 60→70). So (user-approved) they are **narrow-gated** to the top sliver
  (`yoko` 310–320k, `ushiro` 320–330k): the two moves are referenced + reachable (coverage
  **9/11**) while the **v13 board = v12 board** (calibration untouched): sweeper 67,
  grappler 66, vulture 60, rekka 41, zoner 35, jabber 31. Mutation 100% (10/10); dogfood
  unchanged. **Lesson for S4:** condition (C)'s "all 12 moves collectively exercised" can
  conflict with tight calibration for niche moves — narrow-gating satisfies the "referenced"
  bar without degrading the band.

## Revised remaining sequence

Coverage now **9/11** (`shuto` on `jabber`; `yoko-geri` + `ushiro-geri` on `zoner`;
uncovered = `empi`, `hiza-geri`). Remaining (re-measure after each; final lock lands when
all-6-in-band **and** 11/11 moves covered):

- **S3 · `grappler`** — close-range (`empi`, `hiza-geri`) ⇒ completes **11/11** coverage.
  Watch the `empi`/`hiza-geri` niche (like `zoner`'s long kicks, they may need narrow gating
  to preserve calibration).
- **S4 · calibration lock + close-out** — land the band + coverage acceptance tests, write
  the final `gauntlet-vN` doc, update `docs/STATUS.md`, archive the split.

## Next Step

S2 shipped (`v13`, all 6 in band, coverage 9/11). Next: load `planning` for **S3
(`grappler` close-range: `empi` + `hiza-geri`)** — start from a fresh `v13` re-measure.
Completing S3's coverage brings the roster to 11/11, unblocking the S4 lock. Carry the S2
lesson: if the close moves have no healthy niche, narrow-gate them to preserve the band.
