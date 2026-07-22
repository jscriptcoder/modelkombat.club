# Plan: S1 — the front-hand trio winds up from its own chamber

**Branch**: `feat/move-character-s1-hand-chambers`
**Status**: Active
**Story**: S1 in `plans/move-character-stories.md`; design in `plans/move-character-decisions.md`
(D1–D8). Recommended first slice.

## Goal

`uraken`, `kizami-zuki`, and `shuto` each wind up from its own authored chamber, so the front-hand trio
plays as three distinct motions in `/dojo` — while each still lands `handR` on the same solved target at
contact (M3 unchanged).

## Why this is one slice (not split)

Authoring `kizami-zuki` cannot be separated from reworking the ~15 test sites that use it as the "real
move with no descriptor" fixture — the moment it gains a descriptor those break, so the rework is coupled
to the change and ships in the same PR. `uraken` and `shuto` carry no such coupling but belong in the
same group and the same tiny data edit, so all three author together. The whole slice is describable in
one sentence and reviewable as one coherent unit: _the hand trio winds up from three distinct chambers._

## Design detail (from decisions D3, D8)

- **Lever: the existing `chamber` field only.** No new mechanism. Each move gains
  `{ limb: "handR", chamber: {x, y} }` in `web/src/pages/replay/move-descriptors.ts`. `handR` is already
  what the generic fallback drives, so **contact is byte-unchanged**; the only new behavior is the
  wind-up (and recovery) driving `handR` to the authored chamber instead of the stance point.
- **Intended chamber character** (eye-tuned in `/dojo`; starting values, each within ~2×`ARM_BONE` ≈ 31
  local px of the front shoulder at (7, −64) so the arm never renders as a stretched line):
  - `kizami-zuki` (jab) — fast, minimal: lead fist up near guard, e.g. `{ x: 12, y: -50 }`.
  - `uraken` (backfist) — fist cocked **across** the body, high: e.g. `{ x: -8, y: -56 }`.
  - `shuto` (knife-hand) — chambered **high by the ear**: e.g. `{ x: -2, y: -62 }`.
  The three are mutually distinct in position (forward-low vs across-back vs high), so the wind-ups read
  apart. Arc paths for `uraken`/`shuto` are **deferred to S5**; here they differ by chamber only.
- **No `offHand`, no `tuck`, no `targetY`, no arc.** Only `limb` + `chamber`. Keeps the diff minimal and
  leaves the `handL` (rear hand) at stance, matching the existing gyaku-zuki off-hand test's premise.

## Acceptance Criteria

- [ ] Given each of `uraken` / `kizami-zuki` / `shuto` committed and rendered at its **chamber (startup)
      phase**, its driven `handR` sits at that move's **own** authored point — the three are mutually
      distinct, and each differs from the stance hand (assert the *relation*: pairwise `≠`, not literals).
- [ ] Given each of the three at its **contact (active) phase**, its `handR` is **identical** to what an
      undescribed (unknown-id) move renders at the same frame params — i.e. authoring changed the wind-up
      only, never the contact landing (M3 / backward-compat).
- [ ] Given an **unknown / absent / "" move id**, the generic front-hand fallback with **no chamber**
      still draws (M7 totality) — this invariant is preserved, re-expressed against an unknown id now that
      no *real* move is undescribed.
- [ ] The full suite is green with `kizami-zuki` (and `uraken`/`shuto`) no longer standing in for
      "a real move with no descriptor."
- [ ] `BENCHMARK_VERSION` is still `v19` and **no `src/` file is touched**; `web/` only.

## Slices

One slice. **Class: behavior change** (a new wind-up shape for three moves; the fixture rework is keeping
the suite green under that legitimate change, not separate behavior).

### Slice 1: The front-hand trio winds up from three distinct chambers

**Value**: A developer browsing `/dojo` sees `uraken`, `kizami-zuki`, and `shuto` wind up as three
different motions instead of one identical generic hand — the first proof that execution-only
differentiation reads as distinct.
**Path**: `move-descriptors.ts` (`DESCRIPTORS` gains three rows) → `chamberFor`/`limbFor` →
`scene()` `easeDriven` wind-up → `/dojo` `DojoStage` / `/watch`.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `refactoring`. `mutation-testing` = **N/A** (web is
outside Stryker) — substitute a scripted **manual mutator scan** over the diff, recorded in the PR body.
**Reduction program**: N/A.
**Acceptance criteria**: as above. **Present to the human and get confirmation before writing code.**

**RED**: In `scene.test.tsx`, a new describe block "the front-hand trio winds up from its own chamber":
- pose each of the three at the **chamber phase** (single-tick tape ⇒ `easeDriven` returns the chamber
  discretely) and assert the three `handR` points are pairwise distinct and each ≠ the stance hand;
- pose each at the **contact phase** and assert its `handR` equals an unknown-id move's `handR` at the
  same params (contact unchanged). These fail today because all three currently fall back to the stance
  hand at the chamber phase (no chamber), so the three are equal, not distinct.

**GREEN**: Add the three `{ limb: "handR", chamber }` rows to `DESCRIPTORS`. Then re-point the fixture
sites the change legitimately invalidates (see **Fixture rework** below) — preserving each invariant that
is still true (M7/no-chamber) by switching its stand-in to the unknown id `"no-such-move"`, and updating
the now-stale "undescribed" comments. The `mutation-testing` note: web is outside Stryker.

**MUTATE**: **N/A** — manual scan. Mutants that matter and how the tests kill them:
- a chamber row deleted / limb flipped to a foot ⇒ the chamber-distinctness assertion fails (the move
  reverts to stance or drives a foot);
- two chambers made equal (copy-paste) ⇒ the pairwise-distinct assertion fails;
- a chamber that changed the **contact** point ⇒ the contact-unchanged assertion fails.
Exact chamber pixels are left loose by design (decision 9 — eye-tuned; the relation, not the literal).
Record the scan in the PR body as the mutation `N/A` alternate evidence.

**REFACTOR**: Assess whether the three near-identical fixture re-points want a shared `UNDESCRIBED_ID`
constant in the test file. Only if it adds clarity.

**Done when**: ACs met, suite green, typecheck + lint clean, manual scan recorded, `/dojo` visual
sign-off (Playwright driver — see gate) shows the three hand wind-ups reading apart, human approves.

## Fixture rework (the coupled cost)

`kizami-zuki` is the suite's canonical "real move with no descriptor." Once all three hand moves are
authored, **no real arsenal move is undescribed**, so sites that need that scenario re-point to the
unknown id `"no-such-move"` (identical behavior: generic `handR`, no chamber — the tests already pass an
explicit `attackReach`, so nothing else changes). The categorization drives which sites move and which
merely need a comment fix:

- **BREAKS-CHAMBER / BREAKS-GENERIC** (assert winds-through-stance / undescribed premise) → re-point the
  move id to `"no-such-move"`; update the comment from "a real move with no descriptor" to "an unknown
  move id." The invariant (an undescribed id winds through stance / draws the generic hand) is preserved,
  just re-homed off a now-authored real move.
- **SAFE-CONTACT** (assert only contact `handR`-to-target) → keep `kizami-zuki`; it still drives `handR`
  at contact. Fix any stale "undescribed" wording in the comment.
- **`contact-sheet.test.tsx` (uraken/shuto) — value-safe but premise-stale, and NOT re-pointable.** Both
  cells are posed at the **active** phase, where authoring a `chamber` changes nothing, so both
  assertions (`uraken.handR.x > mae-geri.handR.x`; `shuto.handR.x > uraken.handR.x`) stay green. But
  their comments claim these moves are *undescribed* / "both fall back to the generic front hand," which
  goes false. The sheet renders **arsenal moves only** (`cellFor("no-such-move")` throws and the key-set
  test forbids extras), and after S1 no arsenal hand move is undescribed — so there is **no re-point
  target**. Action: keep both assertions, rewrite the two comments to frame them as reach isolation over
  two *now-described* front-hand moves (contact is reach-only; the chamber moves the wind-up, not this
  frame). They stay valid reach guards.

### Per-site categorization (`scene.test.tsx` — `kizami-zuki`)

Only the **2 BREAKS-CHAMBER** sites actually turn RED when the descriptors land (their startup/chamber
asserts now ease to a non-stance chamber); the rest stay green — the work there is premise/comment
hygiene, not a failing test. Re-pointing to `"no-such-move"` (reach still passed explicitly) is
intent-preserving for **every** scene site.

| line(s) | it (abbrev) | class | action |
| --- | --- | --- | --- |
| 1643 | falls back to generic hand for a move with no descriptor (M7) | BREAKS-GENERIC | array already lists `no-such-move`; drop the `kizami-zuki` entry (identical) |
| 1781 | winds a move with NO authored chamber up through its stance (M7) | **BREAKS-CHAMBER** | re-point id → `no-such-move`; CHAMBER/RECOVER `== stance` then hold |
| 2119 | still drives the FRONT hand for a punch with no descriptor | BREAKS-GENERIC | re-point → `no-such-move`; restores the "no descriptor" premise |
| 2275 | leaves the other hand at stance for a move with no off hand (M7) | BREAKS-GENERIC | re-point → `no-such-move` (no offHand); `handL` stays stance |
| 2381 | does not lean when the arm can already reach | SAFE-CONTACT | keep `kizami`; comment says "jab" — nothing stale |
| 2484 | leaves the resting hand at stance — the ride is retired | SAFE-CONTACT | keep `kizami` |
| 2505/2508 | keeps the resting arm's bones at stance length | SAFE-CONTACT | keep `kizami` |
| 2534 | leaves a raised guard where the guard layer put it | SAFE-CONTACT | keep `kizami` |
| 2634 | a reverse punch and a jab draw different arm lines | SAFE-CONTACT | keep `kizami` |
| 2652 | separates the two punches by a VISIBLE amount | SAFE-CONTACT | keep `kizami` |
| 2805/2813 | leans a reverse more than a jab at mid range | SAFE-CONTACT | keep `kizami` |
| 2872 | retires the hand-ride — a jab's rear hand stays at stance | SAFE-CONTACT | keep `kizami` |
| 3908 | holds an UNDESCRIBED move at full extension across the active window (S8) | **BREAKS-CHAMBER** | re-point → `no-such-move`; startup `== stance` then holds |
| 2032 | describe-header comment (prose, no assertion) | OTHER | update the stale "identical picture" wording |

**Counts:** BREAKS-CHAMBER **2** (1781, 3908 — the only reds) · BREAKS-GENERIC **3** (1643, 2119, 2275 —
green, premise dies) · SAFE-CONTACT **8** (green, front-hand jab, unchanged) · OTHER **1** (comment).

### Per-site categorization (`contact-sheet.test.tsx` — `uraken` / `shuto`)

| line(s) | it (abbrev) | class | action |
| --- | --- | --- | --- |
| 59/62 | renders an UNDESCRIBED move with the generic strike (`uraken` vs `mae-geri`) | BREAKS-GENERIC (value-safe) | keep assertion; rewrite comment — `uraken` now described, still drives `handR` forward past the kick |
| 87/90 | poses each move at ITS OWN reach (`shuto` vs `uraken`) | BREAKS-GENERIC (value-safe) | keep assertion; rewrite comment — two now-described hand moves, reach-only at the active frame |

**Counts:** BREAKS-GENERIC **2** — both **value-safe** (active-phase reach is unchanged), comment-stale,
and **not re-pointable** (arsenal-only sheet, key-set test forbids `no-such-move`).

## Pre-PR Quality Gate

1. Manual mutator scan over the diff (mutation `N/A` rationale + the three mutant classes above recorded
   in the PR body).
2. Refactoring assessment (the shared-constant question above).
3. `npm run typecheck` + `npm run lint` + `npm test` green.
4. `/dojo` visual sign-off via the **Playwright screenshot driver** (not `agent-browser` — it hangs on
   the Pixi canvas): dev server `npm run dev:web -- --port N` (read the port Vite prints); select each
   hand move on a figure, scrub to a mid-**startup** tick, and confirm the three wind-ups read apart
   (controls are `aria-labelledby` — `select[aria-labelledby="challenger-move"]`; seek via the
   `"Scrub to tick"` range input). Capture is the harder (transport-driven) case, not the static `/sheet`
   one — see the move-showcase capture recipe in memory.
5. Confirm `BENCHMARK_VERSION` is still `v19` and no `src/` file is touched.

## Warnings

- **Contact is unchanged, so `/sheet` and `/watch` contact frames look identical to today** — the value
  is only visible in the *wind-up* during playback. Say so in the PR so "the sheet looks the same" is not
  read as failure (the `/sheet` motion-trail is the parked S-follow-up that would surface it statically).
- **Don't add an `offHand`/arc here** — those are S5 (arc) and out of scope; keep the diff to `limb` +
  `chamber`.
- **Re-point, don't delete, the M7/no-chamber tests** — the invariant they guard is still real for
  unknown ids; deleting them would drop coverage. Say which premise moved (real→unknown id) and why.

---
*Delete this file when the plan is complete (archive under `docs/archive/` per `archive-plans-not-delete`).*
