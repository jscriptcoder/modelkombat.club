# Replay viewer "make it fight" — child stories

Split via `story-splitting` (2026-07-18) from `plans/replay-viewer-fight-decisions.md`
(grilled + gap-tightened design). Feeds `planning` — one child story at a time → PR-sized
implementation slices → TDD. Harness-first order, honoring the grilled sequencing decision.

## Parent (reframed)

**A spectator watching a replay** (and the developer tuning the viewer) **sees two fighters
that read as _actually fighting_** — big and engaged at believable distances, with bending
limbs, strikes and grabs that land on contact, each wearing its authoring model's identity.

_Current constraint (why it's too large):_ today the figures are tiny and far apart (they hit
the air), limbs are rigid single segments (no elbows/knees), and heads are plain colored
circles. Four visual capabilities + one tuning tool — too big for one slice.

_Shape note:_ this is a **capability + quality** split (four largely-parallel visual
improvements + a harness), not a walking-skeleton-then-thicken shape. Each child is a distinct
user-visible capability; they compose rather than layer.

## Progress

- **Story 1 · `/dojo` pose lab — ✅ COMPLETE + ARCHIVED** (2026-07-18). 3 slices, PR-per-slice
  (#329 · #330 · #331); plan archived at `docs/archive/replay-viewer-fight-s1-dojo.md` (archive
  PR #332, `main` @ `9ecb5f5`). The tuning harness every later slice is demoed on is live.
- **Story 2 · model-identity heads — ✅ COMPLETE + ARCHIVED** (2026-07-18). 3 slices, PR-per-slice
  (#333 shared source · #334 glyph heads on `/watch` · #335 `/dojo` picker); plan archived at
  `docs/archive/replay-viewer-fight-s2-heads.md` (archive PR #336, `main` @ `eff2c36`). The "coin" (disc)
  was dropped mid-plan for a bare glyph head. Fighters now wear their author's mark on real replays.
- **Story 3 · big fighters (world-scale) — NEXT** (see the split-candidates table row 3). Needs
  `planning` to slice it; its plan file lands with Slice 1's PR (the S2 pattern — plan shipped in #333).
- Stories 4–5 (bends · connect) not started.

## Recommended first slice

**`/dojo` pose lab** — the two-figure tuning harness. **✅ Done — see Progress above.**

_Why this was first:_ it burned down the integration/architecture risk (new dark route +
synthetic tape driving the **real** `scene()`/`createStage` pipeline) and became the demo +
tuning surface every later slice is built and signed off on. Its value was **developer /
learning**, not spectator — stated explicitly.

## Split candidates

| # | Slice (actor + capability) | Value | Includes | Defers | Release |
|---|---|---|---|---|---|
| 1 ✅ | **Developer poses two fighters in `/dojo`** _(DONE — #329·#330·#331)_ | The isolated, deterministic surface to pose fighters and see the exact render pipeline — demo + tuning surface for every later slice; a permanent tool | Dark route `/dojo` (no nav link); two figures via real `scene()`/`createStage` from a hand-built synthetic tape; per-figure controls (posture · action · band · facing, **free combos**); world-gap slider with **move-reach snap presets**; default first-load state (gyaku 240k, one mid-strike). Renders the **current** pose model | Brand picker (ships with story 2); the visual _correctness_ of scale/bends/contact (later stories improve what `/dojo` shows) | Shippable, **dark** (no nav link), like `/watch` |
| 2 ✅ | **Spectator sees each fighter's model as a glyph head** _(DONE — #333·#334·#335)_ | At a glance: which model authored each fighter (Claude/GPT/Gemini/Grok/generic), reusing the existing tested marks | Refactor `BrandMark` → shared glyph source (DOM behavior-preserving); Pixi head via `Graphics.svg()`; resolve brand **once per fighter** at figure creation via shared `modelToBrand`; **bare brand glyph** (disc dropped mid-plan — M11 revised; Grok mono near-white); body keeps side color; head **counter-flips**; `brand` data hook (`label`); add the **brand picker** to `/dojo` | Per-move anything; head is **identity only** | Shippable (real replays get heads) |
| 3 | **Spectator sees big fighters filling the ring** | Fighters stand at believable fighting distance — no longer tiny figures across a void (attacks problem #1: separation) | Body defined in **world sub-units** (× `pxPerSubunit`); **one tunable height knob** (~240k) with proportional derivation of all dims (head = 0.3× height); vertical-fit sanity (M12). Tune in `/dojo` | Bent limbs (story 4); reach-to-target contact precision (story 5) — **straight limbs still** | Shippable |
| 4 | **Spectator sees limbs bend (elbows & knees)** | Limbs read as jointed, not rigid sticks (attacks problem #2: stiffness) | Skeleton → ~11 joints; bones `shoulder→elbow→hand` / `hip→knee→foot`; **derived** facing-aware bends (elbows back, knees forward) for STAND/CROUCH/AIR; **PRONE authors its own 11**; override layers set endpoints, mid-joint re-derives. Pure/scrub-safe | IK reach-to-target (story 5); per-move authored silhouettes (deferred follow-on) | Shippable |
| 5 | **Spectator sees strikes & grabs land on contact** | A strike/grab visibly lands when in range; a real whiff reads as a whiff — the payoff that sells "fighting" (closes problem #1 at the limb level) | **[task]** additive `attackReach` on `RenderFrame` (strike=`spec.reach`, throw=`throw.reach`, 0 idle) + web mirror + defensive handling. **[story]** 2-bone IK of the striking limb (+ both grab hands) → opponent's **near edge**, clamped `[FLOOR, attackReach]` with **lean+telescope**; degenerate → forward floor; direction = facing. Pure/scrub-safe | Chamber→snap→recover animation + per-move silhouettes (deferred follow-on: needs `move` id + phase) | Shippable; engine field is **byte-identical** |

## Acceptance examples (per story — precondition → trigger → observable)

**1 · `/dojo` pose lab**
- Route loads → two fighters render on the dark canvas at the default state.
- Figure A posture set to CROUCH → A renders crouched (assert pure-model scene-graph joints).
- Gap slider snapped to "gyaku 240k" → the two roots sit 240k sub-units apart (assert projected x).
- action=strike + throwing + knockdown on one figure (impossible combo) → renders per `poseFor` precedence (PRONE) without error.

**2 · Coin heads**
- Fighter a model `"Claude Opus 4.8"` → a's head node `data-brand="claude"` (the claude coin).
- Model `"grok-2"` → brand `grok`, explicit mono treatment; empty/unknown → `generic`.
- Left-facing fighter → coin renders **upright** (counter-flip), not mirrored.
- Existing `BrandMark` / `ModelLogo` champion-card tests pass **unchanged**.

**3 · Big fighters**
- Contact-distance frame → the two fighters occupy a large fraction of ring width (assert projected extents).
- Height knob `H` → all dims scale proportionally (head diameter ≈ 0.3·H).
- Jump frame → lifts without NaN; extreme jumps may clip (accepted, M12).

**4 · Limbs bend**
- STAND → each arm shows `shoulder→elbow→hand` with the elbow off the straight line (assert offset).
- PRONE knockdown → body horizontal with its **authored** elbow/knee (assert 11 joints).
- Left vs right facing → elbows bow the correct way (assert bend flips with facing).
- Same frame scrubbed forward then back → identical joints (determinism).

**5 · Strikes connect**
- attacking, `attackReach` 240k, opponent near-edge in range → striking hand lands on the near edge.
- opponent beyond `attackReach` → limb extends to the cap and stops short (whiff reads as whiff).
- `throwing` → both grab hands reach the near edge using `throw.reach`.
- gap ≈ 0 / opponent behind facing → limb shows the forward floor (never backward).
- `attackReach` absent/negative on the wire → limb keeps its stance pose (defensive → 0).
- Engine change → replays remain **byte-identical** (additive render field).

## Dependencies

- **5 → 4 (hard):** the IK solve needs story 4's elbow joint.
- **5 → `attackReach` task (hard):** the reach data.
- **4 → 3, 3 → (none) (soft):** bends look better at scaled proportions, but aren't blocked; scale is independent-valuable with straight limbs.
- **2 → nothing (independent):** heads ship to real replays regardless of `/dojo`; the `/dojo` brand picker is a nicety added within story 2.
- All of 3/4/5 touch the shared pose/scale model → sequence **scale → bends → connect** to avoid churn, but each is independently testable through the pure model.

## Parking lot

- **`attackReach` = enabling task, owned by story 5.** Planning **may** land it as a standalone
  byte-identical prep PR first (the harness-first instinct from grilling) — but it is **not** an
  independent story (a hidden field with no behavior = component task).
- **Deferred follow-on arc** (post this split, decided later in `/dojo`): per-move signature
  silhouettes + chamber→snap→recover animation — needs `move` id + move-phase render fields.
- **`/dojo` control growth** stays within the story that needs it (brand picker → story 2).

## Warnings

- **Story 1's value is developer/learning, not spectator** — legitimate (harness/tool), but
  stated openly. Swap to heads-first if spectator value should lead.
- **Don't resurrect `attackReach` / "engine field" as its own story** — it's a component task;
  folded into story 5 (red flag avoided).
- **Stories 3/4/5 share the pose/scale model** — real churn risk if reordered; keep scale →
  bends → connect.

## Next step

Stories 1 (`/dojo` pose lab) and 2 (model-identity heads) are done + archived. **Story 3 —
big fighters (world-scale)** is next: **load `planning` for story 3** to sequence it into PR-sized
TDD slices. Shape (table row 3 + M12): define the body in **world sub-units** (× `pxPerSubunit`)
with **one tunable height knob** (~240k) that proportionally derives every dimension (head =
0.3× height), tuned in `/dojo`, with the M12 vertical-fit sanity check — **straight limbs still**
(bends are story 4, contact precision story 5). Each planned slice repeats the full cycle —
`tdd` · `testing` · `mutation-testing` (manual scan; `web/` is not Stryker-reachable) ·
`refactoring`, RED→GREEN→MUTATE→KILL→REFACTOR — before the next begins. **Keep 3 → 4 → 5 (scale →
bends → connect) in order** — they share the pose/scale model, so reordering risks churn; 5 also
hard-depends on 4's elbow joint + the `attackReach` task.
