# Archived plans & design records

Completed vertical-slice **plans** and their resolved-decisions / acceptance-criteria
records. Per the planning workflow each plan file was deleted from `plans/` when its
feature shipped; they are recovered here (verbatim from git history, then run through
the current Prettier) as the design trail behind the engine. The live status + roadmap
are in **`docs/STATUS.md`**; the design rationale is in `docs/DESIGN.md` + `docs/spec.md`.

> **Naming caveat.** Roadmap capabilities are **C1–C8** (walking skeleton → sweeps).
> The §7 tie-resolution **stories** are _also_ numbered C1/C2/C3 (senshu / overtime /
> senshu-perception). So `c3-height-bands.md` is roadmap **C3**, but `c2-overtime.md`
> and `c3-senshu-perception.md` are §7 tie-resolution **stories**, not roadmap C2/C3.
> `*-split.md` / `*-story-split` files are story-splitting docs; `*-decisions.md` are
> find-gaps records.

## Core combat tree (roadmap C1–C8)

- **C1 — walking skeleton** (PRs #1–#5): [walking-skeleton.md](walking-skeleton.md)
- **C2 — perception-latency keystone** (PRs #7–#11): [perception-latency.md](perception-latency.md)
- **C3 — height bands** (PRs #15–#16): [c3-height-bands.md](c3-height-bands.md)
- **C4 — vertical axis + occupancy** (PRs #17–#21): [c4-vertical-axis-occupancy.md](c4-vertical-axis-occupancy.md)
- **C5 — parry windows** (PRs #23–#25): [c5-parry-windows.md](c5-parry-windows.md)
- **C6 — on-contact cancel combos** (PRs #26–#28): [c6-cancel-combos.md](c6-cancel-combos.md)
- **C7 — throw triangle + knockdown** (PRs #29–#33): [throw-triangle.md](throw-triangle.md)
- **C8 — sweeps + limited okizeme** (PRs #35–#38): [c8-sweeps-okizeme.md](c8-sweeps-okizeme.md)

## Canonical frame table (PRs #44–#49)

- [canonical-frame-table.md](canonical-frame-table.md) — the plan
- [canonical-frame-table-decisions.md](canonical-frame-table-decisions.md) — find-gaps decisions

## C10 — stamina economy (PRs #51–#65)

- [c10-stamina.md](c10-stamina.md) — Story 1 (self meter)
- [c10-stamina-split.md](c10-stamina-split.md) — the story split (Stories 2–4)
- [c10-stamina-story2.md](c10-stamina-story2.md) — guard contact-chip
- [c10-stamina-story3.md](c10-stamina-story3.md) — gassing penalty
- [c10-stamina-story4.md](c10-stamina-story4.md) — opponent stamina read
- [c10-canonical-stamina.md](c10-canonical-stamina.md) — canonical wiring

## C9 — multi-move "real karate" arsenal (PRs #67–#76)

- [c9-arsenal-foundation.md](c9-arsenal-foundation.md) — band-legality gate + jab
- [c9-arsenal-split.md](c9-arsenal-split.md) — the story split
- [c9-gyaku-zuki.md](c9-gyaku-zuki.md) — reverse punch
- [c9-mae-geri.md](c9-mae-geri.md) — front kick
- [c9-mawashi-geri.md](c9-mawashi-geri.md) — roundhouse + `scoreByBand`
- [c9-cross-move-cancels.md](c9-cross-move-cancels.md) — the rekka cancel web
- [c9-canonical-arsenal.md](c9-canonical-arsenal.md) — canonical wiring + `strike` retirement

## LLM benchmark + match structure

- **LLM one-shot bot-authoring benchmark v1** (PRs #79–#86, #95): [llm-benchmark-v1.md](llm-benchmark-v1.md)
- **Benchmark WKF match structure** — yame + win condition (PRs #87–#93): [benchmark-match-structure.md](benchmark-match-structure.md)

## §7 match officiating

- **Story-split tracker** (§7 remainder, PRs #97–#114): [s7-match-structure.md](s7-match-structure.md)
- **Capability A — jogai** (ring-out, PRs #97–#99): [jogai-out-zone-reset.md](jogai-out-zone-reset.md) · [jogai-warning-ladder.md](jogai-warning-ladder.md) · [penalty-perception.md](penalty-perception.md)
- **Capability B — passivity** (non-engagement, PRs #100–#103): [passivity-clock.md](passivity-clock.md) · [passivity-penalty.md](passivity-penalty.md) · [passivity-self-read.md](passivity-self-read.md) · [passivity-opponent-read.md](passivity-opponent-read.md)
- **Capability C — tie resolution** (PRs #104–#110): [senshu-tiebreak.md](senshu-tiebreak.md) (C1) · [c2-overtime.md](c2-overtime.md) (C2) · [c3-senshu-perception.md](c3-senshu-perception.md) (C3)
- **Capability D — benchmark + spec senshu adoption** (PRs #113–#114): [d-benchmark-spec-adoption.md](d-benchmark-spec-adoption.md)

## Batch-1 arsenal expansion (real-karate move roster)

Design source of truth (living): [../move-roster.md](../move-roster.md) — balance law + the 6 resolved Batch-1 frame blocks.

- **`uraken` — backfist** (move #1/6; Slice 1 wiring #117, Slice 2 `rule()` readers #118): [uraken-backfist.md](uraken-backfist.md)
- **`shuto` — knife-hand** (move #2/6; Slice 1 wiring #120, Slice 2 `rule()` readers #121): [shuto-knife-hand.md](shuto-knife-hand.md)
- **`yoko-geri` — side kick** (move #3/6; Slice 1 wiring #123 → benchmark v7, Slice 2 `rule()` readers #124): [yoko-geri-side-kick.md](yoko-geri-side-kick.md)
- **`ushiro-geri` — back kick** (move #4/6; Slice 1 wiring #126 → benchmark v8, Slice 2 `rule()` readers #127): [ushiro-geri-back-kick.md](ushiro-geri-back-kick.md)
- **`empi` — elbow** (move #5/6; Slice 1 wiring #129 → benchmark v9, Slice 2 `rule()` readers #130): [empi-elbow.md](empi-elbow.md)
