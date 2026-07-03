# Plan: S2 — `zoner` gains the beyond-neutral long kicks

**Branch**: feat/zoner-long-range
**Status**: ✅ Done — shipped `v13` (PR #139), close-out PR #140
**Parent**: `plans/gauntlet-modernization-stories.md` (slice S2)

> **Outcome.** `zoner` gained `yoko-geri` (gated 310–320k) + `ushiro-geri` (gated
> 320–330k), **narrow-gated** so the two moves are covered without disturbing the
> calibration. v13 board = v12 board (all 6 ∈ `[25,75]`): sweeper 67, grappler 66,
> vulture 60, rekka 41, zoner 35, jabber 31. Coverage **9/11** (uncovered: `empi`,
> `hiza-geri` — S3). `benchmark-config.ts` mutation 100% (10/10); full suite 1031
> green; dogfood unchanged (18W/102L); engine untouched ⇒ replay byte-identical.
> **Finding:** the beyond-neutral kicks have no healthy niche in the frozen roster
> (firing them broadly cost `zoner` its `vulture` matchup); narrow gating is the
> calibration-preserving way to satisfy the "every move referenced" coverage bar.

## Goal

Arm the `zoner` gauntlet bot with the two beyond-neutral kicks — `yoko-geri`
(reach 315k) and `ushiro-geri` (reach 330k) — **narrow-gated** to the top of its
range, covering two more moves (coverage **7→9/11**) while keeping all 6 members in
the `[25%, 75%]` band with the calibration **untouched** — benchmark `v12`→`v13`.

## Design decision (narrow gates — approved 2026-07-04)

**The measured finding:** these two kicks are slow (startup 12/13) and heavily
punishable; in the frozen matchups they have **no healthy niche** — whenever they
actually fire, `zoner` loses the exchange to `vulture`'s patience. Broad gates
(300–330k) dropped `zoner` **35 → 26** and raised `vulture` **60 → 70** (wider
dispersion — the opposite of a calibration slice). So (user-approved) they are
**narrow-gated to the top sliver** — `yoko-geri` **310k–320k**, `ushiro-geri`
**320k–330k** — a spacing that almost never arises. Result: the v12 board is
**preserved** (`zoner` 35, all tight), while the two moves are genuinely
referenced + reachable (decision-contract green) ⇒ coverage 9/11 by the "every
move referenced" bar. Honest caveat: the kicks fire only rarely in fights (nets
shift a few points; no match outcome flips). Calibration — the feature's whole
purpose — is protected. (Alternatives considered: broad gates = real firing but
degraded band; escalating the coverage goal. See the S2 finding note.)

## Context (v12 baseline + the honest read)

Fresh v12 round-robin (all 6 in band):

| Member     | v12 | Band          |
| ---------- | --- | ------------- |
| `sweeper`  | 67  | ✅            |
| `grappler` | 66  | ✅            |
| `vulture`  | 60  | ✅            |
| `rekka`    | 41  | ✅            |
| `zoner`    | 35  | ✅ (low edge) |
| `jabber`   | 31  | ✅            |

`zoner` per-opponent (v12): **wins** `grappler` 20/20 and `vulture` 15/20 (foes
that can't close its kicking range); **loses** `jabber` 0/20, `rekka` 0/20 (net
−900), `sweeper` 0/20 — the bots that **rush inside** its range.

**The honest read (the `jabber` lesson):** `yoko-geri`/`ushiro-geri` are _even
longer, even slower_ kicks (startup 12/13, recovery 20/22, gas-LOCKED cost
48/52). Their signature is reach **> startGap (300k)** — they connect at a gap
where every other move whiffs. But `zoner` loses to foes getting _inside_ (< 240k),
not sitting at 330k, and d > 300k is uncommon in a closing fight. So **do not
assume these moves lift `zoner`.** They are its thematically-correct beyond-neutral
tools, and since `zoner` is already in band, **S2's hard bar is coverage + all-6-
in-band (overshoot guard)**, not lifting `zoner`. If the re-measure shows a lift,
good; if it barely moves and everyone stays in band, that is still S2 done.

**Lever:** bot-document redesign only — no `CANONICAL_RULES` change ⇒ `npm run
fight` byte-identical. The new rules change `zoner` only at d > 300k, so the
round-robin perturbation to the other five is expected to be tiny (low overshoot /
knock-out risk).

## Acceptance Criteria

- [ ] `zoner` references `yoko-geri` and `ushiro-geri` (coverage 7→9/11).
- [ ] Through the real interpreter, `zoner` fires `ushiro-geri high` in its
      **320k–330k** band and `yoko-geri mid` in its **310k–320k** band, while its
      existing ladder (roundhouse at 270–300k, front kick at 240–270k, reverse
      ≤240k, retreat ≤120k, gassed retreat) is preserved — including that a
      **gassed** `zoner` still retreats rather than attempting an unaffordable long
      kick, and that the 300–310k gap falls through to walk-forward.
- [ ] Re-measured v13 round-robin: **all 6 members ∈ `[25%, 75%]`, calibration
      preserved** — the narrow gates hold the v12 board (`zoner` 35, no member
      moved out; nets shift a few points as the kicks fire rarely, no outcome flips).
- [ ] Downstream re-pinned for `v13`: `BENCHMARK_VERSION` `v12`→`v13`, `INPUT_HASH`
      recomputed, `benchmark-config.test.ts` version updated, `dogfood.test.ts`
      re-measured + updated if its record shifts (it fights `zoner`), `docs/spec.md`
      regenerated.
- [ ] `npm run fight` byte-identical (no rules/engine change).

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code
without a failing test. Read `.claude/CLAUDE.md` + the testing rules first.

### Slice 1: `zoner` fires the beyond-neutral kicks at their reach bands, all-6 stay in band

**Value**: The gauntlet instrument covers two more moves (7→9/11) through the bot
whose archetype they belong to, without breaking the calibrated band — one step
closer to the S4 full-coverage lock.
**Path**: `bots/zoner.json` (two added rules) → `loadBotDoc` gate → `runTick`
decision contract (unit) → the real `benchmark()` round-robin (characterization) →
`BENCHMARK_VERSION`/`INPUT_HASH` re-pin → `docs/spec.md` regen. Intentionally
skipped: touching the other five bots (redistribute via `zoner` only; a cross-bot
edit is the S4 escalation).
**Required implementation skills**: Before code changes, load `tdd`, `testing`,
`mutation-testing`, and `refactoring`.
**Acceptance criteria** (present + confirm before code):

1. New `src/cli/zoner.test.ts` (mirroring `jabber.test.ts`): loads the real
   `bots/zoner.json`, drives `runTick(zoner, state, {}, CANONICAL_RULES)` through
   a full-`State` factory. **RED vs v12** (verified by stashing the bot to HEAD:
   3 long-kick cases fail, 3 fences pass):
   - **`ushiro-geri`:** `opponent.distance` 325000 → `{ type: "attack", move:
"ushiro-geri", band: "high" }`. Old `zoner` walks forward (no rule > 300k).
   - **`yoko-geri`:** `opponent.distance` 315000 → `{ type: "attack", move:
"yoko-geri", band: "mid" }`. Old `zoner` walks forward.
   - **Boundary fences (kill off-by-one on the narrow gates):** 300000 →
     `mawashi-geri high` (roundhouse, unchanged); 320000 → `yoko-geri mid` (yoko
     upper edge inclusive); 321000 → `ushiro-geri high` (just past the split).
   - **Ladder preserved:** 250000 → `mae-geri mid`; a **gassed** `zoner` at 325000
     (`self.gassed` 1) → `move` dir −1 (gassed-retreat rule wins — the long kick is
     unaffordable), pinning the new rules sit BELOW the gassed handling.
2. `zoner` references `yoko-geri` + `ushiro-geri` (coverage 7→9/11).
3. Re-measured v13 round-robin: v12 board preserved (all 6 ∈ `[25, 75]`).

**RED**: `src/cli/zoner.test.ts` — the `ushiro-geri`/`yoko-geri` cases fail on v12
(old `zoner` has no rule above the 300k roundhouse band → default walk-forward).
Mutator fences in the same file: the **band** literals (`high` on ushiro, `mid` on
yoko), the `move` literals, the gate **boundaries** (300k/320k/321k), and rule
**ordering** (gassed-retreat before the kicks).
**GREEN**: Edit `bots/zoner.json` — insert, after the gassed rules and above the
`mawashi-geri` (270–300k) rung, two narrow descending-range rules: `320000 < d ≤
330000 → ushiro-geri high`, then `310000 < d ≤ 320000 → yoko-geri mid`. Everything
else unchanged (the opening d=300k roundhouse is preserved; the 300–310k gap falls
through to walk-forward — that is what keeps the calibration untouched).
**MUTATE**: Bots are DATA (Stryker skips JSON) — effectiveness is structural (RED
distinguishes new-vs-old `zoner`, pins the exact moves/bands/boundaries). The only
mutated _production_ file is `src/engine/benchmark-config.ts` (the `v13` +
`INPUT_HASH` constants); run `mutation:diff` there, confirm the guard tests keep
100% (S1/S-jabber precedent: 10/10). Re-pin `INPUT_HASH` from the guard test drift.
**KILL MUTANTS**: Address survivors on `benchmark-config.ts`.
**Empirical loop (inside GREEN — data tuning, not more prod code):** run the 6×
round-robin. Expected: coverage 9/11 achieved; `zoner` roughly steady (the kicks
fire rarely at > 300k), all 6 in band. **If** `zoner` overshoots > 75% → narrow /
raise the gates (redistribute, don't cram). **If** a member drops < 25% or the
kicks _hurt_ `zoner` (the `jabber` failure mode) → reconsider the gates or whether
these moves belong on `zoner` at all (surface as an S4 finding — do not nerf
another bot).
**REFACTOR**: Assess only — two JSON rules + two constants; likely nothing.
**Done when**: all Slice-1 acceptance criteria met; v13 round-robin table
recorded; `dogfood.test.ts`, `benchmark-config.{ts,test.ts}`, `docs/spec.md`
re-pinned to `v13`; typecheck + lint + full suite green; `npm run fight`
byte-identical; mutation report reviewed; human approves commit.

### Slice 2: Close out S2

**Value**: The design trail is current; the parent split reflects 9/11 coverage so
S3 (`grappler`) can start from an accurate ledger.
**Path**: docs only — archive this plan, update the parent split + STATUS + archive
README. Separate PR (S1/S-jabber precedent).
**Required implementation skills**: none (docs); no production code ⇒ no TDD cycle.
**Acceptance criteria**:

- `plans/zoner-long-range.md` → `docs/archive/gauntlet-s2-zoner.md` (git mv),
  Status Done, with the final v13 round-robin table.
- `docs/archive/README.md`: add the S2 entry under "Gauntlet modernization".
- `plans/gauntlet-modernization-stories.md`: progress-log entry for S2 (v13 table
  - coverage 9/11) + remaining sequence updated (only S3 `grappler` + S4 left).
- `docs/STATUS.md`: build-log entry + "Next in pipeline" refreshed.
- Working tree clean; `format:check` passes (LF-normalize the moved file).
  **Done when**: close-out PR merged; `plans/` holds only the live parent split.

## Pre-PR Quality Gate

Before the Slice-1 PR:

1. Mutation — `mutation:diff` on `src/engine/benchmark-config.ts`; guard tests pin
   `v13` + `INPUT_HASH` (target 100%).
2. Refactoring assessment (expected: nothing).
3. `npm run typecheck` + `npm run lint` + full `npm test` green.
4. `npm run fight` byte-identical (no engine/rules change).
5. Coverage bookkeeping: `yoko-geri` + `ushiro-geri` covered ⇒ 9/11; S3
   (`grappler`: `empi`, `hiza-geri`) completes 11/11.

Note: `.stryker-tmp/` is gitignored but `rm -rf` it before a full-suite run.

---

_Relocate this file to `docs/archive/` per the archive-plans-not-delete convention
when the plan is complete (S1/S-jabber precedent: `git mv`)._
