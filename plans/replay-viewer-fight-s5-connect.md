# Plan: Replay viewer "make it fight" — Story 5, strikes & grabs connect

**Branch (Slice 1)**: `feat/fight-s5-attackreach` — PR-per-slice; later slices take their own `feat/fight-s5-*` branches.
**Status**: Active

Last (and only `src/`-touching) story of the "make it fight" arc. Design is fully
resolved — `plans/replay-viewer-fight-decisions.md` decision 4 + M1–M12 + M-purity + the
Non-negotiable-invariants section. The `attackReach` determinism/TCB grill is closed; the one
parked decision (slice bundling) was resolved **standalone field first** (2026-07-18). Closes
the arc **5/5**.

## Goal

A committed strike or grab **lands on the opponent when in range and stops short when it whiffs** —
the striking limb 2-bone-solves toward the opponent's near edge, clamped to the move's true reach,
driven by a new additive `attackReach` render field.

## Acceptance Criteria

Story-level, behavior-driven (from the decisions doc "Acceptance examples · 5" + the invariants):

- [ ] The reconstructed render tape / served `GET /replay/{id}` JSON carries a per-frame
      `attackReach` (sub-units): a strike frame = the committed move's `spec.reach`; a throw frame =
      `rules.throw.reach`; an idle/neutral/downed frame = `0`.
- [ ] Adding the field is **outcome-invariant**: `runFight().events`, the fight result/`endReason`,
      `INPUT_HASH`, and every `replayId` are unchanged (the field lives only on `RenderFrame`, which
      `renderTape` derives on demand — it is not part of the event tape or the `ReproRecord` hash).
- [ ] In the viewer, a strike within reach draws its hand **on the opponent's near body edge**; a
      strike beyond `attackReach` draws the limb **stopping short** (a real whiff reads as a whiff).
- [ ] A degenerate target (gap ≈ 0, or opponent on the side opposite the facing) draws the **minimal
      forward technique** — never a backward limb, never a NaN.
- [ ] A `throwing` frame reaches **both** grab hands to the near edge using `attackReach`
      (= `throw.reach`).
- [ ] The viewer treats `attackReach` **defensively at consumption** (absent / non-numeric /
      negative → `0` ⇒ the limb keeps its stance pose).
- [ ] Every new pose math is a **pure function of the current frame** — identical on replay, forward
      scrub, backward scrub, restart (M-purity).
- [ ] `/dojo` can set each figure's `attackReach` freely and its gap slider snaps to the real engine
      reaches, so every move's contact can be signed off by eye (M9 · M10).

## Scope deviation from the story-split (needs approval)

The split (decision 4 / M7) assumed Slice 1 would also add the **web `ReplayFrame` mirror + a
defensive fallback in the fetch layer**. The code says otherwise, so this plan relocates that:

- `web/src/pages/replay/replay-loader.ts` **casts the wire wholesale** (`response.json() as
ReplayItem`) — there is **no per-field coercion for any field** (guardBand, posture, … are all
  trusted and defended later, at consumption in `scene.ts`). Adding a bespoke loader coercion for
  `attackReach` alone would break that consistent pattern.
- A wholesale cast to a _narrower_ `ReplayFrame` type ignores extra wire fields, so **Slice 1 needs
  no web change at all** — the served JSON simply gains a field the current viewer ignores. The web
  `ReplayFrame` field and the **M7 defensive `?? 0` fallback land in Slice 2, next to their first
  reader** (`scene.ts`), where the fallback is actually testable and where `/dojo`'s frame builders
  must set the field anyway.

Net: Slice 1 is a **pure, byte-identical `src/` slice** (no `web/` churn); the web contract mirror +
M7 defensiveness ride with the IK that consumes them. This preserves the "standalone field first,
no visual change, engine/TCB isolated for its own review" intent exactly.

## Slices

Read `.claude/CLAUDE.md` + the design trail before each slice. `web/` is **not Stryker-reachable** →
exact-assertion browser tests + a **manual mutator scan** + a `/dojo` visual sign-off (M9) stand in
for mutation; the engine slice **is** Stryker-reachable → real mutation testing.

### Slice 1: The render tape carries each fighter's committed reach (`attackReach`)

**Value**: A `/replay` client (and, next, the viewer's IK) can read how far the committed action
reaches — a strike's `spec.reach`, a throw's `throw.reach`, `0` when idle — without re-deriving it.
The one `src/`/TCB touch of the arc, isolated for its own review + the byte-identical check.
**Path**: `renderTape` → `renderFrameOf(f, action, rules)` computes `attackReach` from the committed
`f.state` → `handleReplay` serializes the tape wholesale → served `GET /replay/{id}` JSON. Observable
in the reconstructed tape and the API response.
**Class**: Behavior change (`src/engine/sim.ts` only).
**Required implementation skills**: `tdd`, `testing`, `mutation-testing` (real Stryker — engine is
reachable), `refactoring` (assess; likely `N/A` — the change mirrors the existing `attackBand`/
`throwing` lines).
**Reduction program**: `N/A`.
**Acceptance criteria** (present for approval before code):

- `attackReach: number` is added to `RenderFrame` (and `renderFrameOf` sets it on every frame):
  - `f.state.kind === "attacking" || "air-attacking"` → `f.state.spec.reach`.
  - `f.state.kind === "throwing"` → `rules.throw?.reach ?? 0`.
  - otherwise (neutral / airborne / downed) → `0`.
- The value is read from the **committed state** (`f.state.spec`), not the live `action` — so a
  strike's active/recovery frames (bot may return idle) still report the move's reach, exactly as
  `attackBand` reads `f.state.band`.
- **Outcome-invariant**: existing `runFight` determinism/byte-identity tests stay green unchanged;
  `INPUT_HASH` and `replayId` fixtures are unaffected. Only `renderTape`/frame-shape assertions gain
  the field.
  **RED**: a new `sim`/`renderTape` test — build a fight (or synthetic fighters) that reaches an
  `attacking` frame, an `air-attacking` frame, a `throwing` frame, and an idle frame, and assert each
  frame's `attackReach` equals `spec.reach` / `throw.reach` / `0`. Fails: field absent.
  **GREEN**: add the field to the type + the one `renderFrameOf` constructor.
  **MUTATE**: run Stryker on `sim.ts` scoped to `renderFrameOf`; kill survivors on the branch selection
  (strike vs throw vs idle) and the `?? 0` throw guard. A boundary test for `throwing` with
  `rules.throw` present vs absent kills the `?? 0` mutant.
  **KILL MUTANTS**: strengthen the state-branch tests as needed.
  **REFACTOR**: assess — expected `N/A` (single expression, mirrors neighbours).
  **Done when**: ACs met, mutation report clean, `npm test` + 3-project `typecheck` + lint green, human
  approves the commit.

### Slice 2: A strike's hand lands on the opponent's near edge (and whiffs stop short)

**Value**: The payoff that sells "fighting" — an in-range strike visibly connects; a real whiff reads
as a whiff. First slice the spectator sees change.
**Path**: `scene.ts` `poseFor`/strike layer consumes the frame's `attackReach` → 2-bone IK solves the
striking arm (elbow from Story 4's `deriveBend`) so the hand reaches the opponent's near body edge,
clamped to `[FLOOR, attackReach × pxPerSubunit]`, direction = facing, degenerate → forward floor;
lean+telescope (M2) bridges the scale gap with root x truthful → `figures.ts` strokes it → `/watch`

- `/dojo`.
  **Class**: Behavior change (`web/` only — no `src/`).
  **Required implementation skills**: `tdd`, `testing`, `front-end-testing`, `refactoring`;
  `mutation-testing` = manual scan (`web/` not Stryker-reachable) per M9.
  **Includes** (the relocated web contract work): `ReplayFrame` gains `attackReach?: number`;
  `scene.ts` reads it with the **M7 fallback** (`attackReach ?? 0`, non-numeric/negative → `0`);
  `dojo-tape.ts` sets it on its synthetic frames; a per-figure `attackReach` control on `/dojo` (M10);
  the gap slider's reach snap-presets already exist (S1) — verify they line up with contact.
  **Acceptance criteria** (present for approval before code): in range → hand on near edge; beyond
  reach → limb stops short at the cap; gap ≈ 0 / opponent behind facing → minimal forward floor, never
  backward, never NaN; `attackReach` absent/negative → stance pose (M7); scrub forward/back → identical
  joints (M-purity).
  **RED**: exact-assertion `scene.test.tsx` cases (in-range hand x = near-edge target; out-of-range
  hand x = shoulder + cap; degenerate = forward floor; absent → stance) recomputed independently per
  the mutation-safe pattern.
  **GREEN / MUTATE / KILL / REFACTOR**: minimum IK math; manual mutator scan; `/dojo` visual sign-off.
  **Done when**: ACs met, manual scan done, `/dojo` sign-off, checks green, human approves.
  **Note**: this is the largest slice — if it grows past one reviewable PR during TDD, sub-split as
  2a (in-range land + elbow re-derive), 2b (clamp/whiff + degenerate floor), 2c (lean+telescope). Do
  not pre-split; let the tests show the seam.

### Slice 3: A throw reaches both grab hands to the opponent (M8)

**Value**: A grab lands on the opponent instead of grabbing air — one targeting path for every
committed action.
**Path**: `scene.ts` throw layer — when `throwing`, **both** grab hands reach-to-target toward the
near edge using the frame's `attackReach` (= `throw.reach`), reusing Slice 2's clamp/degenerate/
purity machinery → `figures.ts` → `/watch` + `/dojo`.
**Class**: Behavior change (`web/` only).
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`, `refactoring`;
`mutation-testing` = manual scan (M9).
**Acceptance criteria** (present for approval before code): `throwing` frame with `attackReach` in
range → both grab hands on the near edge; beyond reach → both stop short; degenerate → forward floor;
scrub-safe.
**RED / GREEN / MUTATE / KILL / REFACTOR**: exact-assertion `scene.test.tsx`/`figures.test.tsx`;
manual scan; `/dojo` sign-off.
**Done when**: ACs met, manual scan, `/dojo` sign-off, checks green, human approves. **Closes the
arc 5/5** → archive the plan (archive-don't-delete) + update `plans/replay-viewer-fight-stories.md`,
the arc memory, and `docs/archive/README.md`.

## Explicitly deferred (named follow-on — decisions doc)

- **Per-move signature silhouettes** (needs a `move` id on the render frame).
- **Chamber → snap → recover strike animation** (needs move phase/progress on the frame; would add
  timeline state, which is why the derived base stays scrub-safe).

## Pre-PR Quality Gate (each slice)

1. Slice 1: Stryker on the touched engine code + report. Slices 2–3: manual mutator scan (documented)
   — `web/` is not Stryker-reachable.
2. Refactoring assessment (`refactoring`) — record `N/A` when nothing adds value.
3. `npm test` + `npm run typecheck` (root + `tsconfig.api.json` + `web/tsconfig.json`) + `npm run
lint` + `npx prettier --check` all green.
4. Slices 2–3: `/dojo` visual sign-off against the pose checklist (M9); **no** pixel/visual
   regression (agent-browser hangs on the Pixi page).

---

_Archive under `docs/archive/` when complete (arc convention: archive, don't delete). Delete from
`plans/` only after archiving._
