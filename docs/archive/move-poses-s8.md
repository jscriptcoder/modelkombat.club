# Plan: S8 — a technique flows instead of snapping between three held poses (easing)

**Branch**: move-poses-s8-easing
**Status**: ✅ Complete — shipped #377 (`8f5a761`); archived 2026-07-20 in the arc closeout (the arc's final story)

Split from `plans/move-poses-stories.md` (S8) via `planning` (2026-07-20), after `grill-me` settled the
four load-bearing decisions into `plans/move-poses-decisions.md` **M14** and a reconnaissance of the
`scene.ts` `poseFor` seam. Feeds TDD. The slice loads `tdd`, `testing`, `front-end-testing` before code
changes and completes RED → GREEN → (Stryker `N/A` for `web/` ⇒ manual mutator scan) → refactor assessment.

## Goal

The driven endpoint of a committed technique — and everything derived from it — **travels** between the
phase keyframes instead of teleporting: `stance → chamber → extension → chamber → stance`, eased. A
gyaku-zuki visibly winds up, snaps out to contact, and re-chambers, on **`/watch`** and **`/dojo`** alike,
authoring nothing new. This closes the S2 eye-check's carried gap between "the phases are correct" and
"this reads as a movement" — the arc's **final** story.

## Why now

Every prior slice authored the RIGHT endpoints (S1–S6) and then verified they read distinctly (S7). S8
was deliberately sequenced last (`plans/move-poses-stories.md:101`): easing between endpoints is only
worth building once the endpoints are the ones worth easing, and doing it earlier means re-judging every
curve as each descriptor lands. It is also the one story that changes how **`/watch`** looks without
authoring anything new — the keyframes are the very shapes S1–S7 already authored.

## Settled design decisions — see `move-poses-decisions.md` M14 (grilled 2026-07-20)

| #   | Decision                  | Choice                                                                                                                                                                                                                            | Why (full rationale in M14)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a   | **Progress source**       | **Derived in the web layer** — `scene()` run-length-scans the tape around the playhead (contiguous same-`attackMove`, monotonic `attackPhase`) for tick-within-move                                                               | No engine/contract field; `BENCHMARK_VERSION` stays `v19`; `scene()` already scans the tape (`scoredWithin`), so this is the file's idiom. Pure ⇒ replay-safe. The parked `attackProgress` contract field stays parked.                                                                                                                                                                                                                                                                                                    |
| b   | **Easing curve**          | **One shared smoothstep** `t·t·(3−2t)`, a single swappable pure fn on every segment, eye-tuned in `/dojo`                                                                                                                         | The AC is curve-agnostic ("moved between ticks" + "boundary is authored"), so this is an eye question (decision 9). Symmetric; one-line pure fn; a swappable seam so per-segment _kime_ curves can follow.                                                                                                                                                                                                                                                                                                                 |
| c   | **Keyframe anchoring**    | **Five keyframes** `stance → chamber → extension → chamber → stance`; the solved extension lands on the **first active tick** (a _kime_ commit as the contact window opens), easing back to the chamber across the rest of active | Every interior tick moves — including within the active phase (extension→chamber) — which satisfies "endpoint moved between consecutive ticks within one phase"; boundary ticks stay authored; the extension is the reach-to-target solve, so contact is not shifted. **Revised during TDD from an earlier mid-run PEAK sketch** — the S7 contact sheet + S2 dojo default render each move at its first active tick and require the extension there (see M14c).                                                            |
| d   | **Recovery path**         | **Reuse the chamber as the retract waypoint** — ease extension → chamber → stance; author NOTHING new                                                                                                                             | S8's premise. Re-chambering before setting down is correct karate form (esp. kicks); symmetric with the wind-up. A distinct recovery pose (13× authoring) and a direct extension→stance drop both rejected.                                                                                                                                                                                                                                                                                                                |
| e   | **WHERE the blend lives** | **Make `driven` a continuous keyframe blend, not a discrete phase pick** — everything downstream unchanged                                                                                                                        | The load-bearing insight: `poseFor` already flows lean, hip-step, girdle rotation, `deriveSkeleton` mid-joints, and the mid-joint write-back from the single `driven` point. So blending `driven` gives body-coherence AND the fixed-bone-length invariant (S2 · Slice 3) **for free** — `deriveSkeleton` re-solves each mid-joint at fixed length from the blended endpoints. Lerping the resolved skeleton joint-by-joint is **rejected** (a mid-joint would drift off its bone length mid-travel, reopening that scar). |
| f   | **Totality**              | **TOTAL** — a chamber-less move eases through its STANCE; an idle / unknown frame is byte-identical to today                                                                                                                      | M7. A single-keyframe span has nothing to blend ⇒ renders exactly as today; an unauthored move (stance≡chamber) still eases stance→extension→stance, so it still MOVES.                                                                                                                                                                                                                                                                                                                                                    |

## Non-negotiable constraints

- **`web/` only.** No `src/`, no engine, no TCB, no `BENCHMARK_VERSION` bump — render-only, as every
  slice since S1. **No `move-descriptors.ts` / `reach-presets.ts` / `Arsenal.tsx` change** — the chamber
  and extension the descriptor already authors ARE the keyframes.
- **The shipped output at the keyframe ticks must not change.** At each phase-boundary tick an authored
  move renders exactly as today (the solved extension on the first active tick — so the S7 contact sheet
  and dojo default are untouched); only the **interior** ticks are new. An idle / unknown / single-keyframe
  frame is byte-identical.
- **The fixed-bone-length invariant holds at EVERY tick, not just the boundaries.** The blend feeds
  `deriveSkeleton`, which re-solves mid-joints at fixed length — the guard against reopening the
  S2 · Slice 3 stretch scar. Asserted at an interior tick, not assumed.
- **`web/` is not under Stryker** (project memory). Mutation testing is `N/A`; substitute **exhaustive
  exact-assertion / relational tests + a MANDATORY manual mutator scan** against `mutation-testing`'s
  `resources/mutator-rules.md`, recorded in the PR (per [[public-page-web-ui]]).

## Acceptance Criteria

- [ ] For a committed technique, **consecutive ticks within one phase yield different driven-endpoint
      positions** (the limb travels — kills the frozen-hold today's code shows), including within the
      active phase
- [ ] At **each phase boundary tick** the driven endpoint is the **authored keyframe** — the chamber at
      the last startup tick and last active tick, the **solved reach-to-target extension on the first
      active tick** (easing must not shift where contact happens)
- [ ] The endpoint **advances** toward extension across the wind-up into contact and **retreats** back
      through the chamber to the stance across recovery (directional travel per segment)
- [ ] **Solve retained across easing:** two different opponent gaps still yield two different
      contact-tick x (M8.5 survives — contact is the live solve, not a frozen authored point)
- [ ] At an **interior** tick the driven limb's mid-joint sits at its **fixed bone length** from the
      endpoints (re-derived, not lerped), and the lean / girdle move **with** the endpoint (no torn torso)
- [ ] An **unauthored** move (no chamber) still eases **through its stance**; an **idle / unknown /
      single-keyframe** frame renders **byte-identical to today** (M7 totality)
- [ ] Easing is visible on **both** surfaces — `/dojo` (scrub the existing multi-tick transport) and
      `/watch` (the 5 moves ever thrown) — via the one `scene()` change
- [ ] Full suite green; `typecheck` + `lint` + `format:check` clean; `BENCHMARK_VERSION` unchanged at `v19`

## Slices

Read `.claude/CLAUDE.md` + testing rules before writing slices. **One vertical slice.** The progress
derivation and the keyframe blend are coupled — the deriver ships no observable value alone (pure
infrastructure), and a half-eased technique is not shippable — so they land together. The change is the
arc's largest single-file logic change but its narrowest blast radius: `scene.ts` (+ maybe one small pure
helper) and `scene.test.tsx`. No new page, no new authoring — `/dojo` already spans the full move duration
(M4) and `/watch` already carries per-tick `attackPhase`, so the one `scene()` change lights up both.

### Slice 1: A committed technique eases between its phase keyframes on `/watch` and `/dojo`

**Value**: Actor — the spectator at `/watch` (primary) and the developer tuning at `/dojo` (secondary).
Trigger — playing / scrubbing a committed technique. Observable outcome — the driven limb (and the torso
that leans with it) TRAVELS `stance → chamber → extension → chamber → stance` instead of snapping between
three held stills. The largest remaining "reads as a movement" gap, closed with zero authoring.
**Path**: `scene(tape, playhead, viewport)` → derive **tick-within-move + phase-segment boundaries** by
run-length-scanning the tape around the playhead (pure) → pass that progress into `poseFor` → `poseFor`
computes `driven` as a **smoothstep blend** along the five keyframes (stance from `stanceFor`, chamber
from `chamberFor`, extension from the passed `strikeHand`) instead of the discrete `isChamberPhase` pick
→ the existing lean / step / girdle / `deriveSkeleton` chain re-derives from the blended `driven`
unchanged. Observability — headless relational scene-graph assertions over synthetic tapes + the rendered
motion on both routes.
**Class**: Behavior change.
**Required implementation skills**: `tdd`, `testing`, `front-end-testing` (Vitest Browser Mode; synthetic
`ReplayTape` factories spanning a full move duration). `mutation-testing`: **N/A** — `web/` is outside
Stryker; proportionate alternate evidence = exhaustive relational scene-graph tests + a manual mutator
scan. `refactoring`: assess extracting the progress deriver + smoothstep into a small pure module, and
whether `isChamberPhase` survives only as a keyframe selector; the standing `strikeHandFor` / `driven`
rename (M13 consequence 2) may finally earn its keep now that "driven" is a blended point — assess, likely
defer.
**Reduction program**: N/A.
**Transition/terminal evidence**: N/A.
**Acceptance criteria**: the story ACs above. **Present to the human and get confirmation before writing
any code.**
**RED (failing behavior tests, in increment order):**

1. **Progress deriver (the seam / risk):** a pure helper computes tick-within-move + the phase-segment
   run lengths from a synthetic tape at a playhead by scanning contiguous same-`attackMove` frames; assert
   the segment + local position for a full gyaku-zuki span, AND that an **attack-instance boundary** — a
   `phase 3 → 1` drop, an `attackMove` change, or a `phase 0` gap — starts a NEW instance (two adjacent
   strikes do not blend into one).
2. **Motion within a phase (headline AC):** two consecutive startup ticks of a committed technique yield
   DIFFERENT driven-endpoint positions (RED against current held-chamber code); likewise two consecutive
   active ticks (extension→chamber, not a frozen hold).
3. **Boundary exactness:** the driven endpoint === the authored chamber at the last startup tick and last
   active tick, and === the solved `strikeHand` extension on the first active tick.
4. **Directional travel:** the endpoint's forward x moves toward the extension into contact and back
   through the chamber to the stance across recovery (per-segment direction).
5. **Solve retained (M8.5):** two opponent gaps yield two different contact-tick x — contact is still the
   live `reachTargetX`, not a frozen authored point.
6. **Coherence + bone length:** at an interior startup tick, the driven limb's mid-joint (elbow / knee)
   is at fixed bone length from its endpoints (re-derived), and the shoulder / head lean x sits _between_
   the stance and extension lean (moves WITH the endpoint) — the S2 · Slice 3 anti-scar guard.
7. **Totality:** an unauthored move (no chamber) eases through its stance (still moves); an idle frame
   (`attackPhase 0`), an unknown id, and a single-keyframe span each render byte-identical to today.
   **GREEN**: add a pure progress deriver (run-length scan) in `scene.ts` or a small sibling module; add a
   shared `smoothstep` pure fn (swappable seam); replace the discrete `driven` pick in `poseFor` with the
   keyframe blend, keeping the discrete behavior as the fallback when progress is absent (backward-compat /
   single keyframe); wire `scene()` to derive progress per figure and pass it into `poseFor`. Minimum needed
   to pass — no per-segment curves, no recovery override.
   **MUTATE**: `N/A` (Stryker excludes `web/`) → **manual mutator scan** over the new logic against
   `resources/mutator-rules.md` (smoothstep coefficients, segment-boundary off-by-one, keyframe order flip,
   lerp-direction flip, the run-length instance-boundary condition, the progress-absent fallback), recorded
   in the PR; relational tests are the alternate evidence.
   **KILL MUTANTS**: strengthen tests for any scan-surfaced gap; ask the human when a survivor's value is
   ambiguous.
   **REFACTOR**: assess the pure-module extraction (deriver + smoothstep) for testability, `isChamberPhase`
   demotion to a selector, and the `driven` rename; only if it adds value; keep `/dojo` + `/watch` green.
   **Done when**: all ACs met; suite + typecheck + lint + format clean; manual mutator scan recorded;
   `BENCHMARK_VERSION` unchanged at `v19`; the human approves the commit.

**Fallback split (only if the seam fights back):** if the run-length scan + blend proves larger than the
reconnaissance suggests, split into **1a** (progress deriver + smoothstep, RED #1, green with the blend
wired but exercised on one move) and **1b** (the full keyframe blend across all cases, RED #2–7). Default
is one PR; this is the escape hatch, not the plan.

## Pre-PR Quality Gate

1. **Mutation**: `N/A` (Stryker excludes `web/`) — review the manual mutator-scan record + relational coverage
2. **Refactoring assessment**: pure-module extraction, `isChamberPhase` selector, `driven` rename (`refactoring` skill); record `N/A` if no value
3. **Typecheck + lint + format** pass
4. **DDD glossary check**: `N/A` — project is not DDD

## Out of scope (explicitly deferred)

- **Per-segment curves** (ease-IN into contact for _kime_, quicker chamber) — M14(b) keeps the curve a
  swappable seam; per-segment tuning is a `/dojo` follow-up once the single curve is judged.
- **A distinct authored recovery pose per move** — M14(d) reuses the chamber; a bespoke recovery point is
  promoted only if the `/dojo` eye later demands it (as M3 / M13j already allow).
- **The `attackProgress` render-frame field** — M14(a) derives progress in-web; the contract field stays
  parked (parking lot) unless the in-web scan proves insufficient.
- **Whole-body kick character** (a back kick turning away, a roundhouse coming around) — still the arc's
  accepted expressiveness limit (M3); easing the driven endpoint does not add new degrees of freedom.
- **The `/sheet` contact sheet** — unaffected; it renders a single active-phase still per move (no
  timeline to ease).

## Arc closeout (this being the LAST story)

S8's PR closes the move-showcase arc. Its closeout (a follow-up `docs(archive)` PR, mirroring S6's #375)
**archives BOTH the still-live `plans/move-poses-s7.md` and this `plans/move-poses-s8.md`** under
`docs/archive/`, adds their README entries, marks S8 shipped in `plans/move-poses-stories.md`, and updates
`docs/STATUS.md`. Per [[archive-plans-not-delete]] these plans are archived, not deleted.

---

_Archived 2026-07-20 (arc closeout). Shipped as PR #377 — the move-showcase arc's final story; every
technique now flows on `/watch` and `/dojo`._
