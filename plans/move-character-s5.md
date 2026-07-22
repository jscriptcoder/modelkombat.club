# Plan: S5 — the front-hand pair loads on its own arc (uraken · shuto)

**Branch**: feat/move-character-s5-hand-arcs
**Status**: Active — plan drafted, awaiting acceptance-criteria confirmation before any code.

Slice **S5 of 5** — the **LAST slice** of the **per-move character differentiation** arc
(`plans/move-character-stories.md`, `plans/move-character-decisions.md`). S1 (front-hand chambers)
shipped #386/#387; S2 (the per-move `lean` lever, on `yoko-geri`) shipped #388/#389; S3 (the per-move
`arc` lever, on `mawashi-geri`) shipped #390/#391; S4 (the `lean` reused forward, on `ushiro-geri`)
shipped #392/#393. This is the **second group-completion slice** and, like S4, introduces **no new
mechanism**: it authors S3's existing `arc` field on the two front-hand moves a straight jab cannot
express, finishing the **front-hand trio** so `uraken` and `shuto` read apart from the jab — and from
each other — by their _wind-up path_, not just their chamber.

## Goal

`uraken`'s and `shuto`'s front hand each **loads on its own curved path** as it winds up — `uraken`'s
fist bowing across the centreline, `shuto`'s hand bowing up toward its high by-the-ear cock — reading
apart from `kizami-zuki`'s straight jab load and from each other in `/dojo` / `/watch`, via S3's existing
optional `arc` descriptor, while every move that authors no arc renders byte-identically and the contact
frame is unchanged.

## Why this is the whole slice (no new mechanism)

The story frames S5 as _"apply S3's arc lever to `uraken` (fist whips across) and `shuto` (chops
down-and-in from the high chamber), on top of their S1 chambers."_ Both halves are already reachable:

- **The arc lever is built and limb-agnostic.** S3 shipped `arc?: Joint` on `MoveDescriptor`, the total
  `arcFor` lookup, the pure `bezier2`, and the wiring: `easeDriven`'s **startup branch only** is
  `arc === null ? lerpJoint(stance, chamber, u) : bezier2(stance, arc, chamber, u)`
  (`scene.ts` L370–374), and the call site passes `arcFor(frame.attackMove)` (L454). `easeDriven` drives
  **whichever endpoint `limb` names** — `stanceDriven = deriveSkeleton(stance)[limb]`,
  `chamber = chamberFor(move)` (L440–455) — so for a `handR` move it bows the hand's `stance → chamber`
  wind-up leg exactly as it bows the foot for `mawashi-geri`. **No `scene.ts` change.**
- **A hand's wind-up is interference-free**, so the bow lands cleanly on `handR`. During winding a hand
  has `step = 0` (`!isKick`, L512–515), `lean = 0` (`winding` gate, L498), and therefore `girdle = 0`
  (L538–541); the eased/bowed `driven` flows straight to `endpoints.handR`. So
  `scene(tape, playhead).a.pose.handR` at a startup tick **equals the bowed driven point** with no
  step/lean/girdle to muddy a collinearity read — the same clean seam S3 used on `footL`.
- **The chambers already exist** (S1): `kizami-zuki { x: 12, y: -50 }` (fast, forward-low, near guard),
  `uraken { x: -8, y: -56 }` (cocked across the centreline, high), `shuto { x: -2, y: -62 }` (highest, by
  the ear). S5 adds `arc: <via>` to `uraken` and `shuto`; `kizami-zuki` authors **no** arc and stays the
  straight jab — the group's built-in control, exactly as `ushiro-geri` was S3's no-arc control.

So the entire slice is: **author one `arc` via on `uraken` and one on `shuto`** (eye-tuned in `/dojo`),
each riding on top of its S1 chamber. This mirrors S4 (descriptor-only, an existing field reused) — two
values instead of one, and there is **no fixture debt** and **no design-rule amendment** (S3 already
built and validated the arc; carried-risk 1 was resolved there).

## The design note — what an arc on a hand can and cannot show (D3 · D8 · carried-risk 1)

D8's cues are _"`uraken` = fist cocked across the body, **whips out**"_ and _"`shuto` = high chamber by
the ear, **chops down-and-in**."_ The **whip** and the **chop** are chamber→**contact** motions — the
_kime_ leg — which S3 established (carried-risk 1) we **cannot** arc without dulling the strike: the
active phase snaps to the solved extension on the first active tick and **holds** it (S1/S8), so there is
no eased chamber→contact leg to bend. As with `mawashi-geri` (whose horizontal whip is likewise the
untouchable kime, and whose arc instead shows the foot's **circular load**), S5's arc rides the
**wind-up** (`stance → chamber`) leg: it makes each hand **load on a curve** — `uraken` bowing across,
`shuto` bowing up to its high cock — rather than lifting straight. That loading curve is the legible cue
a 2-D side view can show; the whip/chop itself remains the kime snap, unchanged.

**Reading apart from _each other_ (not just from the jab)** is the one thing S5 must prove that S3 did
not (S3 had a single arc move vs one straight control). The two vias must curve **distinguishably** —
matching D8's across-vs-up contrast — so `uraken` and `shuto` are not one picture. Their S1 chambers
already differ; S5 adds that their wind-up **paths** curve in different directions. The test pins this
directly (Test D below): the perpendicular displacement each arc introduces points a **materially
different way** for the two moves. Exact vias are eye-tuned in `/dojo`; the relation is pinned, not the
pixel (decision 9).

## Context — the seam (already built, verified in S3)

- `web/src/pages/replay/scene.ts`: `bezier2` (L327–334), the `arc` parameter on `easeDriven` and its
  **startup-only** bow (L347–375), the call site (L447–455). **Untouched by this slice.** Recovery
  (`extension → stance`) and active (the held kime) stay straight/pinned.
- `web/src/pages/replay/move-descriptors.ts`: `arc?: Joint` + the total `arcFor` (L304–309) already
  exist. `uraken`/`shuto` today carry a `chamber` and **no** `arc`; this slice adds a `via`. `kizami-zuki`
  stays as-is (no arc — the straight-jab control).
- The front shoulder sits at `(7, -64)` and the stance `handR` at `{ x: 18, y: -44 }`. Each **via**, like
  each chamber, must stay within **~2·ARM_BONE (≈31 local px)** of the shoulder, or `deriveBend`
  straightens the arm into a stretched line at the mid-windup tick. The S1 chambers are all well inside
  (uraken ≈17, shuto ≈9 from the shoulder); a via that bows a modest amount off the chord stays inside
  too (e.g. an across-bowing `uraken` via near `{ -18, -52 }` ≈ 27.7, a high-bowing `shuto` via near
  `{ 8, -72 }` ≈ 8) — **illustrative, non-binding**; the real values are eye-tuned. This is the S5
  analogue of S1's chamber bound and S4's lean bound.
- Phase lengths (`web/src/pages/dojo/reach-presets.ts`, the engine-mirror table — **not touched**):
  `uraken` startup 7 / active 2; `kizami-zuki` startup 7 / active 2; `shuto` startup 8 / active 2. Ample
  wind-up ticks for a bow to read (mawashi's was 11; the bow is a path shape, not a tick count — the S3
  test proved it on a synthetic 5-tick run regardless).

## Design (the authoring)

- **`uraken`** gains `arc: <via>` bowing its `stance handR → chamber {-8,-56}` leg **across the
  centreline** (the fist swinging across as it cocks) — a horizontally-dominant load.
- **`shuto`** gains `arc: <via>` bowing its `stance handR → chamber {-2,-62}` leg **up** toward the high
  by-the-ear cock — a vertically-dominant load.
- **`kizami-zuki`** authors **no** arc → its wind-up stays the straight ease (the jab), the group's
  no-arc control.
- Both vias eye-tuned in `/dojo`, each within the arm's-reach bound above. Comment each descriptor with
  the D8 rationale, the wind-up-not-kime placement (carried-risk 1), the arm's-reach note, and
  "relation pinned, not the pixel."

### Deferred (stated, not silent)

- **Recovery-leg arc** — the same `bezier2` at the `extension → stance` recovery branch (the hand
  following through back to guard). S3 deferred it for the foot; S5 keeps that deferral. If the `/dojo`
  sign-off finds a wind-up arc alone does not read for a hand, adding the recovery arc (same field, second
  call site — a `scene.ts` change, so it would be its **own** follow-up, not silently folded in) is the
  first eye-tune fallback. Named here so it is a decision, not an omission.
- **`/sheet`** — execution-only twins stay identical on `/sheet` (it freezes the contact frame, which the
  arc does not touch). Unlike S2/S4's lean, an arc leaves **no** contact-silhouette bonus — so
  `uraken`/`shuto`/`kizami` stay alike on `/sheet` until the parked motion-trail (D5). Say so in the PR,
  so "the sheet still shows them the same" is not misread as the fix failing.

## Acceptance Criteria

- [ ] Given `uraken` committed, at a **mid wind-up (startup) tick** its driven `handR` sits **off the
      straight line** between its stance hand (first startup tick) and its chamber (last startup tick) — a
      curved load — and on the **authored side** (a signed cross-product, so a via sign-flip is caught).
- [ ] Given `shuto` committed, at a mid wind-up tick its driven `handR` likewise sits **off** its own
      stance→chamber line, on **its** authored side.
- [ ] Given `kizami-zuki` (the jab, authors no arc), at every startup tick its driven `handR` is
      **collinear** with its own stance→chamber line (the straight ease, exactly as today) — so the two
      arced hands curve where the jab travels straight (the arc is opt-in; `arcFor` does not leak).
- [ ] Given `uraken` and `shuto` at the mid wind-up tick, the perpendicular displacement each arc
      introduces (mid minus the straight-chord midpoint) points a **materially different way** for the two
      — they read apart **from each other**, not just from the jab (matching D8's across-vs-up contrast).
- [ ] The arcs **do not move contact**: at the active (kime) tick each hand lands fully forward on the
      solved extension (far past the wind-up path) and the held-extension window is unchanged (S1 kime
      hold intact). The existing hand-strike / kime tests stay green (byte-identical).
- [ ] **Backward-compatible / web-only**: every move that authors no `arc` still renders byte-identically;
      no `src/` change; `BENCHMARK_VERSION` `v19` / `INPUT_HASH` / TCB untouched; whole `web` suite green.
- [ ] `/dojo` visual sign-off: `uraken` reads as a backfist loading across the body and `shuto` as a
      knife-hand loading up high, both apart from `kizami-zuki`'s straight jab and from each other; no
      stretched arms / broken bone lengths through the wind-up.

## Slices

Read CLAUDE.md + the testing rules before code. **One PR** — the arc lever rides in on two real, demoable
moves (never a standalone "add the field" ticket, per the story-splitting warning; the field already
exists anyway). Web is outside Stryker ⇒ mutation testing is **N/A**; substitute the scripted **manual
mutator scan** over the diff + exact-assertion tests asserting the **relation, not the literal**
(decision 9) + a `/dojo` sign-off.

### Slice 1: `uraken` and `shuto` each load their front hand through its own wind-up arc

**Value**: The developer browsing `/dojo` (actor) sees `uraken` (trigger: it renders through its wind-up)
bow its fist across the body and `shuto` bow its hand up to a high cock (observable outcome), reading
apart from `kizami-zuki`'s straight jab and from each other — finishing the front-hand trio's
differentiation from distinct wind-up _positions_ (S1) to distinct wind-up _paths_ (S5). Completes the
whole 7-move arc.
**Path**: `move-descriptors.ts` (`uraken.arc` + `shuto.arc` values + comments) → the **already-wired**
`arcFor` → `easeDriven` startup Bézier (unchanged) → `poseFor` → `scene()` skeleton → `/dojo` + `/watch`
playback. (`/sheet` unchanged — the arc lives in the wind-up, not the contact frame.) **No `scene.ts`
diff.**
**Class**: Behavior change (web-only; two authored values on an existing optional field).
**Required implementation skills**: `tdd`, `testing`; `mutation-testing` **N/A** (web ∉ Stryker → manual
mutator scan); `refactoring` assess-only.
**Reduction program**: N/A.
**Transition/terminal evidence**: N/A.
**Acceptance criteria**: the seven boxes above. **Present and get confirmation before writing any code.**
**RED**: A new `describe` block — _"the front-hand pair loads on its own arc (per-move character S5)"_ —
modelled directly on S3's arc block (`scene.test.tsx` L4367), reusing its `bowOf` signed-cross-product
helper and its `windUp` 5-tick startup-run pattern, but reading `.pose.handR` (a `handAt`) instead of
`.pose.footL`. Because `uraken`/`shuto` author no arc **today**, each bows ≈ 0 (collinear) ⇒ the swing
assertions fail for the right reason (mirrors S3's `expected -83 to be less than -800`).

- **Test A (uraken bows).** 5-tick `uraken` startup run; read `handR` at tick 0 (≈ stance), tick 4
  (≈ chamber), tick 2 (mid). Assert `bowOf(stance, chamber, mid)` is past a threshold on the authored
  side (kills "no arc / straight" **and** a via sign-flip). RED today (no arc ⇒ collinear ⇒ ≈ 0).
- **Test B (shuto bows).** Same construction for `shuto`, its own authored side. RED today.
- **Test C (kizami straight — the no-arc control / backward-compat).** Same construction for
  `kizami-zuki`; assert `|bowOf| ≤ ε` (rounding). Green before and after — pins the arc is opt-in and that
  the jab differs from the two arced hands.
- **Test D (uraken ≠ shuto).** For each move let `offset = mid − midpoint(stance, chamber)` (the
  perpendicular displacement the arc introduces; zero for a straight ease). Assert `offset(uraken)` and
  `offset(shuto)` point **materially differently** (e.g. opposite sign in one component, or a small/negative
  normalized dot) — literal-free, encodes "the two arcs curve differently." Exact threshold/sign finalized
  at RED with the eye-tuned vias.
- **Test E (`arcFor` totality / hand-specific).** Covered by S3's existing `arcFor` totality test
  (unknown id / `""` / absent → `null`); add a hand id only if the scan shows a gap.

**GREEN**: Add `arc: <via>` to `uraken` and to `shuto` in `move-descriptors.ts` (eye-tuned, each inside
the arm's-reach bound), with comments. **Nothing else** — the mechanism is S3's. Minimum to pass Tests
A/B/D while C/contact stay green.
**MUTATE or alternate evidence**: `N/A` (mutation) — manual mutator scan over the `move-descriptors.ts`
diff (apply via precise `sed`, restore from a GREEN snapshot — **not** `git checkout`, the durable lesson;
the rows are uncommitted):

- drop `uraken.arc` / `shuto.arc` (back to straight) → Test A / B fails;
- via sign-flip / negate a waypoint → that move's **signed** `bowOf` (Test A/B) fails;
- give `uraken` and `shuto` the **same** via → Test D fails (the two no longer curve apart);
- (regression) the arc must not leak to `kizami-zuki` or move contact → Test C / the contact test fails.

Record intentional survivors: the exact via px (eye-tuned, decision 9 — the tests pin the bow's side +
magnitude + the pair's contrast, not the literals). S3's `scene.ts` arc-wiring mutants stay S3-covered —
this slice does not touch `scene.ts`.
**KILL MUTANTS**: The signed `bowOf` (A/B), the collinear control (C), and the different-direction offset
(D) are the deliberate killers. Strengthen any assertion a scanned mutant survives.
**REFACTOR**: Assess only — expected `N/A` (two data values + a test block; no new helper, `bowOf`/`windUp`
reused from S3). Fold the eye-tune of both vias (across / up, D8) into this PR's `/dojo` sign-off — value
tweaks on descriptor fields, no new test. If a wind-up arc alone does not read for a hand by eye, the
recovery-leg arc is the named deferral (its own follow-up, since it touches `scene.ts`).
**Done when**: all seven acceptance criteria met, manual scan clean, typecheck + lint + `format:check` on
the touched files pass (format only the files this PR touches — no repo-wide `prettier --write`, there is
pre-existing drift), `web` vitest (node + browser) green, `/dojo` capture confirms both arcs read
(Playwright screenshot driver — `agent-browser` hangs on Pixi). PR notes that execution twins stay alike
on `/sheet` (the parked motion-trail) and that the arc rides the wind-up, not the kime (carried-risk 1,
resolved in S3). Human approves the commit.

## Pre-PR Quality Gate

1. Mutation — `N/A` (web ∉ Stryker); manual mutator scan reviewed (above).
2. Refactoring — assess; expected `N/A` (data + test only, helpers reused from S3).
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass (format only the files this PR
   touches); `web` vitest (node + browser projects) green.
4. DDD glossary — N/A (no domain-term change).
5. Confirm **no `src/` diff** and **no `scene.ts` diff** (engine/TCB/`INPUT_HASH`/`v19` untouched); the
   `arc` field stays optional (unauthored moves byte-identical).

## After this slice — the arc closes

S5 is the **last slice**. Its closeout (archive this plan → `docs/archive/`, STATUS item 11 → "S5 of 5 /
complete", README arc section — mirroring #387/#389/#391/#393) is followed by the **whole-arc close**,
which finally archives the live `plans/move-character-{decisions,stories}.md` out of `plans/` (they stayed
live across S1–S5). At that point all 7 colliding moves read apart by execution and `plans/` holds no
move-character files.

---

_Archive under `docs/archive/` when the slice closes — do not delete (`archive-plans-not-delete`)._
