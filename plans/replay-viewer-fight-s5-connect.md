# Plan: Replay viewer "make it fight" — Story 5, strikes & grabs connect

**Branch (Slice 2b)**: `feat/fight-s5-lean-slider` — PR-per-slice; each slice takes its own `feat/fight-s5-*` branch.
**Status**: Active — **Slice 1 ✅ MERGED (#344)**, **Slice 2a ✅ MERGED (#345)**, **Slice 2b ✅ IMPLEMENTED (M2 lean + M10 `/dojo` reach slider — pending commit + PR)**; **Slice 3 next** (throw reach) closes the arc 5/5.

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

- [x] The reconstructed render tape / served `GET /replay/{id}` JSON carries a per-frame
      `attackReach` (sub-units): a strike frame = the committed move's `spec.reach`; a throw frame =
      `rules.throw.reach`; an idle/neutral/downed frame = `0`. _(Slice 1, #344)_
- [x] Adding the field is **outcome-invariant**: `runFight().events`, the fight result/`endReason`,
      `INPUT_HASH`, and every `replayId` are unchanged (the field lives only on `RenderFrame`, which
      `renderTape` derives on demand — it is not part of the event tape or the `ReproRecord` hash).
      _(Slice 1, #344 — full determinism/byte-identity suite stayed green; Stryker on `renderFrameOf`
      93.33%, 1 documented-equivalent survivor)_
- [x] In the viewer, a strike within reach draws its hand **on the opponent's near body edge**; a
      strike beyond `attackReach` draws the limb **stopping short** (a real whiff reads as a whiff).
      _(Slice 2a, #345)_
- [x] A degenerate target (gap ≈ 0, or opponent on the side opposite the facing) draws the **minimal
      forward technique** — never a backward limb, never a NaN. _(Slice 2a, #345)_
- [ ] A `throwing` frame reaches **both** grab hands to the near edge using `attackReach`
      (= `throw.reach`). _(Slice 3)_
- [x] The viewer treats `attackReach` **defensively at consumption** (absent / non-numeric /
      negative → `0` ⇒ the limb keeps its stance pose). _(Slice 2a, #345)_
- [x] Every new pose math is a **pure function of the current frame** — identical on replay, forward
      scrub, backward scrub, restart (M-purity). _(Slice 2a, #345 — strike reach; Slice 3 reuses the
      pure machinery for throws)_
- [x] `/dojo` can set each figure's `attackReach` freely and its gap slider snaps to the real engine
      reaches, so every move's contact can be signed off by eye (M9 · M10). _(gap-snap presets since
      S1; the per-figure `attackReach` slider added in Slice 2b — the M9 visual sign-off is the human
      step)_

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

### Slice 1: The render tape carries each fighter's committed reach (`attackReach`) — ✅ COMPLETE (#344)

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

### Slice 2a: A strike's hand lands on the opponent's near edge (and whiffs stop short) — ✅ COMPLETE (#345)

**Sub-split (the tests showed the seam):** the core reach-to-target — in-range landing, whiff cap,
degenerate floor, direction=facing, the web `ReplayFrame` mirror + M7 fallback, and the dojo default
landing — **was Slice 2a (#345)**. The **M2 lean** (a capped forward shoulder shift so the reach
reads as a lunge, not a stretched arm) and the **M10 per-figure `attackReach` slider** on `/dojo`
ride **Slice 2b (next)** — both are tuning/polish over the landing core, and keeping them separate
holds each PR reviewable. Elbow re-derive came free from Story 4 (`deriveSkeleton`).

**Value**: The payoff that sells "fighting" — an in-range strike visibly connects; a real whiff reads
as a whiff. First slice the spectator sees change.
**Path**: `scene.ts` `strikeHandFor(striker, opponent)` solves the striking front hand toward the
opponent's near body edge (`facing·(opp.x − self.x)·SUBUNIT_TO_LOCAL − BODY_HALF_WIDTH`), clamped to
`[min(FLOOR, cap), cap]` with `cap = attackReach·SUBUNIT_TO_LOCAL`; the pre-solved joint is threaded
into `poseFor`; Story 4's `deriveSkeleton` re-bends the elbow for free → `figures.ts` strokes it →
`/watch` + `/dojo`.
**Class**: Behavior change (`web/` only — no `src/`).
**Delivered**: `ReplayFrame` gained `attackReach?: number`; `scene.ts` reads it with the **M7 gate**
(`typeof reach !== "number" || !(reach > 0)` → stance, NaN-safe); `dojo-tape.ts`/`controls.ts` set it
on the synthetic frames (challenger 240k lands, king 0 idle); the viewport-independent ratio
`SUBUNIT_TO_LOCAL = 76/240000` keeps the solve in local px. RED (12 tests) → GREEN (2037 pass) →
manual mutator scan (added `facing:-1`, `attackReach===0` boundary, NaN killers; consolidated the
redundant reach gate) → REFACTOR. **The M10 `/dojo` `attackReach` slider was carried to Slice 2b.**

### Slice 2b: A strike leans into its reach, and `/dojo` can dial each fighter's `attackReach` (M2 · M10) — ✅ IMPLEMENTED (pending commit + PR)

**Value**: Two finishing touches on the landing core. **M2 lean** — a long reach currently reads as a
single over-stretched arm; a small, capped forward shift of the striking shoulder (root x untouched,
so world position stays truthful) makes the same reach read as a _lunge into the technique_. **M10
slider** — `/dojo` gets a per-figure `attackReach` control so every move's contact (short jab →
long thrust kick) can be dialled and signed off by eye, not just the two defaults 2a baked in.
**Path**: `scene.ts` — after `strikeHandFor` picks the hand target, shift the striking shoulder (and
only the shoulder) forward by a capped fraction of the reached distance so the arm isn't the sole
source of extension; `deriveSkeleton` re-bends the elbow from the new shoulder for free. Root x and
every other joint stay put (M2: "root x truthful"). `/dojo`: `FigureControlPanel.tsx` gains an
`attackReach` range input wired through `DojoApp` state into `controlsToFrame` (the data field already
flows since 2a); a11y label via aria-labelledby-from-span, matching the existing band/posture controls.
**Class**: Behavior change (`web/` only — no `src/`).
**Required implementation skills**: `tdd`, `testing`, `front-end-testing`, `refactoring`;
`mutation-testing` = manual scan (`web/` not Stryker-reachable) per M9.
**Acceptance criteria** (present for approval before code):

- **M2 lean**: an in-range strike shifts the **upper body** (head + shoulder) forward by a **capped**
  amount (a longer reach → a larger, still-capped lean; the cap holds the plateau); an
  idle/guard/downed frame → **no** shift. The **lower body (hip + both feet) stays planted** and the
  **rear hand keeps its endpoint** — only the shared `shoulder` anchor leans, so the derived elbows
  re-bend from it (M2: "only the upper body leans"). The fighter's **root x is untouched** (world
  position stays truthful). Fixed local +x (facing carried by the flip); pure function of the frame.
- **M10 slider**: `/dojo` renders a per-figure `attackReach` control; dragging it changes that
  figure's committed reach so the strike lands at short vs long gaps (a dialled-down reach whiffs at a
  gap 2a's default would land); the control has an accessible name; the King's control defaults to `0`.

**Delivered**: `scene.ts` — a `strikeLean(handX) = min(CAP 16, handX × RATIO 0.5)` helper; `poseFor`
shifts `head.x` + `shoulder.x` forward by the lean only when a strike is drawn (same gate as the
reach), so `deriveSkeleton` re-bends both elbows from the leaned shoulder for free; lower body + rear
hand endpoint + root x all untouched. `FigureControlPanel.tsx` — an `attackReach` range input
(`[MIN_GAP, MAX_GAP]`, step 1k, aria-labelledby-from-span, `k` read-out) patching the figure's
`FigureControls` signal (the data field already flowed since 2a; no `DojoApp`/`controls.ts` change).
Tested through `DojoApp.test.tsx` (the panel has no separate test file). RED (7 lean + 2 slider drive
tests) → GREEN (2047 pass) → updated 2 elbow-strike expectations to the leaned shoulder `{16,-64}` +
scoped the gap read-out to its group (the reach read-out now also shows a `k`) → manual mutator scan
(min↔max, cap/ratio retune, ±lean, drop-head/shoulder lean, facing-sign, root-x, wrong patch field,
`Number()` drop — all killed; added a facing-local lean test, a root-x-truthful test, and per-figure
read-out pins) → REFACTOR `N/A` (the 2-line lean spread is inline-clear). **`/dojo` visual sign-off
(M9) is the human step.**
**Done when**: ACs met, manual scan done, `/dojo` sign-off, checks green, human approves.

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
