# Plan: S3 — `grappler` gains the close-range knee + elbow

**Branch**: feat/grappler-close-range
**Status**: Active
**Parent**: `plans/gauntlet-modernization-stories.md` (slice S3)

## Goal

Arm the `grappler` gauntlet bot with the two remaining uncovered moves — `empi`
(elbow, reach 95k) and `hiza-geri` (knee, reach 110k → knockdown → okizeme finish) —
**woven into its close game as a real strike/throw infight** (not a cosmetic gate),
completing arsenal coverage **9→11/11** while keeping all 6 members in the
`[25%, 75%]` band — benchmark `v13`→`v14`.

## Design decision (real integration, fall back if needed — approved 2026-07-04)

**The direction (user-approved):** give `grappler` a _genuine_ close infight — a
point-blank `empi`, and a `hiza-geri` knockdown that opens the okizeme
finishWindow for a `gyaku-zuki` finish (score 3), reusing the sweeper's proven
C8 okizeme pattern. The moves actually fire in fights, so the "all 11 collectively
exercised" coverage goal is served in **substance**, not just by the "referenced"
letter (the honest gap the S2 zoner narrow-gate left, and that S4 flagged).

**Why grappler is harder than zoner (the structural finding):** `empi` (95k) and
`hiza-geri` (110k) both reach _strictly inside_ grappler's throw range (≤120k), and
the throw out-scores them (ippon 3 vs elbow 2 / knee-0). So they are **range-
dominated** — there is no distance where they connect but the throw doesn't. And
grappler **lives at close range** (it advances to contact every tick), so unlike
zoner's long kicks — which hid in a far sliver (d > 300k) that almost never arises —
there is **no naturally-rare band** in grappler's core range to hide them in. Any
close sub-band fires _often_. That means real integration necessarily **perturbs the
round-robin**, and `grappler` is already band-high (**66%**), so the flagged risk is
**overshoot > 75%** (the knee→okizeme is a strong 3-point path) or a **drop** (trading
guaranteed ippon throws for slower, breakable close strikes).

**The fallback (the escalation cap):** if the empirical loop cannot hold `grappler`
in `[25,75]` **and** keep the other five in band using `grappler`'s own document
alone, do **not** reach for a cross-bot nerf (that is the S4 escalation). Instead
fall back to **reachable-but-rare** gating (the S2 precedent): gate `empi`/`hiza-geri`
on states a decision-contract test constructs but that ~never arise vs the frozen 6,
so they are referenced + reachable (coverage bar met) while the v13 board stays
byte-identical. Record which path landed as the S3 finding.

## Context (v13 baseline + the range map)

Fresh v13 round-robin (all 6 in band — the board S2 preserved):

| Member     | v13 | Band           |
| ---------- | --- | -------------- |
| `sweeper`  | 67  | ✅             |
| `grappler` | 66  | ✅ (high edge) |
| `vulture`  | 60  | ✅             |
| `rekka`    | 41  | ✅             |
| `zoner`    | 35  | ✅             |
| `jabber`   | 31  | ✅             |

Coverage **9/11**; uncovered = `empi`, `hiza-geri`.

**Current `grappler` (3 rules):** (1) `opponent.throwing → throw-break`; (2)
`self.canAct ∧ d ≤ 120000 → throw`; default `move dir 1`. A pure advance-and-throw
grappler with a defensive throw-break.

**The close range map** (throw reach 120k):

| Gap band          | Moves that reach       | Recommended pick               |
| ----------------- | ---------------------- | ------------------------------ |
| `d ≤ 95000`       | empi, hiza-geri, throw | `empi mid` (point-blank elbow) |
| `95k < d ≤ 110k`  | hiza-geri, throw       | `hiza-geri mid` (knee→okizeme) |
| `110k < d ≤ 120k` | throw only             | `throw` (ippon, preserved)     |
| `d > 120000`      | —                      | `move dir 1` (advance)         |

**Frame facts** (from `CANONICAL_RULES`, unchanged): `empi` startup 8 / recovery 14 /
reach 95k / score 2 flat (high·mid) / cost 38 (gas-locked) / `cancelInto gyaku-zuki`.
`hiza-geri` startup 9 / recovery 16 / reach 110k / **score 0 + knockdown** / mid-only /
cost 40 / `cancelInto gyaku-zuki`. Knockdown opens `finishWindow` (10 ticks); a
`gyaku-zuki` inside it scores `finishScore` **3**, ignoring band/guard/occupancy —
the sweeper's `sweep→finish` machinery lifted to a standing mid knee.

**Recommended starting design (real integration — to test, then tune):**

```
rules:
1. self.finishWindow > 0            → attack gyaku-zuki mid   (okizeme finisher — sweeper pattern)
2. opponent.throwing == 1           → throw-break             (defensive core, kept)
3. self.canAct ∧ d ≤ 95000          → attack empi mid         (point-blank elbow, score 2)
4. self.canAct ∧ d ≤ 110000         → attack hiza-geri mid    (knee → knockdown → okizeme)
5. self.canAct ∧ d ≤ 120000         → throw                   (ippon, kept — the 110–120k sliver)
default: move dir 1
```

Rule 1 (finisher) sits **top** so a landed knee's finishWindow fires `gyaku-zuki`
before grappler re-knees (mirrors `sweeper`). On the approach grappler still throws
at first contact (~118k); it only knees/elbows if the foe is deeper inside. The
finisher was **dormant** on old grappler (it never created a knockdown), so this only
perturbs grappler's own close fights.

**Lever:** bot-document redesign only — **no `CANONICAL_RULES` change** ⇒ the engine
outcome path is untouched, replay determinism intact, `npm run fight` demo
byte-identical.

## Acceptance Criteria

- [ ] `grappler` references `empi` and `hiza-geri` (coverage **9→11/11** — every
      `CANONICAL_RULES.moves` key now used by some member).
- [ ] Through the real interpreter, `grappler` fires: `empi mid` at `d ≤ 95000`;
      `hiza-geri mid` at `95000 < d ≤ 110000`; `gyaku-zuki` (the okizeme finisher)
      when `self.finishWindow > 0`; while its existing game is preserved — `throw`
      still fires in the `110000 < d ≤ 120000` sliver, `throw-break` still answers
      `opponent.throwing`, and it advances at `d > 120000`.
- [ ] Re-measured v14 round-robin: **all 6 members ∈ `[25%, 75%]`** — `grappler`
      stays in band (overshoot guard `≤ 75%`; drop guard `≥ 25%`) and no other member
      is knocked out. If genuine integration cannot hold the band via grappler's own
      document, the **reachable-but-rare fallback** is applied and the board stays the
      v13 board (byte-identical) — either outcome satisfies this AC; the finding is
      recorded.
- [ ] Downstream re-pinned for `v14`: `BENCHMARK_VERSION` `v13`→`v14`, `INPUT_HASH`
      recomputed, `benchmark-config.test.ts` version updated, `dogfood.test.ts`
      re-measured + updated if its record shifts (it fights `grappler`),
      `docs/spec.md` regenerated.
- [ ] `npm run fight` byte-identical (no rules/engine change).

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code
without a failing test. Read `.claude/CLAUDE.md` + the testing rules first.

### Slice 1: `grappler` fights close with knee + elbow + okizeme finish, all 6 stay in band

**Value**: The gauntlet instrument covers the final two moves (9→11/11) through the
bot whose close range they belong to — and, per the approved direction, exercises
them for real — completing coverage and unblocking the S4 calibration lock.
**Path**: `bots/grappler.json` (redesign) → `loadBotDoc` gate → `runTick` decision
contract (unit) → the real `benchmark()` round-robin (characterization) →
`BENCHMARK_VERSION`/`INPUT_HASH` re-pin → `docs/spec.md` regen. Intentionally
skipped: touching the other five bots (redistribute via `grappler` only; a cross-bot
edit is the S4 escalation).
**Required implementation skills**: Before code changes, load `tdd`, `testing`,
`mutation-testing`, and `refactoring`.
**Acceptance criteria** (present + confirm before code):

1. New `src/cli/grappler.test.ts` (mirroring `zoner.test.ts`): loads the real
   `bots/grappler.json`, drives `runTick(grappler, state, {}, CANONICAL_RULES)`
   through a full-`State` factory. **RED vs v13** (verified by stashing the bot to
   HEAD — the strike/finisher cases fail, the fences pass):
   - **`empi`:** `d` 90000 → `{ type: "attack", move: "empi", band: "mid" }`. Old
     grappler throws (d ≤ 120000).
   - **`hiza-geri`:** `d` 100000 → `{ type: "attack", move: "hiza-geri", band:
"mid" }`. Old grappler throws.
   - **okizeme finisher:** `self.finishWindow` 1 (d 150000, out of throw range) →
     `{ type: "attack", move: "gyaku-zuki", band: "mid" }`. Old grappler ignores
     `finishWindow` → advances.
   - **Boundary fences (kill off-by-one on the sub-bands):** 95000 → `empi mid`
     (≤95k inclusive); 95001 → `hiza-geri mid`; 110000 → `hiza-geri mid` (≤110k
     inclusive); 110001 → `throw`; 120000 → `throw` (throw still fires the top
     sliver); 120001 → `move dir 1`.
   - **Defensive core preserved / ordering:** `opponent.throwing` 1 at d 90000 →
     `{ type: "throw-break" }` (throw-break sits ABOVE the strike layers — a read
     break still beats the elbow); `finishWindow` 0 assumed in the strike cases so
     the finisher does not mask them.
2. `grappler` references `empi` + `hiza-geri` (coverage 9→11/11).
3. Re-measured v14 round-robin: all 6 ∈ `[25, 75]` (real integration held) **or**
   the fallback applied with the v13 board preserved.

**RED**: `src/cli/grappler.test.ts` — the `empi`/`hiza-geri`/finisher cases fail on
v13 (old grappler has no strike rules and ignores `finishWindow` → throw or advance).
Mutator fences in the same file: the `move`/`band` literals, the sub-band boundaries
(95k / 110k / 120k), and rule **ordering** (finisher top; throw-break above the
strikes; throw below).
**GREEN**: Rewrite `bots/grappler.json` per the recommended design (finisher + empi +
hiza-geri layered above the preserved throw + throw-break). Everything the old bot
did is preserved where a strike rule does not supersede it.
**MUTATE**: Bots are DATA (Stryker skips JSON) — effectiveness is structural (RED
distinguishes new-vs-old grappler, pins the exact moves/bands/boundaries/ordering).
The only mutated _production_ file is `src/engine/benchmark-config.ts` (the `v14` +
`INPUT_HASH` constants); run `mutation:diff` there, confirm the guard tests keep 100%
(S1/S-jabber/S2 precedent: 10/10). Re-pin `INPUT_HASH` from the guard-test drift.
**KILL MUTANTS**: Address survivors on `benchmark-config.ts`.
**Empirical loop (inside GREEN — data tuning, not more prod code):** run the 6×
round-robin (throwaway `_roundrobin.ts`, `FOCUS=grappler` for the per-opponent
breakdown; delete before commit). Expected: coverage 11/11; check all 6 in band.

- **If** `grappler` overshoots > 75% (okizeme too strong) → narrow the knee band /
  drop the finisher to a bare knockdown / raise the throw floor (redistribute, don't
  cram).
- **If** `grappler` drops < 25% (lost too many throws) or another member is knocked
  out → widen the throw's share / trim the strike sub-bands.
- **If** no grappler-only tuning holds all 6 in band → apply the **reachable-but-rare
  fallback** (gate empi/hiza on rare non-fight states; board reverts to byte-identical
  v13). Surface as the S3 finding; do **not** nerf another bot (that is S4). Present
  the measured options + recommendation via an approval question before finalizing.
  **REFACTOR**: Assess only — a JSON redesign + two constants; likely nothing.
  **Done when**: all Slice-1 acceptance criteria met; v14 round-robin table recorded
  (or the byte-identical fallback noted); `dogfood.test.ts`,
  `benchmark-config.{ts,test.ts}`, `docs/spec.md` re-pinned to `v14`; typecheck + lint +
  full suite green; `npm run fight` byte-identical; mutation report reviewed; human
  approves commit.

### Slice 2: Close out S3

**Value**: The design trail is current; the parent split reflects 11/11 coverage so
the S4 calibration lock can start from an accurate, complete-coverage ledger.
**Path**: docs only — archive this plan, update the parent split + STATUS + archive
README. Separate PR (S1/S-jabber/S2 precedent).
**Required implementation skills**: none (docs); no production code ⇒ no TDD cycle.
**Acceptance criteria**:

- `plans/grappler-close-range.md` → `docs/archive/gauntlet-s3-grappler.md` (git mv),
  Status Done, with the final v14 round-robin table + the real-vs-fallback finding.
- `docs/archive/README.md`: add the S3 entry under "Gauntlet modernization".
- `plans/gauntlet-modernization-stories.md`: progress-log entry for S3 (v14 table +
  coverage 11/11) + remaining sequence updated (only S4 left).
- `docs/STATUS.md`: build-log entry + "Next in pipeline" refreshed (coverage complete;
  S4 lock is the last slice).
- Working tree clean; `format:check` passes (LF-normalize the moved file).
  **Done when**: close-out PR merged; `plans/` holds only the live parent split.

## Pre-PR Quality Gate

Before the Slice-1 PR:

1. Mutation — `mutation:diff` on `src/engine/benchmark-config.ts`; guard tests pin
   `v14` + `INPUT_HASH` (target 100%).
2. Refactoring assessment (expected: nothing).
3. `npm run typecheck` + `npm run lint` + full `npm test` green.
4. `npm run fight` byte-identical (no engine/rules change).
5. Coverage bookkeeping: `empi` + `hiza-geri` covered ⇒ **11/11** — full arsenal
   coverage; S4 (calibration lock) is the final slice.

Note: `.stryker-tmp/` is gitignored but `rm -rf` it before a full-suite run.

---

_Relocate this file to `docs/archive/` per the archive-plans-not-delete convention
when the plan is complete (S1/S-jabber/S2 precedent: `git mv`)._
