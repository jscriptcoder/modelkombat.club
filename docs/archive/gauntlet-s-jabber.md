# Plan: S-jabber — rebalance `jabber` back into the round-robin band

**Branch**: feat/jabber-rebalance
**Status**: ✅ Done — shipped `v12` (PR #137), close-out PR #138
**Parent**: `plans/gauntlet-modernization-stories.md` (slice S-jabber, added by S1)

> **Outcome.** `jabber` **19 → 31%** (in band). Final v12 round-robin, all 6 ∈
> `[25,75]`: sweeper 67, grappler 66, vulture 60, rekka 41, zoner 35, jabber 31.
> `jabber` flipped `rekka` 0→11/20 and held `zoner` 19→20/20. Coverage **7/11**
> (`shuto`, via the counter). `benchmark-config.ts` mutation 100% (10/10); full
> suite 1025 green; engine outcome path untouched ⇒ replay byte-identical.

## Goal

Give the `jabber` gauntlet bot a **reactive block + `shuto` counter** so it stops
feeding `vulture`'s parry→counter, lands back inside the `[25%, 75%]` round-robin
band, and covers `shuto` (coverage 6→7/11) — benchmark `v11`→`v12`.

## Design pivot (approved 2026-07-03)

The plan's original lever — a `shuto` **range-poke** — **failed empirically**:
poking at 210–260k stopped `jabber` from advancing, which broke its ONLY winning
matchup (`zoner`, won purely by out-rushing) → **0%**. Four pressure-preserving
tweaks (range-poke, throw-break, block-only, and a narrow-band poke) all failed;
only a **defensive** pivot converged. **Design G (accepted):** keep the advance +
close jab, but add block-on-reaction (`opponent.attackBand` → block that band) and
a counter (`self.counterWindow > 0 → shuto high`). This flips the `rekka` matchup
(0→11/20) and holds `zoner` (19→20/20), landing `jabber` at **31%**. Tradeoff the
user accepted: `jabber` shifts from pure pressure toward a reactive archetype that
partly overlaps `vulture` (still distinct: `jabber` advances + pressures; `vulture`
holds + punishes). `shuto` is covered via the counter (not a range-poke).

## Context (why this slice exists)

S1 gave `vulture` a gas-proof `uraken` counter (reach **200k**). Today's `jabber`
throws only `kizami-zuki` (jab: startup 7, reach 210k, **mid**) and always closes
into range — a startup-7 punch into `vulture`'s reactive guard, which parries it
and counters with `uraken`. The vulture matchup swung hard and `jabber`'s
round-robin aggregate fell **28 → 19%** (OUT-low).

Current v11 round-robin (S1 progress log — the baseline this slice re-confirms first):

| Member     | v11    | Band                  |
| ---------- | ------ | --------------------- |
| `sweeper`  | 67     | ✅                    |
| `grappler` | 66     | ✅                    |
| `vulture`  | 60     | ✅                    |
| `rekka`    | 52     | ✅                    |
| `zoner`    | 36     | ✅ (low edge — watch) |
| `jabber`   | **19** | ❌ **OUT low**        |

**The lever (bot-document redesign only — no `CANONICAL_RULES` change,
`npm run fight` stays byte-identical):** see the **Design pivot** above. The
original hypothesis — a `shuto` range-poke out-ranging the counter — failed the
re-measure; the shipped design is a reactive **block + `shuto` counter**. The
acceptance is **band-membership + coverage**, not a specific rule (grill
Parking-Lot: "move-choice tuning settled empirically").

**Coverage bookkeeping:** `shuto` moves from the S2 (`zoner`) assignment to here.
After S-jabber, S2 covers `{yoko-geri, ushiro-geri}` and S3 covers `{empi,
hiza-geri}`, still reaching 11/11.

## Acceptance Criteria

- [ ] `jabber` references `shuto` in its document (coverage 6→7/11 — via the
      counter rule).
- [ ] Through the real interpreter, `jabber` counters with `shuto high` when
      `self.counterWindow > 0`, and blocks an incoming attack by its band.
- [ ] `jabber`'s pressure core is preserved: it idles when it cannot act, still
      jabs in close, and advances when out of range (regression fences).
- [ ] Re-measured v12 round-robin: **all 6 members ∈ `[25%, 75%]`** — `jabber`
      climbs from 19% into band AND no other member is knocked out (overshoot
      guard, watching `zoner` at the 36% low edge).
- [ ] Downstream characterizations re-pinned for `v12`: `BENCHMARK_VERSION`
      `v11`→`v12`, `INPUT_HASH` recomputed, `benchmark-config.test.ts` version
      assertion updated, `dogfood.test.ts` record re-measured + updated (the
      dogfood fights `jabber`, so its W/L shifts), `docs/spec.md` regenerated.
- [ ] `npm run fight` output is byte-identical (no rules/engine change).

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code
without a failing test. Read `.claude/CLAUDE.md` + the testing rules before code.

### Slice 1: `jabber` pokes a knife-hand at counter-safe range and returns to band

**Value**: The benchmark instrument regains an all-6-in-band roster (honest
scoring) and covers `shuto`; the LLM-authoring score stops being skewed by a
degenerate out-of-band member.
**Path**: `bots/jabber.json` (the redesigned document) → `loadBotDoc` gate →
`runTick` decision contract (unit) → the real `benchmark()` round-robin over the
frozen gauntlet (characterization) → `BENCHMARK_VERSION`/`INPUT_HASH` re-pin →
`docs/spec.md` regen. Intentionally skipped: touching `rekka`/`zoner`/`grappler`/
`sweeper`/`vulture` (redistribute via `jabber` only; a cross-bot edit is the S4
escalation, not this slice).
**Required implementation skills**: Before code changes, load `tdd`, `testing`,
`mutation-testing`, and `refactoring`.
**Acceptance criteria** (present + confirm before any code):

1. New `src/cli/jabber.test.ts` (mirroring `vulture.test.ts`): loads the real
   `bots/jabber.json` via `loadBotDoc`, drives `runTick(jabber, state, {},
CANONICAL_RULES)` through a full-`State` factory. **RED vs v11** (verified by
   stashing the bot to HEAD: 5 fail, 3 fences pass):
   - **Counter:** `self.counterWindow` 1 → `{ type: "attack", move: "shuto",
band: "high" }` (covers `shuto`). Counter rule takes priority over the block.
   - **Block on reaction:** `opponent.attackBand` 3/2/1 → `block` high/mid/low —
     even inside jab range (block priority over the jab).
   - **Fences (pass on v11 too):** close jab retained (`kizami-zuki` mid at 150k),
     advance when out of range + unthreatened, idle when `canAct` 0.
2. `jabber` references `shuto` (via the counter — coverage 6→7/11).
3. Re-measured v12 round-robin has all 6 members ∈ `[25, 75]` (the real goal):
   sweeper 67, grappler 66, vulture 60, rekka 41, zoner 35, **jabber 31**.

**RED**: `src/cli/jabber.test.ts` — the counter case (`counterWindow` 1 → `shuto
high`) and the three block cases (`attackBand` 3/2/1 → block that band) fail on
v11 (verified by stashing the bot to HEAD: 5 fail, 3 fences pass). Mutator-aware
fences in the same file: the **band** literal on each block (assert the exact
band, not just `type === "block"`), the `move`/`band` literals on the counter
(`shuto`/`high`, covering `shuto`), rule **ordering** (counter-before-block via a
`counterWindow` + `attackBand` case; block-before-jab via an in-jab-range block
case).
**GREEN**: Edit `bots/jabber.json` — add, after the idle guard, a counter rule
(`self.counterWindow > 0 → shuto high`) then block-by-band rules
(`opponent.attackBand` 3/2/1 → block high/mid/low), above the existing close jab +
advance default. Rule shape tuned against the re-measure (design G).
**MUTATE**: Bots are DATA (Stryker doesn't mutate JSON) — test effectiveness here
is **structural**: the RED distinguishes new-vs-old `jabber` and pins the exact
move/band/boundary. The only mutated _production_ file is
`src/engine/benchmark-config.ts` (the `v12` + `INPUT_HASH` constants); run
`mutation:diff` there and confirm the `benchmark-config.test.ts` guard tests keep
100% (S1 precedent: 10/10). Re-pin `INPUT_HASH` from the guard test's printed
drift value.
**KILL MUTANTS**: Address survivors on `benchmark-config.ts`; ensure the
version/hash constants are pinned by the guard tests, not merely referenced.
**Empirical tuning loop (inside GREEN, gated by the re-measure — NOT more prod
code, it's data tuning):** run the 6× round-robin; if `jabber` is still < 25% or
if the poke over-corrects and `jabber` > 75% (or knocks `zoner` < 25%), adjust
the `jabber` rule (range gate / band / whether to also poke `high`) and re-measure.
**Escalation cap (from the parent split):** redistribute via `jabber` only. If no
`jabber`-only shape lands all 6 in band, **halt and surface it** as an S4
balance-tuning decision (a design finding) — do not silently nerf another bot.
**REFACTOR**: Assess only — the change is a data document + two constants;
likely nothing to restructure.
**Done when**: all Slice-1 acceptance criteria met; v12 round-robin table
recorded; `dogfood.test.ts`, `benchmark-config.ts` (+ its test), and `docs/spec.md`
re-pinned to `v12`; typecheck + lint + full suite green; `npm run fight`
byte-identical; mutation report reviewed; human approves commit.

### Slice 2: Close out S-jabber

**Value**: The design trail is complete and the parent split reflects reality;
the next slice (S2 `zoner`) can start from an accurate coverage/band ledger.
**Path**: docs only — archive this plan, update the parent split + STATUS +
archive README. Separate PR (S1 precedent: feature PR #135 → close-out PR #136).
**Required implementation skills**: none (docs); no production code, so no TDD
cycle — this is the archival housekeeping slice.
**Acceptance criteria**:

- `plans/jabber-rebalance.md` → `docs/archive/gauntlet-s-jabber.md` (git mv),
  Status marked Done, with the final v12 round-robin table.
- `docs/archive/README.md`: add the S-jabber entry under "Gauntlet modernization".
- `plans/gauntlet-modernization-stories.md`: progress-log entry for S-jabber
  (v12 table + coverage 7/11 + the shuto→S-jabber coverage reassignment), and
  update the remaining sequence (S2 now `{yoko-geri, ushiro-geri}`).
- `docs/STATUS.md`: build-log entry for S-jabber + "Next in pipeline" refreshed.
- Working tree clean; `format:check` passes (LF-normalize the moved file).
  **Done when**: close-out PR merged; `plans/` holds only the live parent split.

## Pre-PR Quality Gate

Before the Slice-1 PR:

1. Mutation testing — `mutation:diff` on `src/engine/benchmark-config.ts`; confirm
   guard tests pin `v12` + `INPUT_HASH` (target 100%, S1 precedent).
2. Refactoring assessment — run `refactoring` (expected: nothing to do).
3. `npm run typecheck` + `npm run lint` + full `npm test` green.
4. `npm run fight` byte-identical (no engine/rules change).
5. Coverage bookkeeping noted: `shuto` covered ⇒ 7/11; S2 reassigned to
   `{yoko-geri, ushiro-geri}`.

Note: `.stryker-tmp/` is gitignored but `rm -rf` it before a full-suite run.

---

_Delete/relocate this file per the archive-plans-not-delete convention when the
plan is complete (S1 precedent: `git mv` to `docs/archive/`)._
