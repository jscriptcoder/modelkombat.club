# Plan: S2 — a move can LEAN as part of its technique (yoko-geri)

**Branch**: feat/move-character-s2-lean
**Status**: ✅ Shipped — PR #388 (`main`@`3b24d0c`, 2026-07-22). Closeout in flight
(archive → `docs/archive/move-character-s2.md`).

Slice S2 of the **per-move character differentiation** arc (`plans/move-character-stories.md`,
`plans/move-character-decisions.md`). S1 (front-hand chambers) shipped #386 + closed out #387. This is
the first of the two **mechanism-risk skeletons**: it introduces the per-move **lean/posture** lever
end-to-end on one move (`yoko-geri`) and consciously **reopens the M9 upright-kick rule** (D7 · D8 ·
carried-risk 2). The arc via-waypoint lever is a separate skeleton (S3).

## Goal

`yoko-geri` pitches its upper body **back** as the kick extends — a bladed counterbalance that reads
apart from `mae-geri`'s upright front snap in `/dojo` / `/watch` — via a new optional per-move `lean`
descriptor field, while every move that authors no lean renders byte-identically.

## Context — the seam (already mapped)

- `web/src/pages/replay/scene.ts` ~L459: `const lean = driven === null || winding || isKick ||
isMidJoint ? 0 : rootTravel(drivingShoulder, driven, ARM_BONE)`. This is a **derived, hand-only**
  reach-shortfall. The `isKick ? 0` branch **is where M9 is stated** — a kick's reach is answered by the
  hip `step` (L476) instead, and the torso stays upright. The derived `lean` shifts `head`/`shoulder` by
  `lean/2` (L515–516) and rotates the `girdle` (L502–505).
- `web/src/pages/replay/move-descriptors.ts`: `MoveDescriptor` = `{ limb?, chamber?, offHand?, tuck?,
targetY?, grab? }` with a TOTAL `xFor(move)` lookup per field. `yoko-geri` already authors
  `{ limb: "footR", chamber: { x: 8, y: -28 } }` (drives the front foot, higher/across chamber vs
  `mae-geri`'s `{ x: 4, y: -22 }`).
- M9 is pinned by tests in `scene.test.tsx` that all use **`mae-geri`** (`poseKicking` default) or
  **`mawashi-geri`** (`poseRound`) — neither authors a lean — so the new field does **not** break their
  assertions; only their stated _premise_ needs the conscious amendment. Key sites: L1611 "keeps the
  upper body upright in a kick… (M9)"; L1924 "keeps a kick upright at every phase… (M9)"; L3094 roundhouse
  upright; L2913 girdle-not-rotated-for-a-kick.

## Design (the lever)

- **New field** `lean?: number` on `MoveDescriptor` — an **authored** horizontal shift of the upper body
  (local px), applied to `head` + `shoulder` at the **active phase**. Sign matches the derived lean:
  **`+` = forward, into the target; `−` = back, away (counterbalance)**. `yoko-geri` authors a negative
  value (eye-tuned in `/dojo`). Scalar/horizontal only — a vertical pitch is not needed for the
  lean-back / lean-forward pair (D8) and is deferred; the field can widen later if a move needs it.
- **New lookup** `leanFor(move): number | null` — TOTAL, `null` when unauthored (unknown id, `""`
  sentinel, absent field), same `Map`-lookup pattern as `chamberFor`/`offHandFor`.
- **Wiring** in `scene.ts`: `const authoredLean = driven === null || winding ? 0 : leanFor(move) ?? 0;`
  added to `head`/`shoulder` x **only** (`+ lean / 2 + authoredLean`). It does **not** feed the `girdle`
  (a torso pitch is not an arm rotation) and does **not** touch `hip` (the kick still steps the hip via
  `step`). Additive: an unauthored move gets `authoredLean = 0` → byte-identical.
- **How this "generalises the hand-only lean" (story wording):** the derived reach-lean stays for
  punches (it adapts to distance — good behaviour); the lean is simply **no longer exclusively derived
  and hand-only** — any move may now author a posture lean on top. `yoko-geri` is the first, and the
  first kick to lean at all.
- **M9, amended (conscious):** M9 becomes _"a kick is upright **by default**; an **authored** per-move
  lean is the conscious exception."_ The default (a kick with no authored lean stays upright) is
  preserved and still pinned by the `mae-geri`/`mawashi-geri` tests; the exception is pinned by the new
  `yoko-geri` test. The amended tests keep their assertions and get a reworded premise + rationale
  pointing at the new test.

## Acceptance Criteria — ✅ all met (see verification below)

- [x] Given `yoko-geri` committed, at the **contact (active) phase** its `head.x` (and `shoulder.x`) sit
      **behind** the stance (negative x, away from the target) — where `mae-geri`'s head/shoulder hold at
      stance x 0. So `yoko.head.x < mae.head.x` (yoko leans, mae upright).
- [x] The lean is gated to the active phase (M9's phase gate): `yoko-geri` is **upright** (`head.x` =
      stance x) during the **chamber/windup** and **recovery** phases — it pitches back only at contact.
- [x] The leaning kick keeps a **square girdle** and an **unchanged hip step**: `yoko.hip` equals a
      no-lean kick's hip at the same reach/gap (the lean lands on the upper body only, not the girdle or
      the step), and the driven `footR` still lands on its solved target (contact endpoint unchanged).
- [x] **M9 default preserved**: `mae-geri` and `mawashi-geri` stay upright at every phase (existing
      tests green; premise reworded to "upright by default, authored lean is the exception").
- [x] **Backward-compatible**: every move that authors no `lean` renders byte-identically; `leanFor`
      falls back to `null` for an unknown id, the `""` sentinel, and an absent field. Whole suite green,
      no `src/` change, `BENCHMARK_VERSION` `v19` / `INPUT_HASH` / TCB untouched.
- [x] `/dojo` visual sign-off: `yoko-geri` reads as a bladed side kick (torso leaning back) next to
      `mae-geri`'s upright front snap; no stretched limbs. (Playwright capture: yoko @ tick 13 leans
      back, mae @ tick 10 upright.)

## Verification (RED → GREEN → scan → /dojo)

- **RED**: 2 new tests failed for the right reason (`expected 0 to be less than 0` — yoko had no lean).
- **GREEN**: `move-descriptors.ts` (`lean?` field + `leanFor` + `yoko-geri: lean -8`) + `scene.ts`
  (`authoredLean`, active-phase-gated, added to head/shoulder only). Full `scene.test.tsx` 215/215;
  full web suite green apart from one pre-existing transport flake (`ReplayPlayer` auto-pause — 15/15 in
  isolation, unrelated to pose geometry).
- **Manual mutator scan** (web ∉ Stryker): 3 mutants applied via `sed` and reverted — sign flip
  (`lean -8→8`, 2 fail), phase-gate drop (`winding` removed, 1 fail), shoulder-lean drop (2 fail: sign +
  girdle-square). All killed; baseline restored green. Intentional survivors: exact lean px (`-8`,
  eye-tuned, decision 9); the redundant `driven === null` guard in `authoredLean` (provably dead under
  the `driven === null ? {}` endpoints spread, kept for parallelism with the derived `lean`, matching
  the file's existing redundant-guard precedent).
- **Static**: `typecheck` + `lint` clean; `format` applied.

## Slices

Read CLAUDE.md + the testing rules before code. One PR — the lean lever rides in on one real, demoable
move (never a standalone "add the field" ticket, per the story-splitting warning). Web is outside
Stryker ⇒ mutation testing is **N/A**; substitute the scripted **manual mutator scan** over the diff +
exact-assertion tests asserting the **relation, not the literal** (decision 9), + `/dojo` sign-off.

### Slice 1: `yoko-geri` pitches its upper body back as it extends (the authored `lean` lever)

**Value**: The developer browsing `/dojo` (actor) sees `yoko-geri` (trigger: it renders at its active
phase) lean back off a bladed knee chamber (observable outcome), reading apart from `mae-geri` — not the
same front-snap picture at a longer reach. Introduces the per-move lean lever end-to-end and burns the
"reopen M9" risk on one move.
**Path**: `move-descriptors.ts` (`lean?` field + `leanFor` lookup + `yoko-geri` value) → `scene.ts`
`poseFor` (`authoredLean` added to head/shoulder at the active phase) → `scene()` skeleton → `/dojo` +
`/watch` playback (and the `/sheet` `yoko` cell, whose head/shoulder now shift — a bonus, since D7's lean
changes the contact silhouette).
**Class**: Behavior change (web-only; additive optional field).
**Required implementation skills**: `tdd`, `testing`; `mutation-testing` **N/A** (web ∉ Stryker →
manual mutator scan); `refactoring` assess-only.
**Reduction program**: N/A.
**Transition/terminal evidence**: N/A.
**Acceptance criteria**: the six boxes above. **Present and get confirmation before writing any code.**
**RED**: A new test — _"`yoko-geri` pitches the upper body back as it extends (the authored lean — M9's
conscious exception)"_ — poses `yoko-geri` at the active phase and asserts `head.x < 0` **and**
`shoulder.x < 0` (specific sign, kills a `+`/`−` flip), the girdle stays square + `hip.x` equals a
no-lean kick's hip at the same reach (kills a "lean leaks into girdle/step" mutant), and `footR` still
lands on its solved target. A second test asserts `yoko-geri` is upright at the **chamber** and
**recovery** phases (kills a "lean not gated to active phase" mutant). Plus `leanFor` totality coverage
(unknown id / `""` / absent → treated as 0), mirroring the `chamberFor` tests. Today `yoko-geri` authors
no lean ⇒ `head.x` = 0 at contact ⇒ the sign assertions fail: RED for the right reason.
**GREEN**: Add `lean?: number` to `MoveDescriptor`; add `leanFor`; author `yoko-geri`'s negative lean
value; in `scene.ts` compute `authoredLean` (active-phase-gated) and add it to `head.x`/`shoulder.x`.
Minimum to pass — no girdle/hip coupling, no vertical pitch.
**MUTATE or alternate evidence**: `N/A` (mutation) — manual mutator scan over the `scene.ts` /
`move-descriptors.ts` diff: sign flip (`+authoredLean`), gate removal (drop `winding`/`driven === null`),
mis-application to `hip`/`girdle`, `leanFor` fallback (`?? 0`). Each maps to a killing assertion above;
record any intentional survivors (exact px = eye-tuned, decision 9).
**KILL MUTANTS**: Strengthen any assertion a scanned mutant survives; the sign, phase-gate, and
girdle/hip assertions are the deliberate killers.
**REFACTOR**: Assess only — the `head`/`shoulder` construction stays a two-line additive edit; the two
amended M9 tests get reworded premises (rationale: "upright by default; authored lean is the exception").
Fold the eye-tune of `yoko-geri`'s knee chamber (higher/tighter, D8) into this PR's `/dojo` sign-off —
a value tweak on the existing `chamber` field, no new test.
**Done when**: all acceptance criteria met, manual scan clean, typecheck + lint + format pass, `/dojo`
capture confirms the lean-back reads (Playwright screenshot driver — `agent-browser` hangs on Pixi). PR
notes that execution/posture twins otherwise stay alike on `/sheet` (the parked motion-trail), though
`yoko`'s lean does shift its `/sheet` silhouette — a bonus. Human approves the commit.

## Pre-PR Quality Gate

1. Mutation — `N/A` (web ∉ Stryker); manual mutator scan reviewed (above).
2. Refactoring — assess; likely `N/A` beyond the reworded M9 premises.
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass; `web` vitest (node + browser
   projects) green.
4. DDD glossary — N/A (no domain-term change).
5. Confirm **no `src/` diff** (engine/TCB/`INPUT_HASH`/`v19` untouched) and the field is optional
   (unauthored moves byte-identical).

---

_Archive under `docs/archive/` when the slice closes — do not delete (`archive-plans-not-delete`)._
