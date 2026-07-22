# Plan: S3 — a technique can SWING its driven endpoint through an arc (mawashi-geri)

**Branch**: feat/move-character-s3-arc
**Status**: ✅ Shipped — PR #390 (`main`@`db4afed`, 2026-07-22). Closeout pending (archive this file).

Slice S3 of the **per-move character differentiation** arc (`plans/move-character-stories.md`,
`plans/move-character-decisions.md`). S1 (front-hand chambers) shipped #386/#387; S2 (the per-move lean
lever) shipped #388/#389. This is the **second and last mechanism-risk skeleton**: it introduces the
per-move **arc via-waypoint** lever end-to-end on one move (`mawashi-geri`) and **resolves the open
technical question the story flagged** — where the via point sits without dulling the _kime_ commit
(D3 · D8 · carried-risk 1).

## Goal

`mawashi-geri`'s rear foot **swings up and around** as it winds up — a circular load that reads apart
from `ushiro-geri`'s straight rear-leg pull in `/dojo` / `/watch` — via a new optional per-move `arc`
descriptor field, while every move that authors no arc renders byte-identically and the contact frame is
unchanged.

## The open question — resolved

The story's acceptance wording was _"the driven `footL` … off the straight **chamber→contact** line."_
Carried-risk 1 warns that an arc on the **chamber→contact (kime)** leg would soften the strike: S8 eases
`stance → chamber` over startup, then **snaps to the solved extension on the first active tick** (the
_kime_ commit, S1) and **holds** it. There is no eased chamber→contact leg to bend — phase 2 returns the
extension directly.

**Resolution: the arc rides the wind-up (`stance → chamber`) leg, not the kime.** A roundhouse's
signature horizontal whip _is_ chamber→contact, which we cannot touch; the legible cue we **can** show is
the foot **rising in a circular path** up to a high, cocked chamber (D8's "high-and-around" load), after
which the existing kime snap fires unchanged. This refines the story AC from "off the chamber→contact
line" to **"off the straight `stance → chamber` line during wind-up."** The recovery leg
(`extension → stance`) is the same mechanism at a second call site and is an explicit **deferral** (see
below) — the walking skeleton proves the arc on one leg.

## Context — the seam (already mapped)

- `web/src/pages/replay/scene.ts` `easeDriven` (~L333) drives the point along **two straight legs**:
  - **startup** (`phase === 1`): `lerpJoint(stance, chamber, u)`, `u = smoothstep(index/(length-1))`;
  - **recovery** (`phase === 3`): `lerpJoint(extension, stance, u)`;
  - **active** (`phase === 2`): returns `extension` directly (the held kime — untouched by this slice).
- During **wind-up** the eased point flows straight onto the endpoint: `endpoints.footL = driven`
  (L553–554), the hip `step` is **0** for a chamber-ward target (within leg reach, L480 / L489–492), and
  both leans are gated off while `winding` — so `scene(tape, playhead).a.pose.footL` at a startup tick
  **equals the eased driven point** with no step/lean/girdle interference. This is what makes a clean,
  literal-free **collinearity** assertion possible (below).
- `web/src/pages/replay/move-descriptors.ts`: `MoveDescriptor = { limb?, chamber?, offHand?, tuck?,
targetY?, grab?, lean? }`, each with a TOTAL `Map`-lookup (`chamberFor`/`leanFor`/…) returning the
  authored value or `null`. `mawashi-geri` already authors `{ limb: "footL", chamber: { x: -8, y: -30 } }`
  (drives the REAR leg, M12i — the one separation a 2-D side view gives it vs the front kick).
- The sibling control is `ushiro-geri` `{ limb: "footL", chamber: { x: -4, y: -24 } }` — the other
  rear-leg kick, **no arc** (D8: a straight back-thrust). Same leg, same step/girdle treatment, so a
  side-by-side test isolates the arc as the only difference — this is the story's "mawashi ≠ ushiro."

## Design (the lever)

- **New field** `arc?: Joint` on `MoveDescriptor` — an **authored via-waypoint** (local px, same frame as
  `chamber`) that the **wind-up** path bows through. Absent ⇒ the wind-up stays the straight ease (M7 /
  backward-compat). `mawashi-geri` authors one (eye-tuned in `/dojo`); it is the only arc move in v1.
- **New lookup** `arcFor(move): Joint | null` — TOTAL, `null` for an unknown id / the `""` sentinel / an
  absent field, same `Map`-lookup pattern as `chamberFor` / `offHandFor` / `leanFor`.
- **New pure helper** `bezier2(p0, p1, p2, t): Joint` — the quadratic Bézier
  `(1−t)² p0 + 2(1−t)t p1 + t² p2`. At `t = 0` it is `p0`, at `t = 1` it is `p2`, so it **preserves both
  endpoints** — the chamber is still reached exactly at the last startup tick and the kime snap is
  byte-identical.
- **Wiring** in `scene.ts`: `easeDriven` gains an `arc: Joint | null` parameter; its **startup branch
  only** becomes `arc === null ? lerpJoint(stance, chamber, u) : bezier2(stance, arc, chamber, u)`.
  Recovery and active are untouched. The call site passes `arcFor(frame.attackMove)`. Additive: an
  unauthored move takes the `null` branch → the exact `lerpJoint` it draws today → **byte-identical**.
- **How this composes with the kime (carried-risk 1):** the Bézier bends the interior of the
  `stance → chamber` leg but pins the chamber endpoint; `phase === 2` still returns the solved extension
  and holds it (S1). So the strike commits and lands exactly as today — the arc lives entirely in the
  wind-up. **No `src/`, `v19` / TCB / `INPUT_HASH` untouched.**

### Deferred (stated, not silent)

- **Recovery-leg arc** — the same `bezier2` at the `extension → stance` recovery branch (a foot
  follow-through swinging back down). The walking skeleton proves the mechanism on the wind-up leg; if the
  `/dojo` sign-off finds the wind-up arc alone does not read as a roundhouse, adding the recovery arc is
  the first eye-tune fallback (same field, second call site — a fast follow, possibly in this PR). Named
  here so it is a decision, not an omission.
- **`/sheet`** — execution-only twins stay identical on `/sheet` (it freezes the contact frame, which the
  arc does not touch; unlike S2's lean, an arc leaves no contact-silhouette bonus). The parked
  motion-trail (D5) is the eventual static answer. Say so in the PR.

## Acceptance Criteria — ✅ all met (see verification below)

- [x] Given `mawashi-geri` committed, at a **mid wind-up (startup) tick** its driven `footL` sits **off
      the straight line** between its stance foot (first startup tick) and its chamber (last startup
      tick) — a swing — and on the **authored side** (a signed offset, so a via sign-flip is caught).
- [x] Given a rear-leg kick that authors **no arc** (`ushiro-geri`), its driven `footL` at every startup
      tick is **collinear** with its own stance→chamber line (the straight ease, exactly as today) — so
      `mawashi` swings where `ushiro` travels straight (the front-vs-back rear-leg contrast).
- [x] The swing **does not move contact**: at the **active (kime) tick** `mawashi`'s `footL` lands on the
      solved extension (fully forward, far past the wind-up path), and the held-extension window is
      unchanged (S1 kime hold intact). The existing kick contact / kime tests stay green (byte-identical).
- [x] **Backward-compatible**: every move that authors no `arc` renders byte-identically; `arcFor` falls
      back to `null` for an unknown id, the `""` sentinel, and an absent field. Whole suite green, no
      `src/` change, `BENCHMARK_VERSION` `v19` / `INPUT_HASH` / TCB untouched.
- [x] `/dojo` visual sign-off: `mawashi-geri` reads as a roundhouse loading up-and-around next to
      `ushiro-geri`'s straight rear-leg thrust; no stretched limbs / broken bone lengths through the
      wind-up. (Playwright capture: the rear foot traces down → out/back → up-and-around across ticks
      3/5/8, then snaps to a clean fully-extended kick at contact tick 11.)

## Verification (RED → GREEN → scan → /dojo)

- **RED**: the new `mawashi` bow test failed for the right reason — `expected -83 to be less than -800`
  (no arc ⇒ the mid wind-up foot is collinear ⇒ the signed bow is rounding noise only). The `ushiro`
  (collinear) and contact guards passed from the start.
- **GREEN**: `move-descriptors.ts` (`arc?: Joint` field + `arcFor` lookup + `mawashi-geri: arc {-26,-16}`)
  - `scene.ts` (pure `bezier2`, an `arc` parameter on `easeDriven`, the **startup branch only** bowing
    through the via). Full `scene.test.tsx` 218/218; full `web` project 626/626 (incl. the previously-flaky
    transport test); typecheck + lint + `prettier --check` on the touched files clean.
- **Manual mutator scan** (web ∉ Stryker): 4 mutants applied via `sed` and restored from a green
  snapshot — drop the Bézier (startup back to straight, Test A fails); via sign-flip `{-26,-16}→{26,16}`
  (Test A's signed bow fails); `arcFor` fallback leaks `?? null → ?? {…}` (Test B, ushiro, fails); break
  the `phase === 2` short-circuit so the arc leaks into contact (Test C fails). All killed; baseline
  restored green. Intentional survivor: the exact via px (`{-26,-16}`, eye-tuned, decision 9) — the test
  pins the bow's SIDE + magnitude, not the literal.
- **Static**: `typecheck` (all three tsconfigs) + `eslint` + `prettier --check` on the diff pass. **No
  `src/` diff** — engine / TCB / `INPUT_HASH` / `BENCHMARK_VERSION` (`v19`) untouched.

## Slices

Read CLAUDE.md + the testing rules before code. One PR — the arc lever rides in on one real, demoable move
(never a standalone "add the field" ticket, per the story-splitting warning). Web is outside Stryker ⇒
mutation testing is **N/A**; substitute the scripted **manual mutator scan** over the diff + exact-assertion
tests asserting the **relation, not the literal** (decision 9), + `/dojo` sign-off.

### Slice 1: `mawashi-geri`'s rear foot swings through an arc as it winds up (the authored `arc` lever)

**Value**: The developer browsing `/dojo` (actor) sees `mawashi-geri` (trigger: it renders through its
wind-up) swing its rear foot up-and-around off a circular load (observable outcome), reading apart from
`ushiro-geri`'s straight rear-leg pull. Introduces the per-move arc via-waypoint lever end-to-end and burns
the "arc vs the kime snap" placement risk on one move.
**Path**: `move-descriptors.ts` (`arc?` field + `arcFor` lookup + `mawashi-geri` value) → `scene.ts`
`easeDriven` (`bezier2` on the startup branch, gated by `arc`) → `poseFor` → `scene()` skeleton → `/dojo` +
`/watch` playback. (`/sheet` unchanged — the arc lives in the wind-up, not the contact frame.)
**Class**: Behavior change (web-only; additive optional field).
**Required implementation skills**: `tdd`, `testing`; `mutation-testing` **N/A** (web ∉ Stryker → manual
mutator scan); `refactoring` assess-only.
**Reduction program**: N/A.
**Transition/terminal evidence**: N/A.
**Acceptance criteria**: the five boxes above. **Present and get confirmation before writing any code.**
**RED**: A new `describe` block — _"a technique swings its driven endpoint through an arc (per-move
character S3)"_ — modelled on the S8 `gyakuRun` pattern (a multi-tick synthetic startup run, playhead
indexing into it, reading `scene(tape, playhead).a.pose.footL`):

- **Test A (the swing).** Build a 3-tick (or 5-tick) `mawashi-geri` **startup** run. Read `footL` at the
  first tick (`≈ stance`), the last (`≈ chamber`), and a mid tick. Assert the mid is **off** the
  stance→chamber line via a signed cross-product `((chamber − stance) × (mid − stance))` that is nonzero
  **with the authored sign** (kills both "no arc / straight" and a via sign-flip). Collinearity is
  affine-invariant, so this works directly on the projected `.pose.footL` with **no literal** — decision 9.
  Today `mawashi` authors no arc ⇒ the mid is collinear ⇒ cross-product `0` ⇒ RED for the right reason.
- **Test B (no-arc control / backward-compat).** Same construction with `ushiro-geri` (rear leg, no arc);
  assert the mid `footL` is **collinear** (`|cross| ≤ ε` for rounding). Green before and after — pins that
  the arc is opt-in and that `mawashi ≠ ushiro` at the mid wind-up tick.
- **Test C (contact unmoved).** A `mawashi-geri` **active**-phase run; assert `footL` lands fully forward
  at the solved extension (its `x` far past the mid-windup `footL.x`) and the two active ticks are equal
  (kime hold). Structurally guaranteed (the diff only touches the startup branch) and the existing
  kick-contact / S8 kime tests are the byte-identical regression evidence.
- **Test D (`arcFor` totality).** Unknown id / `""` / absent field → `null`, mirroring the `chamberFor` /
  `leanFor` totality tests.

**GREEN**: Add `arc?: Joint` to `MoveDescriptor`; add `arcFor`; author `mawashi-geri`'s via value; add the
pure `bezier2`; thread an `arc` parameter into `easeDriven` and branch the **startup** case only. Minimum to
pass — no recovery arc, no active-phase change.
**MUTATE or alternate evidence**: `N/A` (mutation) — manual mutator scan over the `scene.ts` /
`move-descriptors.ts` diff:

- drop the Bézier branch (startup back to straight `lerpJoint`) → Test A's off-the-line assertion fails;
- via sign-flip / negate the waypoint → Test A's **signed** cross-product fails;
- apply `bezier2` at the active or recovery branch → Test C (contact) / an unauthored-move regression fails;
- `arcFor` fallback (`?? someJoint` instead of `null`, or arc leaking to unauthored moves) → Test B / Test D
  fails.

Each maps to a killing assertion above; record intentional survivors (the exact via px = eye-tuned,
decision 9; any redundant `driven === null`-style guard kept for parallelism with the `lean`/derived-lean
precedent).
**KILL MUTANTS**: Strengthen any assertion a scanned mutant survives; the signed cross-product and the
no-arc-collinear control are the deliberate killers.
**REFACTOR**: Assess only — `bezier2` is a small pure sibling of `lerpJoint`/`smoothstep`; the startup
branch stays a one-line ternary. Fold the eye-tune of `mawashi-geri`'s chamber + via (higher/around, D8)
into this PR's `/dojo` sign-off — value tweaks on descriptor fields, no new test. If the wind-up arc alone
does not read as a roundhouse by eye, add the recovery-leg `bezier2` (the named deferral) in the same PR.
**Done when**: all acceptance criteria met, manual scan clean, typecheck + lint + format pass, `/dojo`
capture confirms the swing reads (Playwright screenshot driver — `agent-browser` hangs on Pixi). PR notes
that execution twins stay alike on `/sheet` (the parked motion-trail) and that the arc rides the wind-up,
not the kime (carried-risk 1 resolved). Human approves the commit.

## Pre-PR Quality Gate

1. Mutation — `N/A` (web ∉ Stryker); manual mutator scan reviewed (above).
2. Refactoring — assess; likely `N/A` beyond the new `bezier2` helper.
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass (format only the files this PR
   touches — no repo-wide `prettier --write`, there is pre-existing drift); `web` vitest (node + browser
   projects) green.
4. DDD glossary — N/A (no domain-term change).
5. Confirm **no `src/` diff** (engine/TCB/`INPUT_HASH`/`v19` untouched) and the field is optional
   (unauthored moves byte-identical).

---

_Archive under `docs/archive/` when the slice closes — do not delete (`archive-plans-not-delete`)._
