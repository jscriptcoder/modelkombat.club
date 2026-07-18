# Replay viewer "make it fight" — resolved design decisions

Resolved via `grill-me` (2026-07-18). Pre-planning source of truth for the next replay-viewer
work: making the stickmen read as **actually fighting** (not hitting the air), giving them
**articulated limbs** (elbows/knees), and putting **model-identity heads** on them. The replay
viewer roadmap S1→S4 is complete + archived (`docs/archive/replay-viewer-*`); this is a new
arc on top of it. Feeds `story-splitting` → `planning` → TDD, **PR per slice**.

## The problem (why we're doing this)

Two spectator complaints about the shipped viewer:

1. **They don't look like they're fighting.** The figures are drawn at a fixed pixel size
   (~76px tall) but positioned in a world scaled to the viewport. In world terms a fighter is
   ~14k sub-units wide while a mid punch's contact gap is ~240k — so a fighter fights across
   **~17 body-widths of empty space**, and the drawn arm (40px) stops far short of the
   opponent. Strikes visibly hit the air.
2. **The limbs are stiff.** The `Skeleton` has 7 joints and strokes `shoulder→hand` /
   `hip→foot` as single straight segments — no elbows, no knees.

The fix ships behind a permanent **debugging/tuning showcase** (`/dojo`) so every move can be
tuned by eye against the real render pipeline.

## Resolved decisions

| #   | Decision | Choice | Rationale |
| --- | -------- | ------ | --------- |
| 1 | **Showcase nature** | A **permanent dark route** `/dojo` — no nav link, shipped like `/watch`. Full TDD: exact-assertion browser tests + a manual mutator scan (`web/` is not Stryker-reachable). | A reproducible tuning harness that never rots; retune any time a move changes. Consistent with how `/watch` shipped dark. |
| 2 | **Showcase interaction** | A **two-figure live sandbox**: challenger + king rendered together; per-figure controls (posture, action, band, facing, brand, reach) + a world-gap slider. Drives the **real `scene()`/`createStage` pipeline** via a hand-built synthetic tape. | One surface that covers articulation (study one figure), spacing (adjust the gap, fire a strike, see it connect), and heads (set each side's brand). "What you tune is what ships" — no divergence from production rendering. |
| 3 | **Body scale** | **Big fighters, scaled to world.** Define the body in world sub-units (scaled by the same `pxPerSubunit` that positions it), sized so an extended strike ≈ the engine's reach. Two fighters nearly fill the ring at contact. | Unifies body + reach + head into one scale; contact reads true at any viewport. A deliberate aesthetic shift away from tiny stickmen toward a fighting-game frame. |
| 4 | **Strike targeting** | The striking limb **aims at the opponent's real position, clamped to the move's true reach.** In range → the limb lands; beyond → it stops short as a true whiff. Requires an additive **`attackReach`** field on `RenderFrame` (sub-units, `0` when idle, sourced from the committed move's `spec.reach`), mirrored into the web `ReplayFrame` contract. | The gap between fighters varies every tick, so a fixed-length arm only "touches" at one distance. Aiming at the real position (truthful in the tape) makes contact and whiff both read faithfully for **every** move. `attackReach` is a render-only field — same invariant-safe pattern as `guardBand` in S2. |
| 5 | **Articulation** | **Derived bends + IK.** Grow the skeleton to ~11 joints (add `elbow L/R`, `knee L/R`); limbs become `shoulder→elbow→hand` / `hip→knee→foot`. Joints are **derived** from endpoints + a facing-aware bend rule (elbows bow back, knees forward); the **striking limb 2-bone-solves** toward the opponent, clamped to `attackReach`. Per-move authored overrides are the end-state design but **deferred** (see below). | Kills stiffness everywhere for cheap (derived), and the IK solve is what makes reach-to-target look natural. Investing hand-tuning only where it reads. |
| 6 | **Heads** | **Model-identity heads from a shared glyph source → Pixi `svg()`.** Refactor `BrandMark` to a shared SVG-path source consumed by both the DOM champion cards and the Pixi head (via Pixi v8 `Graphics.svg()`). Resolve brand **once per fighter at figure creation** via the shared `modelToBrand`. The head **counter-flips** so the mark is never mirrored when a fighter faces left. **Body/limbs keep the side color** (challenger-teal / king-amber); the **head carries the brand**. A `brand` data hook on the head node for exact-assertion tests. | Reuses the five existing, tested brand marks (`claude`/`openai`/`gemini`/`grok`/`generic`) and the tested `modelToBrand` mapping — no new design, no drift. "Which side" and "which model" are both legible. |

## Resolved mechanics (find-gaps, 2026-07-18)

Decisions that tighten the table above into something implementable without re-asking.

- **M1 — Reach reference frame (where the fist lands).** `attackReach` is the engine's
  **center-to-center** contact distance. The drawn limb is **shoulder-anchored**, so the
  viewer maps engine reach → a screen target by aiming the striking hand/foot at the
  **opponent's near body edge** (their root x offset toward the striker by their body
  half-width), never their center — the fist lands *on* the opponent's surface, not inside
  their torso. The limb's full extension is still bounded by `attackReach × pxPerSubunit`
  (measured from the shoulder, after subtracting the striker's own shoulder-to-center
  offset), so a real whiff (opponent beyond reach) draws as a limb stopping short of the
  surface. Both fighters' body half-widths come from the shared world-scaled body model
  (decision 3), so the mapping self-corrects when a stance (crouch) or scale changes.

- **M2 — Body sizing & strike reach.** The fighter's world size is **one tunable height
  constant** (sub-units; initial guess ≈ a reference mid-punch reach ~240k), with every other
  body dimension (limb segment lengths, body half-width, head size) **derived as a proportion
  of that height** (human-ish ratios) — a single knob, refined by eye in `/dojo`. A resting
  limb is at natural (bent) proportion; because engine reach exceeds a resting arm at this
  scale, a strike bridges the gap by **lean + telescope**: shift the shoulder / upper body
  forward a **capped** amount toward the target (a committed lunge) AND extend the limb for
  the remainder. The forward lean is a **viewer-only cosmetic** stylization — the fighter's
  **root x stays truthful** (the engine position from the tape); only the upper body leans.
  Both the lean cap and the max telescope are `/dojo`-tuned constants.

- **M3 — Degenerate targeting (TOTAL, like the posture/band fallbacks).** The strike
  **direction is always the fighter's facing**. The reach distance is the *in-front* distance
  to the opponent's near edge, **clamped to `[FLOOR, attackReach]`** where `FLOOR` is a
  minimum forward extension (a point-blank strike). If the opponent is overlapping (gap ≈ 0)
  or on the side opposite the facing, the limb shows the minimal forward technique — it
  **never reaches backward** and never produces a NaN direction. This keeps the strike a pure,
  deterministic function of the frame (scrub-safe; see M-purity below).

- **M4 — Joint coverage (TOTAL).** The skeleton grows to ~11 joints (`elbow L/R`,
  `knee L/R`). `STAND`/`CROUCH`/`AIR` derive their mid-joints from endpoints + the upright
  facing-aware bend rule (elbows bow back, knees forward) — no new authored constants. The
  strike/guard/throw override layers set the **hand/foot endpoint** and the mid-joint
  **re-derives** (the 2-bone IK solve of M1–M3). `PRONE` — already a fully-authored full-body
  early-return override — **explicitly authors all 11 joints** (a downed body reshapes
  everything; the upright bend rule doesn't apply). Any out-of-range posture still falls back
  to `STAND` (existing TOTAL behavior), now with derived mid-joints.
- **M-purity — Deterministic, scrub-safe rendering.** All new pose maths (the IK solve, the
  lean, the bend rule, the body-scale projection) are **pure functions of the current frame**
  (positions + `attackReach` + facing + posture/action fields) with **no cross-frame state** —
  exactly like the existing `scene()` / `scoredWithin`. Identical on replay, forward scrub,
  backward scrub, and restart. (The deferred chamber→snap animation would need timeline state;
  the derived base explicitly does not, which is why it stays scrub-safe.)

- **M8 — Throws join reach-to-target.** `attackReach` is "the reach of **whatever action is
  committed**" — a strike's `spec.reach` **or** a throw's `throw.reach` (~120k) — not
  strikes-only. When `throwing`, **both** grab hands reach-to-target toward the opponent's near
  edge (M1–M3), so the grab lands instead of grabbing air. One targeting path for every
  committed action. (Engine slice note: emit `attackReach` for the throw branch too, not just
  the moves-table branch.)

- **M9 — Acceptance / definition of done (per slice).** (1) Exact-assertion browser tests on
  **all pure maths + wiring** (body-scale projection, IK solve, lean, bend derivation, brand
  resolution, pose fields) + a **manual mutator scan** (`web/` is not Stryker-reachable). (2) A
  per-slice **manual visual sign-off in `/dojo`** against a documented pose checklist — `/dojo`
  *is* the curated visual-check surface. (3) **Explicitly NOT** automated pixel/visual
  regression: agent-browser hangs on the Pixi canvas page, so screenshot diffing is out — the
  scene-graph assertions + manual scan are the guardrail (consistent with S1–S2). The engine
  `attackReach` slice keeps the **byte-identical replay** check (additive render field).

- **M10 — `/dojo` control surface.** The world-gap slider is in sub-units with **labeled snap
  points at the real engine reaches** (empi 95k, throw 120k, sweep 180k, uraken 200k,
  kizami 210k, gyaku 240k, tobi 250k, shuto 260k, mae 270k, mawashi 300k, yoko 315k,
  ushiro 330k) + free drag between them — jump to a move's reach and verify the fist lands
  exactly where a real fight would. Per-figure controls (posture, action, band, facing, brand,
  `attackReach`) set frame fields **freely** — **no valid-combo constraint** — because
  `poseFor` is already TOTAL/precedence-safe and a debug tool must expose how every
  combination resolves (including ones the engine never emits). **Default first-load state**
  (proposal): two figures facing each other at **gyaku-zuki reach (240k)**, challenger
  mid-strike vs king idle, brands challenger `claude` / king `generic` — a state that
  immediately shows a strike landing. `/dojo` is **desktop-only** — no responsive/mobile
  investment (it's a tuning tool; see Nice-to-have).

- **M11 — Head form ("bare brand glyph").** _(REVISED 2026-07-18 — the "brand coin" disc is
  dropped; see note below.)_ The head is the **brand glyph alone, no disc** — rendered in the
  brand's signature hue, exactly as the home-page hero draws its three logo-headed stickmen
  (`Hero.tsx` places a bare `<BrandMark>` as each fighter's head, no circle). Without a disc the
  glyph can be drawn **larger and more defined**, and the viewer matches the header the site
  already ships. The **body and limbs keep the side color** (challenger-teal / king-amber); the
  head carries the brand — the decision-6 split still holds (the glyph's own hue is the brand
  signal; the body colour stays the challenger/king signal, unlike the hero where the body is
  brand-tinted). **Grok** is monochrome — its glyph inks to a **near-white** ring + slash on the
  dark canvas (its `currentColor` identity, made **explicit** for Pixi since the canvas has no
  CSS `currentColor`); no disc. **Head size** (proposal): ≈ **0.3× body height**, derived from
  the M2 height knob so it scales with the fighter (story 3 / world-scale); for the identity-only
  story-2 pass, size the glyph to read clearly (noticeably larger than the old ~24px circle),
  tuned by eye in `/dojo`. The head **counter-flips** (decision 6) so the glyph is never mirrored
  when facing left.

  _Why the coin was dropped (decision-owner, 2026-07-18):_ the disc-plus-contrast-glyph "coin"
  was a Pixi-only embellishment (the DOM marks never had one). A bare glyph looks better, reads
  bigger/crisper, and keeps the viewer consistent with the hero's logo-heads. This **simplifies**
  the head render: no disc `Graphics`, no contrast-knockout colour rule (the M11-original "glyph
  must not match its disc or it vanishes" concern is now moot) — the glyph renders in its own
  brand hue, and only Grok needs an explicit canvas ink.
- **M12 — Vertical fit (tuning note).** Big fighters (~480px at the initial height guess) plus
  jump displacement could clip the top of the 1200×600 canvas. This is an **outcome of the M2
  height knob**, resolved by eye in `/dojo`: if extreme jumps clip, lower the height constant
  or add canvas headroom. Not a blocker — brief and rare, and the knob controls it.

## Engineering defaults (recorded, confirm at planning)

- **M5 — Pixi `svg()` confirmed.** `pixi.js@^8.19.0` (root `package.json`) — Pixi v8's
  `Graphics.svg()` parses SVG path data, so the shared-glyph-source head (decision 6) is
  viable. **Fallback:** if any single glyph's path doesn't render cleanly through `svg()`,
  re-author **that one glyph** as Pixi primitive calls while the others stay shared — a
  per-glyph escape hatch, not a mechanism change.
- **M6 — `BrandMark` refactor is behavior-preserving for the DOM.** Extracting the glyph
  geometry to a shared source must leave the DOM `BrandMark` output **identical** — the
  existing `BrandMark` / `ModelLogo` champion-card tests stay green unchanged (the refactor is
  a pure extraction, verified by the existing suite before the Pixi head consumes the source).
- **M7 — Viewer treats `attackReach` defensively.** The web `ReplayFrame` mirror gains
  `attackReach`. Replays are reconstructed (re-run sim) so the field is always present, but the
  fetch layer still defends the wire: absent / non-numeric / negative → `0` (⇒ no reach ⇒ the
  limb keeps its stance/natural pose, the idle fallback). A very large value is harmless — M3
  clamps the drawn reach to the actual in-front distance regardless.

## Slice order (harness-first)

Each is its own PR-sized slice (or slices); each leaves a working, improved state.

1. **`attackReach` engine field** — additive `RenderFrame` field; byte-identical outcome path; mirror into the web contract. The contract is ready before reach-to-target consumes it.
2. **`/dojo` showcase** — the harness; renders the *current* model via a synthetic tape so it stays valid as the pose model evolves.
3. **Model-identity heads** — shared glyph source + Pixi head; preview all five brands in the sandbox.
4. **World-scale calibration** — big fighters, body in sub-units.
5. **Articulation** — elbows/knees derived + IK reach-to-target (consumes `attackReach`).

## Non-negotiable invariants held

- **Determinism / TCB / bounded DSL untouched.** The *only* `src/` change is the additive
  `attackReach` render field (the render tape, **not** the outcome path); it sources from the
  committed move's already-resolved `spec.reach`. No DSL op, no allowlist change, absent-field
  byte-identical. Everything else lives in `web/`.
- **`web/src` never imports `src/`.** The `attackReach` field is mirrored into the web
  `ReplayFrame` view-model exactly as the rest of the tape contract is.

## Explicitly deferred (named follow-on)

Decided later, with real eyes in `/dojo`:

- **Per-move signature silhouettes** (a `mawashi-geri` chamber, a `hikite` pull) — would need
  a `move` id on the render frame so the viewer can key overrides to the exact move.
- **Chamber → snap → recover strike animation** — would additionally need move **phase /
  progress** on the frame (today `attacking` is a flat boolean across startup→active→recovery).
- These are the "hybrid: derived + authored overrides" end-state from decision 5; the current
  arc ships the derived base only.

## Gaps closed — find-gaps session, 2026-07-18

Resolved (13):

```
[Blocker → M1]   Reach reference frame — fist lands on opponent's near body edge
[Blocker → M2]   Body sizing (one height knob) + lean+telescope strike, root x truthful
[Blocker → M3]   Degenerate targeting — clamp to a forward floor, direction = facing
[Blocker → M4]   Joint coverage — derive; PRONE authors its own 11 joints
[Should  → M5]   Pixi svg() confirmed (8.19) + per-glyph fallback
[Should  → M6]   BrandMark refactor is DOM-behavior-preserving
[Should  → M7]   Viewer treats attackReach defensively (absent/neg → 0)
[Should  → M8]   Throws join reach-to-target (attackReach = any committed action's reach)
[Should  → M9]   Acceptance/DoD — exact-assertion + manual scan + /dojo sign-off; no pixel regression
[Should  → M10]  /dojo controls — reach-preset gap slider, free combos, default state, desktop-only
[Should  → M11]  Head form — brand-hued "coin" (Grok mono), body keeps side color, 0.3× height
[Should  → M-purity] Deterministic scrub-safe rendering (no cross-frame state)
[Nice    → M12]  Vertical fit is an M2-height-knob tuning outcome (not a blocker)
```

Parked (1):

```
[Nice] attackReach slice bundling (own PR vs bundled with articulation) — owner: story-splitting
```
