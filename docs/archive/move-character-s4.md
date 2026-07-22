# Plan: S4 — a back kick reads as a straight thrust pitched forward (ushiro-geri)

**Branch**: feat/move-character-s4-ushiro
**Status**: ✅ Shipped — PR #392 (`main`@`3253127`, 2026-07-22). Closeout pending (archive this file).

Slice S4 of the **per-move character differentiation** arc (`plans/move-character-stories.md`,
`plans/move-character-decisions.md`). S1 (front-hand chambers) shipped #386/#387; S2 (the per-move `lean`
lever, on `yoko-geri`) shipped #388/#389; S3 (the per-move `arc` lever, on `mawashi-geri`) shipped #390/#391.
This is the **first group-completion slice** — it introduces **no new mechanism**: it authors S2's existing
`lean` field (pitched **forward** this time) on `ushiro-geri`, finishing the **rear-foot pair** so the back
kick reads apart from the roundhouse by posture as well as path.

## Goal

`ushiro-geri`'s torso **pitches forward** into its back-thrust at contact — a committed linear drive, the
opposite of `yoko-geri`'s bladed lean-back and a posture the roundhouse (`mawashi-geri`, upright + arcing
foot) never strikes — via S2's existing optional `lean` descriptor, while its straight foot path (no arc)
and its solved contact point stay byte-identical to today.

## Why this is the whole slice (no new mechanism)

The story frames S4 as _"`ushiro-geri` = torso pitched **forward** (opposite sign to `yoko`'s back-lean,
reusing S2's lean lever) + a straight thrust path (no arc)."_ Both halves are already reachable:

- **The forward lean** is one authored value. S2 built the lever end-to-end: `scene.ts` computes
  `authoredLean = driven === null || winding ? 0 : (leanFor(move) ?? 0)` (L497–498) and adds it to `head.x`
  **and** `shoulder.x` at the **active** phase (L553–560), for **any** driven limb — it is gated on
  `winding`, not on `isKick`, so a `footL` kick opts in exactly as `yoko-geri`'s `footR` kick did. The
  derived reach-lean is hand-only and zeroes for kicks (`isKick ? 0`, L483–486 — M9), so for `ushiro-geri`
  the authored lean is the **only** torso shift. Sign convention (descriptor doc + M2, L247): local **`+x`
  = forward into the target**, `−x` = back. So `ushiro-geri` authors a **positive** `lean`; `yoko-geri`
  authors `-8`. Opposite signs, one field.
- **The straight thrust (no arc)** is already true: `ushiro-geri` authors no `arc`, so its wind-up is the
  straight `stance → chamber` ease. S3 pinned this — the `ushiro-geri` **collinear** test
  (`scene.test.tsx` L4355–4361, `|bowOf| < 200`) is the standing proof that the foot travels straight, and
  it stays green because a head/shoulder lean never touches the foot path.

So the entire slice is: **author one `lean` value on `ushiro-geri`** (eye-tuned in `/dojo`), optionally
eye-tune its chamber for more back-thrust load (a value tweak, no test). **No `scene.ts` change.** This
mirrors S1 (descriptor-only, existing field) — and is even lighter, because there is **no fixture debt**
(S1's `kizami-zuki` rework) and **no M9 amendment** (S2 already amended it).

## Context — the seam (already built, verified in S2)

- `web/src/pages/replay/scene.ts` `authoredLean` (L497–498) → added to `head.x`/`shoulder.x` (L553–560),
  the **full** amount (it has no girdle half — a torso pitch is not an arm rotation, so the girdle stays
  square), gated to the **active** phase (M9: a fighter leans as the technique extends, not while winding
  up or recovering). Untouched by this slice.
- `web/src/pages/replay/move-descriptors.ts`: `MoveDescriptor.lean?: number` + the total `leanFor` lookup
  already exist (S2). `ushiro-geri` today: `{ limb: "footL", chamber: { x: -4, y: -24 } }` — this slice
  adds `lean: <positive>`.
- The sibling controls, all rear/front-leg kicks that read this pose path:
  - `yoko-geri` `{ …, lean: -8 }` — the **opposite-sign** control (leans **back**).
  - `mae-geri` `{ limb: "footR", chamber: { x: 4, y: -22 } }` — the **upright** reference (authors no lean;
    M9's default), the fixed midpoint the two leans sit either side of.
  - `mawashi-geri` `{ limb: "footL", chamber: { x: -8, y: -30 }, arc: { x: -26, y: -16 } }` — the **other
    rear-leg kick**: authors no lean (stays **upright**) and arcs its foot. After S4 the rear-foot pair
    differs on **two** axes — foot path (S3: mawashi arcs, ushiro straight) **and** posture (S4: ushiro
    pitches forward, mawashi upright).
- Phase lengths (`web/src/pages/dojo/reach-presets.ts`): `ushiro-geri` startup 13 / **active 13–15** /
  recovery 22 (reach 330k, the arsenal apex); `mawashi-geri` 11 / active 11–13 / 18; `yoko-geri` 12 /
  active 12–14 / 20. Not touched (it is the engine-mirror table).

## Design (the authoring)

- **Author** `ushiro-geri`'s `lean` as a **positive** (forward) value, eye-tuned in `/dojo`. Start near
  the magnitude of `yoko-geri`'s `-8` (i.e. `+8`-ish) and tune by eye; the test pins the **sign + a
  threshold**, never the pixel (decision 9).
- **Reach-bound constraint (from S2 · Slice 3):** an authored lean shifts head + shoulder while the hands
  hold stance, so the span from the shifted shoulder to the trailing hand grows; it must stay within the
  arm's reach (~31.3 local px = 2 × `ARM_BONE`) or `deriveBend` straightens that arm into a stretched
  line. `yoko-geri`'s `-8` gave ~27.6px span (safe); a comparable `+8` forward is expected safe but is
  **verified by eye** in `/dojo` (no stretched arm), not assumed.
- **Optional chamber eye-tune** (D8 — "rear knee lifted and cocked back before the heel drives through"):
  fold any `chamber` re-tune into this PR's `/dojo` sign-off as a value tweak (no new test — the existing
  ushiro chamber-relation test at L4670–4687 pins _lifted + forward-of-contact_, not the literal). Only if
  the back-thrust load needs it; otherwise leave the chamber as-is.
- **No `scene.ts` / no new field / no `src/`.** `BENCHMARK_VERSION` `v19` / TCB / `INPUT_HASH` untouched;
  additive (every move that authors no lean is byte-identical — already true and unchanged by this slice).

### The one eye-judgment risk (state it, prove it by eye)

`scene.ts` L469–472 records **why kicks default upright**: a derived forward lean "over a rising leg makes
the figure look like it is FALLING INTO the kick. A real front kick counterbalances." D8 nonetheless
chooses a **forward** pitch for `ushiro-geri` on purpose — a back-thrust _commits forward_ through a
linear drive, where a snapping front kick recovers. **`/dojo` is the arbiter:** if a forward pitch reads
as "falling in" rather than "thrusting through," reduce the magnitude first; if it still fails by eye, the
parking-lot fallbacks are chamber-only character (drop the lean) or — the escalation, not pulled in
silently — facing/turn (D6). Do not widen scope without saying so. This is the slice's single real risk;
everything else is mechanical.

### Deferred / notes for the PR

- **`/sheet`:** unlike a pure execution twin, the lean shifts the **contact silhouette**, so — as with
  `yoko-geri` in S2 — `ushiro-geri`'s `/sheet` cell now differs from `mawashi-geri`'s (a bonus, D7). Say
  so; the parked motion-trail (D5) remains the eventual answer for path-only twins.
- **No M9 re-amendment:** S2 already amended M9 to "a kick is upright **by default**; an authored lean is
  the exception." `ushiro-geri` is simply the **second** instance of that exception — the `mae-geri` /
  `mawashi-geri` upright tests keep their asserts (both author no lean) with **no rewording needed**.
- **Recovery-leg arc / facing:** out of scope (facing = D6, excluded from v1). S5 (`uraken`/`shuto` arcs)
  is the remaining slice after this.

## Acceptance Criteria

- [ ] Given `ushiro-geri` committed, at its **active (contact) tick** its `head.x` **and** `shoulder.x`
      sit **forward** of (greater than) the upright reference (`mae-geri`, which authors no lean) — a
      **positive** lean, and the pitch is **horizontal** (head/shoulder `y` unchanged).
- [ ] Given the three kicks at contact, `yoko-geri` (back), `mae-geri` (upright), and `ushiro-geri`
      (forward) lean **opposite ways about the upright midpoint**:
      `yoko.head.x < mae.head.x < ushiro.head.x` — the "opposite sign to `yoko`" contrast (kills a
      wrong-sign / no-lean mutant).
- [ ] Given `mawashi-geri` (the other rear-leg kick, authors no lean) at contact, its `head`/`shoulder`
      stay **upright** (equal to `mae-geri`'s) — so the rear-foot pair differs on posture too
      (`ushiro-geri` forward, `mawashi-geri` upright), and every unauthored move is byte-identical.
- [ ] The lean is **contained to the upper body**: `ushiro-geri`'s girdle stays **square**
      (`|leftGap − rightGap| ≤ 1`), and its **foot path stays a straight thrust** — S3's `ushiro-geri`
      collinear test and the existing ushiro foot/hip contact tests stay green (byte-identical foot,
      hip-step, support leg; `src/` / TCB / `INPUT_HASH` / `v19` untouched).
- [ ] `/dojo` visual sign-off: `ushiro-geri` reads as a committed straight back-thrust pitched forward,
      distinct from `yoko-geri`'s lean-back and `mawashi-geri`'s upright arc; **no stretched arm** through
      the lean (forward shift stays within the ~31.3px arm reach).

## Slices

One PR — the forward-lean character rides in on one real, demoable move (`ushiro-geri`), never a
standalone "author a value" ticket. Web is outside Stryker ⇒ mutation testing is **N/A**; substitute the
scripted **manual mutator scan** over the diff + exact-assertion tests asserting the **relation, not the
literal** (decision 9) + a `/dojo` sign-off.

### Slice 1: `ushiro-geri` pitches its torso forward into a straight back-thrust (author S2's `lean`, positive)

**Value**: The developer browsing `/dojo` (actor) sees `ushiro-geri` (trigger: it renders at contact)
commit forward on a linear thrust (observable outcome), reading apart from `yoko-geri`'s bladed lean-back
and `mawashi-geri`'s upright arc — completing the rear-foot pair's differentiation.
**Path**: `move-descriptors.ts` (`ushiro-geri` gains `lean: <positive>`) → `scene.ts` `authoredLean`
(existing, S2) → `poseFor` head/shoulder → `scene()` skeleton → `/dojo` + `/watch` playback + `/sheet`
contact cell. No `scene.ts` diff.
**Class**: Behavior change (web-only; authors an existing optional field on one move).
**Required implementation skills**: `tdd`, `testing`; `mutation-testing` **N/A** (web ∉ Stryker → manual
mutator scan); `refactoring` assess-only (expected `N/A` — no code, one data value).
**Reduction program**: N/A.
**Transition/terminal evidence**: N/A.
**Acceptance criteria**: the five boxes above. **Present and get confirmation before writing any code.**
**RED**: A new `describe` block — _"a back kick pitches forward into a straight thrust (per-move character
S4)"_ — reusing S2's single-tick `kickPose(move, attackPhase)` helper (L1729–1748: `scene([tickOf(…​,
{attacking, attackBand: 2, attackReach, attackMove, attackPhase, x, facing: 1}, {x: opponent})], 0,
VIEWPORT).a.pose`), so `easeDriven` returns the phase's keyframe discretely and the active-phase pose
carries the full `authoredLean`.

- **Test A (pitches forward).** `ushiro = kickPose("ushiro-geri")`, `mae = kickPose("mae-geri")`. Assert
  `ushiro.head.x > mae.head.x` **and** `ushiro.shoulder.x > mae.shoulder.x` (forward = local `+x`), with
  `ushiro.head.y === mae.head.y` and `ushiro.shoulder.y === mae.shoulder.y` (a lean, not a drop). Today
  `ushiro-geri` authors no lean ⇒ `authoredLean = 0` ⇒ its head/shoulder equal `mae`'s (both upright) ⇒
  the `>` fails ⇒ **RED for the right reason**. Use a threshold (`> mae.head.x + 2`) so rounding noise
  never passes while the eye-tuned `~+8` sits well above it.
- **Test B (opposite sign to `yoko`).** `yoko = kickPose("yoko-geri")`. Assert the three-way relation
  `yoko.head.x < mae.head.x < ushiro.head.x` — `yoko` back, `mae` upright, `ushiro` forward. Pins **both**
  signs about the upright midpoint; a mutant that authored `ushiro`'s lean **negative** (leaning back like
  `yoko`) fails here. `yoko`'s half is green from S2; `ushiro`'s half is the new RED.
- **Test C (`mawashi` stays upright — lean is opt-in, the posture half of ushiro ≠ mawashi).**
  `mawashi = kickPose("mawashi-geri")`. Assert `mawashi.head.x === mae.head.x` and `mawashi.shoulder.x ===
mae.shoulder.x` (mawashi authors no lean ⇒ upright, byte-identical) while `ushiro.head.x >
mawashi.head.x`. Green before and after — pins that the lean is opt-in and that the rear-foot pair now
  differs on posture, not only foot path.
- **Test D (containment — square girdle, horizontal, foot untouched).** Mirror S2's containment test
  (L1767–1784): for `ushiro`, the girdle stays **square** (`|(head.x − shoulderL.x) − (shoulderR.x −
head.x)| ≤ 1`), and — the "straight thrust unmoved" guard — its `footL` at contact equals the same
  solved extension the existing ushiro contact test pins (L4649–4651), unchanged by the lean. (S3's
  `ushiro-geri` collinear wind-up test + the L4644–4687 foot/hip tests are the standing byte-identical
  regression evidence; this test adds the active-phase foot check alongside the new torso asserts.)

No `arcFor`/`leanFor` totality test is needed — `leanFor`'s totality is already pinned (S2); this slice
adds a value, not a lookup.

**GREEN**: Add `lean: <positive, eye-tuned ~+8>` to `ushiro-geri` in `move-descriptors.ts`, with a
comment (mirroring `yoko-geri`'s) noting the forward pitch, the D8 rationale, the M9 "second instance of
the exception" note, and "relation pinned, not the pixel." Nothing else. Minimum to pass A/B/C/D.
**MUTATE or alternate evidence**: `N/A` (mutation — web ∉ Stryker). Manual mutator scan over the
one-line `move-descriptors.ts` diff:

- **sign-flip** `ushiro`'s lean (`+N → −N`, leaning back) → Test A (`> mae`) and Test B (three-way order)
  fail;
- **drop** the field (`lean` removed) → Test A fails (back to upright, `head.x === mae.head.x`);
- **zero it** (`lean: 0`) → Test A fails (same as drop).

The `scene.ts` lean **wiring** mutants (phase-gate drop, shoulder-lean drop, girdle-leak, half-vs-full)
were scanned and killed in **S2**; this slice does not touch `scene.ts`, so they are regression-covered by
the S2 suite, not re-scanned. Record the intentional survivor: the exact `lean` px (eye-tuned, decision 9)
— A/B/C pin the sign, the ordering, and a threshold, not the literal.
**KILL MUTANTS**: The signed `>`/three-way-order asserts are the deliberate killers; strengthen only if a
scanned mutant survives.
**REFACTOR**: Assess only — expected `N/A` (one data value, no structure to improve). Fold the `/dojo`
eye-tune of `ushiro-geri`'s lean magnitude (and optionally its chamber) into this PR's sign-off.
**Done when**: all five acceptance criteria met; manual scan clean; typecheck + lint + `prettier --check`
on the touched file pass; `/dojo` capture confirms the forward back-thrust reads next to `yoko`'s lean-back
and `mawashi`'s upright arc, with no stretched arm (Playwright screenshot driver — `agent-browser` hangs on
Pixi). PR notes that `ushiro`'s `/sheet` cell now differs from `mawashi`'s (the lean shifts the silhouette),
that the foot path stays a straight thrust (byte-identical), and that no M9 re-amendment was needed. Human
approves the commit.

## Pre-PR Quality Gate

1. Mutation — `N/A` (web ∉ Stryker); manual mutator scan reviewed (above).
2. Refactoring — assess; expected `N/A` (a single descriptor value).
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass (format only the file this PR
   touches — no repo-wide `prettier --write`, there is pre-existing drift); `web` vitest (node + browser
   projects) green.
4. DDD glossary — N/A (no domain-term change).
5. Confirm **no `src/` diff** (engine/TCB/`INPUT_HASH`/`v19` untouched), no `scene.ts` diff, and the field
   stays optional (every unauthored move byte-identical).

---

_Archive under `docs/archive/` when the slice closes — do not delete (`archive-plans-not-delete`)._
