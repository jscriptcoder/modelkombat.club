# Move Roster — design & balance

**Status:** grill-me complete (2026-07-03) — balance law + policies + all 6 Batch-1 frame
blocks resolved. **Build COMPLETE — all 6 grounded moves shipped** (one PR per technique): **`uraken` SHIPPED** (move #1/6 —
wiring PR #117 → benchmark v5, `rule()` readers PR #118 → no bump; archived at
`archive/uraken-backfist.md`); **`shuto` SHIPPED** (move #2/6 — wiring PR #120 → benchmark v6,
`rule()` readers PR #121 → no bump; archived at `archive/shuto-knife-hand.md`); **`yoko-geri`
SHIPPED** (move #3/6 — wiring PR #123 → benchmark v7, `rule()` readers PR #124 → no bump; archived
at `archive/yoko-geri-side-kick.md`); **`ushiro-geri` SHIPPED** (move #4/6 — wiring PR #126 →
benchmark v8, `rule()` readers PR #127 → no bump; archived at `archive/ushiro-geri-back-kick.md`);
**`empi` SHIPPED** (move #5/6 — wiring PR #129 → benchmark v9, `rule()` readers PR #130 → no bump;
archived at `archive/empi-elbow.md`); **`hiza-geri` SHIPPED** (move #6/6 — wiring PR #132 →
benchmark v10, `rule()` readers PR #133 → no bump; archived at `archive/hiza-geri-knee.md`).
**Batch 1 grounded arsenal COMPLETE (6/6)** — next is the roster-wide no-Pareto-dominance property
test + the owed `vulture`/`sweeper` gauntlet rebalance. Living source of truth for the
fighting-move roster and the balance law that governs it. Consolidates the built
**baseline** (authoritative in `src/engine/rules.ts` `CANONICAL_RULES`, proven by
behavioral `runFight` tests in `rules.test.ts`, designed in `DESIGN.md §P7`) and will
host the **expansion** toward the design's ~24-technique arsenal (real-karate hand, leg,
close-range, and air techniques). Feeds `story-splitting` → `planning` → TDD, one PR per
technique batch.

## Baseline roster (built, test-pinned)

Units: reach in sub-units (SCALE = 1000/unit); frames in ticks (60/s). Score in WKF points.

| Technique                    | Kind      | startup | active | recovery | reach   | score                | bands    | stamina | cancelInto                 |
| ---------------------------- | --------- | ------- | ------ | -------- | ------- | -------------------- | -------- | ------- | -------------------------- |
| `throw`                      | grapple   | 7       | 2      | 14       | 120 000 | 3 (ippon)            | any      | 40      | —                          |
| `sweep` (ashi-barai)         | leg / low | 7       | 2      | 13       | 180 000 | 0 → 3 okizeme finish | low      | 40      | `gyaku-zuki`               |
| `kizami-zuki` (jab)          | hand      | 7       | 2      | 13       | 210 000 | 1 (yuko)             | high·mid | 15      | `gyaku-zuki`               |
| `gyaku-zuki` (reverse punch) | hand      | 7       | 3      | 14       | 240 000 | 1 (yuko)             | high·mid | 20      | `mae-geri`, `mawashi-geri` |
| `mae-geri` (front kick)      | leg       | 9       | 3      | 16       | 270 000 | 2 (waza-ari)         | mid      | 35      | `gyaku-zuki`               |
| `mawashi-geri` (roundhouse)  | leg       | 11      | 3      | 18       | 300 000 | 2 / **3 jodan**      | high·mid | 45      | `gyaku-zuki`               |

Cancel web (escalating rekka): jab → reverse → {front | roundhouse}; kick → reverse;
sweep → reverse (okizeme finisher).

## Proven invariants (the read-game + economy floor)

These are LOCKED and enforced by `rules.test.ts`. Any new technique must satisfy them.

- **Reactable:** every committed `startup` ≥ `lAct` (6) + 1 = **7**. (A move faster than
  this is unreactable — breaks the perception read game.)
- **Whiff-punishable:** `recovery` ≥ `lAct` (6) + jab `startup` (7) = **13**. (A whiffed
  commit must be punishable by a reactor.)
- **Reach hierarchy:** throw 120 < sweep 180 < jab 210 < reverse 240 < front 270 <
  roundhouse 300 (thousands of sub-units).
- **Stamina cost hierarchy vs the gas line:** basic (punch 15 / 20) ≤ `gasThreshold`
  (30) < special (kick 35 / 45, throw & sweep 40). A gassed fighter (stamina ≤ 30)
  keeps its punches and loses every kick, throw, and sweep — the emergent special-lockout.
- **No free spam:** `regen` (10) < cheapest cost (jab 15) ⇒ even the cheapest move can't
  be thrown every tick; sustained offense requires pacing.
- **WKF scoring rubric:** punch/`uchi` (hand strike) = 1 _yuko_ at any legal band; body
  (chudan) kick = 2 _waza-ari_; head (jodan) kick = 3 _ippon_; clean throw = 3; sweep
  scores 0 but its okizeme finish pays 3.

## Balance law for new techniques

**Governing principle: a trade-off budget — no free lunch.** (resolved 2026-07-03)

Every new technique earns its strengths by paying with weaknesses, measured against the
built baseline. The dials split into:

- **Strength axes** (what a fighter wants): longer `reach`, higher `score`, faster tempo
  (low `startup` + low `recovery`), cheaper `staminaCost`, more legal `bands`, plus special
  upside (`knockdown`, a `scoreByBand` jodan bonus, rich `cancelInto` routes).
- **Weakness axes** (the price): shorter reach, lower score, slower/telegraphed (high
  startup), more punishable (high recovery), pricier stamina, band restriction.

Every new move must pass all four rules:

1. **Invariant floor.** Satisfies every baseline invariant — `startup` ≥ 7 (reactable),
   `recovery` ≥ 13 (whiff-punishable), `regen` (10) < `staminaCost`, and the WKF score
   class for its category. No exceptions; this is the read-game + economy floor.
2. **No Pareto-dominance (the testable core).** No new move may be equal-or-better than
   an existing move on _every_ axis and strictly better on one. For each strength it pushes
   UP vs its closest baseline analog, it must push ≥1 other axis DOWN. Machine-checkable
   across the whole roster — this is what stops variety collapsing into one best move.
3. **At most a dual specialist.** A move may lead on at most ~two strength axes; leading on
   three-plus is almost certainly dominant — split it or nerf an axis.
4. **Distinct niche (closes S1).** It must differ from every existing move on ≥1 meaningful
   axis — no near-duplicates (the two baseline kicks already brush this limit).

**Verification hook:** once the expansion lands, add a `rules.test.ts` property asserting
no move Pareto-dominates another across the full roster.

**Score class by category** (the WKF rubric rule 1 enforces — resolved 2026-07-03):

| Category                                                                                      | Score                        | WKF term   |
| --------------------------------------------------------------------------------------------- | ---------------------------- | ---------- |
| Hand strike — punch `tsuki` + strike `uchi` (jab, reverse, backfist, knife-hand, hammer-fist) | **1 (capped)**               | _yuko_     |
| Body (chudan) kick                                                                            | 2                            | _waza-ari_ |
| Head (jodan) kick                                                                             | 3                            | _ippon_    |
| Throw                                                                                         | 3                            | _ippon_    |
| Sweep                                                                                         | 0 → 3 on okizeme finish      | —          |
| Close-range strike (elbow `empi` / knee `hiza-geri`)                                          | **2** (deliberate exception) | _waza-ari_ |

New (extended-arm) hand strikes are **score-capped at 1** — their variety must come from
reach, tempo, stamina, and cancel routes, never from points.

**Close-range niche (resolved 2026-07-03).** Elbow/knee are the _point-blank payoff_: the
**shortest reach in the game** (below the throw, ~90–110k), MORE committed (higher recovery)
and moderate-to-high stamina, but they score **2** — kick-tier points earned from the hands
and knees as the reward for braving throw range. The elbow is technically an `uchi`, so its
score 2 is a **deliberate exception** to B2's hand-cap: close-range is treated as its own
category, not an extended-arm strike. This enriches the inside game into a mixup — the throw
beats a guard, a close strike beats a throw-break or a whiffed grab, and guard/throw-break
beat the strike. Passes no-Pareto-dominance: vs `mae-geri` (also score 2) it trades ~160k of
reach down for its point-blank access, so neither dominates.

**Cancel-edge policy (resolved 2026-07-03).** New moves get cancel routes by a **category
rule** extending the existing rekka, not bespoke per-move tuning:

- Hand strike → `gyaku-zuki` (the reverse punch is the escalation hub).
- `gyaku-zuki` → any kick.
- Close strike (elbow/knee) → `gyaku-zuki`. _(The intended elbow → `throw` cancel is **not
  expressible in Batch 1**: `sim.ts` fires a cancel only for an `attack`-type follow-up
  listed in `cancelInto: MoveId[]`, and a `throw` is neither an `attack` action nor a
  `MoveId`. So the elbow/throw mixup lives at the neutral action-choice level, not as a
  cancel; a throw-cancel would need engine work — deferred to a later batch.)_
- Kick → `gyaku-zuki` (the reverse-punch finisher).
- Sweep → `gyaku-zuki` (okizeme finisher, unchanged).

Two guards on every derived edge: (1) **spatial check** — keep the edge only if the
follow-up's `reach` can still connect at the cancel distance (a cancel into a shorter-reach
move whiffs; audit per edge). (2) **loop-safety** — the connect-required rule + stamina
drain + knockdown/yame resets already bound any cycle (e.g. `gyaku-zuki` ↔ kick); a category
edge never adds a free or instant loop, so this property is preserved by construction.

**Out-of-band UX (resolved 2026-07-03).** An `attack` naming an illegal band keeps its
**silent degrade to idle** — no engine or validator change. It is WKF-faithful (an illegal
target simply doesn't score), the existing `FighterFrame.degrade` telemetry already records
it, and most bands are dynamic expressions the validator can't catch statically anyway. The
only obligation on the expansion: each new single-band move must have its band legality
**taught prominently in `spec.md`** so LLM authors don't waste ticks on illegal targets.

**Stamina / gas placement law (resolved 2026-07-03).** **Stamina tier mirrors score tier**
— the baseline's own emergent pattern, now locked:

- **Score-1 (yuko) hand strikes ⇒ basic:** `staminaCost` ≤ `gasThreshold` (30), so they
  survive gassing. (jab 15, reverse 20; new backfist/knife-hand/hammer-fist land here.)
- **Score-2+ moves + knockdown setups ⇒ special:** `staminaCost` > 30, so they lock out
  when gassed. (kicks 35–45, throw 40, sweep 40; new kicks and the score-2 close strikes
  land here.)

This preserves the clean guarantee: **a gassed fighter has only its 1-point hand strikes
left** — every waza-ari / ippon option is priced above the gas line. Combined with
`regen` (10) < cheapest cost, no move is ever both gas-proof AND high-value.

## Expansion roster & sequencing

**Batch 1 — grounded expansion (this arc).** New `MoveSpec`s + cancel edges only; **no new
engine capability** required, so these are small, independently-valuable PRs. Families:
more kicks (leg), more hand strikes, close-range strikes (elbow/knee). Each technique's
frame data is specced via grill-me under the balance law above.

**Batch 2 — air techniques (deferred to its own capability).** Jump kicks (`tobi-geri`)
need airborne-strike resolution. The vertical jump arc is already built; what's missing is
(a) resolving a strike mid-air and (b) horizontal jump displacement (`jump.dir` reserved).
Scoped AFTER batch 1 — the smaller "air-strike reusing the built vertical arc" (no
horizontal displacement) is the likely first air slice.

### Batch 1 candidates — curated ~2 per family (resolved 2026-07-03)

Ship **one technique per PR**; re-run the gauntlet after each family. The law-derived
constraints below are fixed; frame data (exact reach, startup, active, recovery, cost,
bands) is **TBD in grill-me**, which also resolves each move's distinct niche (S1).

| Technique                 | Family     | Score               | Gas class | Reach zone             | Distinctness question for grill-me                                       |
| ------------------------- | ---------- | ------------------- | --------- | ---------------------- | ------------------------------------------------------------------------ |
| `yoko-geri` (side kick)   | kick / leg | 2 chudan (3 jodan?) | special   | long                   | vs `mawashi-geri`: a linear-thrust identity — longer / narrower band?    |
| `ushiro-geri` (back kick) | kick / leg | 2                   | special   | long                   | the highest-commitment kick (turn-away) — most telegraphed + punishable? |
| `uraken` (backfist)       | hand       | 1                   | basic     | short                  | the fastest/cheapest hand check — shortest reach, best cancel-starter?   |
| `shuto` (knife-hand)      | hand       | 1                   | basic     | mid                    | a high-band (`jodan`) hand specialist?                                   |
| `empi` (elbow)            | close      | 2                   | special   | point-blank (~90–110k) | vs knee — the mixup / cancel angle?                                      |
| `hiza-geri` (knee)        | close      | 2                   | special   | point-blank (~90–110k) | vs elbow — longer reach or knockdown potential?                          |

### Batch 1 resolved frame data (grill-me — in progress, 2026-07-03)

Global decision (Q1): new long kicks MAY exceed `startGap` (300k) as beyond-neutral zoning
pokes, paying with the slowest startups, longest recovery, highest cost, and gas-lock.

| Move                         | reach   | startup | active | recovery | score        | bands    | cost | cancelInto   | notes                                                                                                                  |
| ---------------------------- | ------- | ------- | ------ | -------- | ------------ | -------- | ---- | ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `yoko-geri` (side kick) ✅   | 315 000 | 12      | 3      | 20       | 2            | mid      | 48   | `gyaku-zuki` | beyond-neutral chudan spacing thrust; out-reaches even the roundhouse + startGap, gas-locked (Q2) — SHIPPED #123/#124  |
| `ushiro-geri` (back kick) ✅ | 330 000 | 13      | 3      | 22       | 2 (3 jodan)  | high·mid | 52   | `gyaku-zuki` | reach apex, most committed; `scoreByBand {high: 3}` jodan ippon — SHIPPED #126/#127                                    |
| `uraken` (backfist) ✅       | 200 000 | 7       | 2      | 13       | 1            | high     | 12   | `gyaku-zuki` | cheapest & shortest hand; jodan-only snap / cheap gas-proof pressure (Q4) — SHIPPED #117/#118                          |
| `shuto` (knife-hand) ✅      | 260 000 | 8       | 2      | 15       | 1            | high·mid | 22   | `gyaku-zuki` | longest-reach hand; gas-proof 1-pt poke, out-ranges the reverse (Q5) — SHIPPED #120/#121                               |
| `empi` (elbow) ✅            | 95 000  | 8       | 2      | 14       | 2            | high·mid | 38   | `gyaku-zuki` | shortest reach in game; point-blank 2-pt; elbow/throw mixup is a NEUTRAL choice, not a cancel (Q6) — SHIPPED #129/#130 |
| `hiza-geri` (knee) ✅        | 110 000 | 9       | 2      | 16       | 0 → 3 finish | mid      | 40   | `gyaku-zuki` | `knockdown: true`; only MID-band standing knockdown→okizeme; finisher reaches at ~110k (Q6) — SHIPPED #132/#133        |

**All 6 locked (grill-me complete, 2026-07-03).** Flagship fallback if the rebalance
surface proves too large: `yoko-geri`, `uraken`, `empi` + `hiza-geri`.

### Full reach ladder after Batch 1 (roster-wide check)

Monotonic, new moves interleaved (k = ×1000 sub-units):

`empi` 95 < `hiza-geri` 110 < `throw` 120 < `sweep` 180 < **`uraken` 200** < `kizami-zuki`
210 < `gyaku-zuki` 240 < **`shuto` 260** < `mae-geri` 270 < `mawashi-geri` 300 <
**`yoko-geri` 315** < **`ushiro-geri` 330**. The last two exceed `startGap` (300) — the
beyond-neutral zoning pokes (Q1).

**Balance-law verification (all pass):** invariant floor — every startup ∈ [7,13] ≥ 7,
every recovery ∈ [13,22] ≥ 13, every cost > regen 10. Stamina-tier-mirrors-score — score-1
hands (`uraken` 12, `shuto` 22) are basic/gas-proof; every score-2+/knockdown move (38–52)
is special/gas-locked. No-Pareto-dominance — each new move trades ≥1 axis down for any it
pushes up (verified pairwise vs neighbours; a `rules.test.ts` property will assert it
mechanically). Single-band moves needing prominent `spec.md` band teaching (S3): `uraken`
[high], `yoko-geri` [mid], `hiza-geri` [mid].

### Derived cancel graph (category policy, Batch 1)

- `kizami-zuki` → `gyaku-zuki` _(unchanged)_
- **`gyaku-zuki` → [`mae-geri`, `mawashi-geri`, `yoko-geri`, `ushiro-geri`]** — grows to
  include the new kicks ("reverse → any kick"); spatially valid (kicks out-reach the punch).
- `uraken`, `shuto`, `mae-geri`, `mawashi-geri`, `yoko-geri`, `ushiro-geri`, `empi`,
  `hiza-geri`, `sweep` → `gyaku-zuki`. _(Long-kick → `gyaku-zuki` is **situational**: the
  240k finisher only connects when the kick landed within its reach — identical to the
  baseline `mae-geri`/`mawashi-geri` behaviour.)_

### Implementation notes for planning / TDD

- Add the 6 ids to the `MoveId` union (`types.ts`) + optional keys on `Rules.moves`; add the
  6 `MoveSpec`s to `CANONICAL_RULES`; extend `gyaku-zuki.cancelInto` with the two new kicks.
- `hiza-geri` reuses the existing `knockdown` + okizeme `finishWindow` machinery (no new
  capability). `empi`/`hiza-geri` reaches below `throw` (120k) are the new infighting zone.
- Regenerate `spec.md` (teach each move's bands, esp. the single-band ones) and re-run the
  benchmark gauntlet after each family; fold the owed `vulture`/`sweeper` rebalance into
  those re-runs.
- One PR per technique (TDD): a behavioural `runFight` test pins each move's reach/score/
  band/cancel/gas relationships (the pattern in `rules.test.ts`), not the literals alone.

## Open balance context

- The frozen benchmark gauntlet is **not** currently in the target balance band
  (`vulture` ~16 % win, `sweeper` out-of-band high) — a rebalance is already deferred.
  New moves reshuffle this; the expansion must be designed with the rebalance, not against it.
- `DESIGN.md §P7` balance target: **no move > ~35 % usage, no opener > ~60 % win**,
  tuned via bot-vs-bot telemetry (a harness that does not yet exist).

## Gaps closed — find-gaps session, 2026-07-03

Resolved (9):

```
[Blocker → §Balance law]        B1  Governing principle → trade-off budget / no-Pareto-dominance
[Blocker → §Balance law]        B2  Hand strikes capped at 1 yuko
[Blocker → §Score class + niche] B3  Close-range = point-blank score-2 payoff (B2 exception)
[Blocker → §Expansion]          B4  Grounded first; air deferred to Batch 2
[Should  → §Balance law rule 4] S1  Distinct-niche rule (folded into B1)
[Should  → §Cancel-edge policy] S2  Category policy extends the rekka
[Should  → §Out-of-band UX]     S3  Keep silent-degrade; teach bands in spec.md
[Should  → §Stamina/gas law]    S4  Stamina tier mirrors score tier
[Should  → §Batch 1 candidates] S5  Curated ~2 per family (~6 grounded)
```

Parked (3 Nice-to-have):

```
[Nice] N1  Unused `tags` (iFrames / armor / counterHitBonus) — a NEW engine capability,
           out of Batch 1 scope by construction (Batch 1 = MoveSpecs + cancel edges only).
           Revisit alongside/after the air capability if a move wants armor or counter-hit.
[Nice] N2  Naming consistency — new moves follow the existing romaji + English-gloss
           convention (`yoko-geri` (side kick)); no decision needed.
[Nice] N3  Sweep-family low kicks (gedan-barai, kansetsu-geri) — a future low-band family,
           not in the curated Batch 1. Candidate for a later grounded batch.
```

Open dependency (not a gap, a sequencing note): the owed gauntlet rebalance
(`vulture`/`sweeper`) interacts with this expansion — re-run the gauntlet after each family
lands and fold the rebalance into that, rather than as a separate pre-step.
