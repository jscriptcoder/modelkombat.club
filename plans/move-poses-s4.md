# Plan: S4 — the moves fighters actually throw look distinct

**Branch**: slice 6 cuts from `main`. Shipped so far — slices 1–2 in **#363**
(`feat/move-poses-s4-gyaku-zuki`, `4f0d3b7`); slice 3 + the M12 decision tree in **#364**
(`feat/move-poses-s4-lean`, `7800ed9`); slice 4 the girdle in **#365** (`feat/move-poses-s4-girdle`,
`7ff7a7d`); slice 5 the rotation in **#366** (`feat/move-poses-s4-rotate`, `c658e3e`) — all merged
**Status**: **S4 COMPLETE — 6 of 6 slices done** (scope amended 2026-07-19: the shoulder girdle, M12).
Slice 6 (`mawashi-geri`, the rear-leg roundhouse / M12i escape hatch) is built + green + `/dojo`-signed;
PR pending. Archive this file under `docs/archive/` once slice 6 merges (house rule; add the README entry).
**Parent story**: `plans/move-poses-stories.md` § S4 · **Decisions**: `plans/move-poses-decisions.md` (M1–M12)

## Goal

The techniques fighters _actually throw_ each read as their own move on `/watch` — starting with
`gyaku-zuki`, which is ~80% of all committed on-screen time.

## Why this story, and why now

S1–S3 built the mechanism (descriptor table, driven-endpoint solve, phase-correct playback, fixed
bone lengths) and the harness (`/dojo` can select any of the 13, stand the pair at its true reach,
pose it at a legal band, and replay it from tick 0). **Everything S4 needs already exists.** This
story spends that machinery on the moves with actual screen time.

It is also the first story whose result a **spectator** sees. `mae-geri` — the move S1 and S2
authored — is never thrown in a real fight, so today every technique a spectator has ever watched
renders as the generic front hand at a band height. Slice 1 changes that.

### The telemetry ordering is current — no re-run needed

The story file recommends re-running `npm run telemetry` before starting. That count was taken
**2026-07-19** (S2 · slice 1 preview check, every committed tick across all 29 deployed replays),
and the last `src/` commit is **S0 `#352`, which predates it**. S1–S3 are entirely web-side. The
engine that produced those numbers is the engine running today, so the ordering stands:

| Move           | committed ticks | share | S4?                   |
| -------------- | --------------: | ----: | --------------------- |
| `gyaku-zuki`   |          15 037 |  ~80% | ✅ slices 1–5         |
| `mawashi-geri` |           2 397 |  ~13% | ✅ slice 6            |
| `tobi-geri`    |             798 |   ~4% | → **S6** (air)        |
| `sweep`        |             646 |   ~3% | → **S6** (non-strike) |
| `throw`        |             110 | ~0.6% | → **S6** (non-strike) |

The three moves below `mawashi-geri` are all **S6's** territory, not S4's — they are the non-strike
and air techniques, which compose with existing layers rather than authoring a new driven endpoint.
So S4's stopping rule resolves cleanly: **S4 is `gyaku-zuki` + `mawashi-geri`, and then it stops.** _(Amended 2026-07-19: slices 4–5 add the shoulder girdle — see M12. It is not a third move; it is the mechanism without which the first one does not read.)_
The remaining eight moves have _zero_ on-screen presence and are S7's call (does the generic
fallback read acceptably?), not an authoring obligation.

## Acceptance criteria

- [x] A spectator watching a replay can tell a **reverse punch** from a **jab** — they are thrown
      with different arms _(slice 1 drove the rear hand; slice 2's `hikite` is what makes it read)_
- [x] `gyaku-zuki` winds up, commits, and recovers through a shape authored for it, not through its
      stance _(slice 2)_
- [x] A committed punch leans the upper body **only when the arm cannot otherwise reach**, so a
      close-range punch no longer leans for nothing _(slice 3)_
- [x] `mawashi-geri` is distinguishable from `mae-geri` at the same band _(slice 6 — it drives the
      REAR leg, the M12i escape hatch; different leg, not the identical pixel two footR kicks would be)_
- [~] Every unauthored move still renders exactly as it does today (M7 totality — the fallback is the
  status quo, not a degraded state) — **M7 holds** (no descriptor lookup degrades an unauthored
  move: it gets the generic limb, no chamber, no pull), but slice 3 deliberately changed the lean
  and the resting hand for **every** move, authored or not, so the criterion's literal wording no
  longer describes what shipped. Recorded rather than ticked.
- [x] `web/` only: no `src/` touch, no `BENCHMARK_VERSION` bump, no TCB change (M11) — held every
      slice; slice 6's `git diff --stat main -- src/` is empty (which leg renders is a descriptor choice)

## Non-goals

- **The close-range overlap problem** (`empi`/`hiza-geri` interpenetrating at true reach) — that is
  **S5's**, and S4 must not drift into it. `gyaku-zuki` sits at 240k, the default gap, which is
  exactly the distance the current bounded-stretch compromise was tuned for.
- **Easing between phases** — S8. S4 authors _endpoints_; S8 makes them flow.
- **The contact sheet** — S7, and deliberately after S4 so it has something to compare.

---

## Slices

All six are **behaviour change**; each loads `tdd`, `testing`, `mutation-testing`, `refactoring`
before code, and completes RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR before the next starts.
`web/` is outside Stryker, so **mutation evidence = the scripted manual mutator scan** (apply each
mutant to real source → run → restore) plus a `/dojo` visual sign-off. Never reason about a mutant
without applying it; re-run the scan after any refactor, because moving code invalidates the anchors.

### ✅ Slice 1 — the reverse punch is thrown with the rear arm — DONE (#363)

_All six ACs green; scan 9/9 killed; `/dojo` sign-off taken. The sign-off is what produced the
plan amendment under slice 2 — see there._

**Value**: A spectator can tell `gyaku-zuki` from `kizami-zuki`. Today both fall back to the generic
front hand, so the workhorse technique and the jab are the same picture.
**Path**: tape `attackMove: "gyaku-zuki"` → `limbFor` → `poseFor` routes the driven endpoint onto
`handL` → `deriveSkeleton` re-bends `elbowL` → visible on `/watch` and `/dojo`.
**Class**: Behaviour change.
**Required skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.

**What changes**

1. `StrikeLimb` grows from `"handR" | "footR"` to include `"handL"`.
2. `poseFor`'s endpoint routing becomes a three-way on the limb (it is currently a binary
   `limb === "footR" ? footR : handR`).
3. **The rear-hand precedence rule** — the one structural risk. `scene.ts:305` puts a raised guard on
   `handL` _specifically_ so a strike and a guard never contend for the same arm, and it is spread
   **after** the strike layer, so today it would silently overwrite a rear-hand punch. The rule:
   **a committed strike wins the rear hand; the guard yields.** Rationale — the committed technique
   is the more informative event, and the alternative renders `gyaku-zuki` as a fighter with a raised
   guard and _no visible punch at all_, i.e. the move looks unthrown. The guard must still win when
   there is **no strike being drawn**, so the yield is gated on `driven !== null`, not on the move id
   (a stale id on an idle fighter must never strip a real guard).
4. `gyaku-zuki` descriptor: `{ limb: "handL" }`. **No chamber yet** — slice 2.

Note this pair is engine-_impossible_ (guard and attack are mutually exclusive in the sim) but
`/dojo`-reachable by design (M10 free combos), so the rule is exercised by the harness even though
no tape produces it.

**Acceptance criteria** — _present for approval before any code_

- [ ] Given a frame committing `gyaku-zuki` at the high band, when the active phase renders, **`handL`
      is driven forward to the band height** and `handR` stays at its stance position
- [ ] Given that same frame **also carrying a guard band**, when it renders, `handL` still shows the
      punch — the strike wins the rear hand
- [ ] Given a fighter **not attacking** who carries a guard band and a stale `attackMove:
"gyaku-zuki"`, when it renders, `handL` shows the **guard** — the yield needs a live strike
- [ ] Given `kizami-zuki` (no descriptor), when it renders, `handR` drives and `handL` is untouched —
      the generic path is unchanged (M7)
- [ ] Given `gyaku-zuki` committed, when it renders, **`elbowL` re-derives off the moved
      `shoulder → handL`** rather than staying at its stance bend
- [ ] Given `mae-geri`, when it renders, `footR` still drives — the three-way routing did not disturb
      the kick path

**RED**: `scene.test.tsx` — the six assertions above, driven through `scene()` on synthetic tapes
(the established pattern: assert scene-graph joint coordinates, never pixels).
**GREEN**: the four changes above, minimum only.
**MUTATE**: scripted scan. Anticipated mutants, each with its killer:
| Mutant | Killed by |
| --- | --- |
| precedence guard `limb === "handL"` → `!==` | AC 2 |
| the guard-yield condition deleted (guard always wins) | AC 2 |
| `driven !== null &&` dropped from the yield | AC 3 |
| three-way routing collapsed back to `handR` | AC 1 |
| `handL` case falls through to `footR` | AC 1 + AC 6 |
| `deriveSkeleton` left off the moved endpoint | AC 5 |
**KILL MUTANTS**: add tests for survivors; ask when a survivor's value is ambiguous.
**REFACTOR**: assess. Candidate — the endpoint routing is becoming a lookup; a `Record<StrikeLimb,
…>` may read better than a nested ternary. Only if it adds value.
**Done when**: all six ACs green, scan clean, `/dojo` visual sign-off on `gyaku-zuki`, commit approved.

### ✅ Slice 2 — the reverse punch chambers at the hip — DONE (#363)

_All six ACs green; scan 13 killed / 1 equivalent (hard-coding `offHandKey` to `handR`, which no
current descriptor can distinguish). One AC lost its test: "the front elbow re-derives off the pulled
hand" could not be made to fail for the right reason — every weaker form of it also held with the
hand at stance, because what moves the elbow there is the M2 lean, not the pull. No test rather than
one that cannot fail._

_**The authored points stand after all.** They sit at the flank (`chamber {x:-26,y:-50}`,
`offHand {x:-8,y:-50}`) rather than the hip, because the contact-phase shoulder is leaned 16px
forward and an authored point outside the arm's reach renders as a stretched line. I first recorded
that slice 3 might reduce that lean and unlock the hip — **checked, and it does not**: `gyaku-zuki`'s
reach and the default gap are both 240k, so its hand solves to x 66, where the derived shortfall
(66.1 − 31.3 = 34.8) caps at exactly the same 16 the heuristic gave. **The workhorse punch renders
identically before and after slice 3**, which makes it slice 3's regression pin rather than a
re-tuning opportunity._

**Value**: kills the wind-up defect for the move that occupies 80% of screen time. Without a chamber
the rear arm sits at stance (x −18) through startup and recovery and then _snaps_ to full extension —
the S2 defect, reappearing for this move.
**Path**: `chamberFor("gyaku-zuki")` → `poseFor`'s existing phase gate → startup/recovery draw the
chamber; a new `offHand` descriptor field → the non-punching hand.
**Class**: Behaviour change (a new authored endpoint + data + eye-tuning).

#### `hikite` was folded in here — why (decided 2026-07-19, after slice 1's visual check)

Slice 1 shipped the rear-hand drive and the ACs passed, but the `/dojo` sign-off showed the
distinction is carried by the **trailing arm, not the punching arm**. Both arms hang off a **single
shared `shoulder` joint**, so a rear-hand punch and a front-hand punch send the _extended_ arm to
nearly the same place; only the resting arm differs (folded at the chest for `gyaku-zuki`, trailing
back for `kizami-zuki`). Side by side they are different poses — but the spectator-facing goal
(_tell a reverse punch from a jab_) is served faintly.

`hikite` — the non-punching hand snapping back to the hip — is what makes the punching side read,
and it is the **same authored-endpoint mechanism** as the chamber, on the same move, judged in the
same eye-pass. It was a non-goal when this plan was written; keeping it there would mean opening
`gyaku-zuki` a third time and judging it by eye twice. Folded in instead.

Note this is an early instance of the **M3 expressiveness limit** already flagged for slice 4: only
the driven endpoint moves, so techniques that differ in whole-body mechanics rather than in endpoint
destination are hard to separate. `offHand` is the first crack in that — a _second_ authored
endpoint. Keep it a descriptor field, not a `gyaku-zuki` special case, so slice 4 can use it too.

**Acceptance criteria** _(present for approval before any code)_

- [ ] Given `gyaku-zuki` on a **startup** tick, when it renders, `handL` sits at the authored chamber,
      **distinct from both its stance position and its extension** (the M8.3 assertion floor)
- [ ] Given a **recovery** tick, when it renders, `handL` returns to that same chamber
- [ ] Given the **active** tick, when it renders, the punching hand's extension is **unchanged from
      slice 1** — `hikite` must not move where contact happens
- [ ] Given `gyaku-zuki` at **contact**, when it renders, the **front hand is drawn back toward the
      hip**, clearly behind its stance position — so the punch reads from the punching side
- [ ] Given a move with **no `offHand`** authored (every move but this one), when it renders, its
      non-driven hand stays at stance — M7 totality, the fallback is the status quo
- [ ] Given `gyaku-zuki`, when the **elbow re-derives**, it follows the pulled hand rather than
      staying at the stance bend

**RED**: chamber-distinctness assertions per phase, plus the off-hand assertions above.
**MUTATE**: chamber → stance, chamber → extension, phase gate inverted, `offHand` dropped, `offHand`
applied to the _driven_ hand, `offHand` leaking onto undescribed moves.
**Note**: both points authored from anatomy first (rear fist at the ribs pulled back and low; front
fist withdrawn to the hip), then re-tuned by eye in `/dojo` — the sequence `mae-geri`'s chamber
followed. **Watch the ordering**: `offHand` must not fight the guard layer the way the strike did —
if the off hand is `handL` on some future move, slice 1's precedence rule is the precedent to follow.

### ✅ Slice 3 — a punch leans only when it cannot otherwise reach — DONE

_All 7 approved ACs green (10 net new tests); scan **9 killed / 2 accepted survivors**, both
documented in `scene.ts` rather than coded around: the resting-`handR` ride is unreachable until a
rear-hand move authors no `hikite`, and the `winding` phase gate is redundant only because slice 2's
"authored points stay inside the limb's reach" convention makes a far chamber undrawable anyway — M9
is a stated rule and this is where it is stated._

_One AC lost its test: "root x stays truthful" is already pinned in the M2 lean block, and `poseFor`
is never given the root x, so a second copy would assert the same guarantee against the same
mechanism. One RED test also had to be **rewritten before it could fail**: a collinearity check on the
resting elbow passes either way, because joints round to whole px and rounded integer coordinates are
essentially never exactly collinear. Replaced with bone-length drift, which fails at 26%._

**⚠️ The eye-check found a real cost — see "The shared shoulder" below.**

**Value**: closes the item carried from **S2 · slice 3**. `strikeLean` is a heuristic
(`min(16, handX × 0.5)`) while its lower-body counterpart `rootTravel` is _derived_ (the actual
shortfall beyond the limb's straight reach). They agree at the workhorse distance and diverge close
in, where the heuristic leans the torso forward **even though the arm could already reach** — a
spurious lunge on exactly the punch this story just authored.

**A second motive surfaced during slices 1–2's eye-check**: because both arms hang off the one
`shoulder` joint, leaning it forward drags the _resting_ hand's root forward too, so the resting arm
overstretches on **every** generic punch — not only `gyaku-zuki`, and not only close in. Same root
cause, same fix; judge both in the one pass.
**Path**: `poseFor` → `lean` → head/shoulder offset.
**Class**: Behaviour change (visual output changes at close range), though it reads like a refactor.

**Acceptance criteria** _(refined at approval time)_

- [ ] Given a punch whose target is **within the arm's straight reach**, when it renders, the upper
      body does **not** lean
- [ ] Given a punch **beyond** that reach, when it renders, the upper body leans by the shortfall,
      still capped
- [ ] Given a kick, when it renders, the hip step is unchanged (the lower body already works this way)
- [ ] The fighter's **root x stays truthful** — this is a local-pose lean only, never a position edit

**Ordering note**: after slices 1–2, so the change is judged by eye on a punch that already looks
like a reverse punch. Before slice 4, so the kick slice is not judged against a moving baseline.

#### The shared shoulder — M3 bites a slice early (found 2026-07-19, slice 3's eye-check)

At the workhorse distance `gyaku-zuki` and `kizami-zuki` now render **nearly the same picture** — the
thing slices 1–2 exist to prevent. Measured at 240k / high band:

|              | jab         | reverse punch                     |
| ------------ | ----------- | --------------------------------- |
| driven hand  | `417, −429` | `417, −429` — **pixel-identical** |
| resting hand | `−13, −278` | `−51, −316`                       |

Both arms hang off **one `shoulder` joint** and both solve to the same target, so the punching arm is
the same picture whichever hand throws. **The entire distinction lives in the resting hand**, and
slice 3 shrank its separation from 63px to 38px horizontally.

Slice 3 did not break a guarantee — it removed a **stretch artifact**. The jab's resting arm used to
be flung 39.4px from a 31.3px shoulder, and that overextension was accidentally carrying some of the
distinction. Fixing the defect cost the side effect. Re-tuning `hikite` buys ~4px before the fist
exits the arm's reach and stretches again, so it is not a tuning problem.

**This is the M3 expressiveness limit the plan forecast for slice 4, arriving on punches instead**, and
it gets slice 4's prescribed treatment: escalate, do not quietly ship two moves that look alike. The
structural answer is that `Stance` has ONE shoulder — give it a front and a rear one and a reverse
punch visibly travels from the back shoulder, which is what separates the techniques on a real body.
That is a skeleton change touching every pose and stance, so it is **its own decision, taken before
slice 4** — slice 4 is about to hit the same wall from the kick side, and a second shoulder would
change how both are judged.

### ✅ Slice 4 — the fighter gets a shoulder girdle — DONE

**Value**: the mechanism that makes a reverse punch and a jab different pictures. Today their
driven hands land on the **identical pixel** because both arms hang off one joint; after this the
rear arm starts 14px further back, so the whole arm line differs. Decided in
**`move-poses-decisions.md` § M12** — read that first; the whole tree is resolved there.
**Path**: `Stance` → derived `shoulderL`/`shoulderR` → `deriveSkeleton` re-roots the elbows →
`BONES` gains the girdle bar → visible on `/watch` and `/dojo`.
**Class**: Behaviour change.
**Required skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.

**What changes**

1. `Skeleton` gains `shoulderL` / `shoulderR`, **derived** as `shoulder.x ± SHOULDER_HALF_WIDTH`
   (start at 7). `shoulder` is redefined as the girdle's **midpoint** — the spine's top and the
   head's anchor.
2. `deriveSkeleton` re-roots: `elbowL` off `shoulderL`, `elbowR` off `shoulderR`. `ARM_BONE` is
   **unchanged** (M12b — widening shoulders does not shorten arms).
3. `PRONE` sets both to its one authored point (M12g) — a knockdown renders byte-identically.
4. `figures.ts`: `BONES` gains `["shoulderL","shoulderR"]`, the two arm bones re-root, and
   `applyFigure` places two more containers.

**The lean is NOT touched in this slice.** It keeps applying to `shoulder` (the midpoint) exactly
as slice 3 left it, so both ends move together. Slice 5 rewires it in the same breath as making it
rotate.

#### The girdle breaks `hikite` on its own — accepted, bounded, pinned (approved 2026-07-19)

M12's "the slide breaks `hikite`" was read here as _leaving the lean alone avoids the break_. It
does not; it only avoids making it worse. Measured before writing any code:

```
hikite fist (-8,-50), root = shoulderR
  today   shoulder at x 16 → span 27.78   ✓ inside the 31.305 reach
  slice 4 shoulderR at 23  → span 34.01   ✗ 8.7% over
```

`deriveBend` floors the offset at 0 and slice 2's eye-tuned pulled fist renders as a straightened
line — the artifact slice 3 removed, at about a third the old severity (the rubber-band arm was 26%
over). The two alternatives were both worse: a half-width of 4 puts the span at 31.30 against a
31.3050 reach (a margin that breaks on any re-tune, and it halves the payoff below), and re-tuning
`hikite` here and again in slice 5 means judging the same fist by eye twice — exactly what slice 2
folded `hikite` in to avoid. So it ships as a **bounded intermediate state with a ceiling on it**
(AC 7), and slice 5 removes the cause by returning the front shoulder to x 7.

Two smaller consequences are deliberate non-criteria: the guard arm's span grows 19.70 → 23.43 and
the throw's rear grab arm goes from 8px shorter than the front to 6px longer. Both stay inside
reach — comment them in `scene.ts`, do not assert them.

**Acceptance criteria** — _approved 2026-07-19_

- [x] Given `gyaku-zuki` committed, when it renders, `elbowL` derives off **`shoulderL`** (the rear
      end), not the midpoint — so the rear arm visibly starts further back
- [x] Given `kizami-zuki` at the same gap and band, when both render, the reverse punch's **arm span
      exceeds the jab's, by an amount that tracks the half-width constant** — the distinction slices
      1–2 could not produce. Assert the RELATION, not the literal (decision 9): the difference is
      **13.95**, not 14, because the hands sit 4px below shoulder height
- [x] Given any pose, when it renders, both shoulders sit at the **same y**, equidistant from
      `shoulder` — the girdle is horizontal and centred
- [x] Given a **knockdown**, when it renders, the pose is **unchanged** from today and both
      shoulders coincide (M12g — any visible change here is a bug, not a judgement call)
- [x] Given an idle fighter, when it renders, each arm's **bones keep their stance length** — the
      deeper bow (8.00 → 10.71) is a consequence of the shorter span, not a stretched bone
- [x] Given `mae-geri`, when it renders, the **legs are untouched** — no hip girdle (M12i)
- [x] Given `gyaku-zuki` at contact, when it renders, the pulled fist's arm is stretched **no more
      than 10%** past its straight reach — the bounded intermediate state above. Slice 5 tightens
      this to "inside reach" once the rotation returns the front shoulder to x 7

**MUTATE**: scripted scan, **13 applied / 13 killed** (every anticipated mutant plus the draw-layer
ones). Two findings worth carrying forward:

- **The scan's first version reported a false kill.** It trusted `execSync`'s exit code, which goes
  non-zero for runner errors as well as test failures — M10 was reported killed and was in fact
  alive. The scan now records a kill only when the run **names failing tests**, so every verdict is
  attributable to a test. _Never trust an exit code as a kill signal._
- **`BONES` needed exporting to be testable at all.** The bones stroke into a Pixi `Graphics` path,
  which display-object assertions cannot see, so re-rooting an arm to the midpoint (M11) or dropping
  the girdle bar (M10) was invisible to the whole suite while being plainly visible on screen. Both
  survived until `BONES` was exported and its wiring asserted directly — the same discipline
  `DESCRIBED_MOVES` already uses. Any future change to what the draw layer connects needs that test.

A transport test (`auto-pauses at the end of a short fight`) surfaced intermittently **only under
mutation**, never on clean code (verified 3× stashed, 5× on the player suite). Broken geometry
perturbing the render loop, not a pre-existing flake — but it is why kill attribution must name the
test rather than count failures.

### ✅ Slice 5 — the torso rotates into the punch — DONE

_All 6 approved ACs green; scan **12/12 killed**; `/dojo` sign-off taken (chamber square, contact
rotates the rear shoulder through with `hikite` drawn to the hip inside reach, visibly distinct from a
jab). The `~8 existing tests` the plan forecast was in fact **16** — the derived lean touches more
blocks than the raw `LEAN_CAP` count suggested; each was revised to its new claim, none weakened._

**Value**: makes the reverse punch read as a reverse punch — the rear shoulder coming through is
the technique's signature — and **restores `hikite` to the hip**, where slice 2 wanted it and the
geometry refused.
**Path**: `poseFor` → `lean` applied to the driving shoulder only → midpoint and head follow at
`lean/2`.
**Class**: Behaviour change.

**What changed**

1. The lean moves the **driving** shoulder by `lean`; the other stays (M12e) — a new optional
   `GirdleShift` on `deriveSkeleton` splits the two ends ±`lean/2` around the midpoint.
2. `shoulder` (the midpoint) and `head` move by **`lean/2`** (M12f).
3. The shortfall is measured from **each arm's own root** (`drivingShoulder`, ±`SHOULDER_HALF_WIDTH`,
   M12d) — so a reverse punch leans more than a jab at mid range.
4. **Slice 3's hand-ride is retired.** The resting shoulder no longer moves, so the ride lines are
   simply deleted and resting hands keep their absolute stance — its test was removed, not inverted,
   because the ride's cause is gone (criterion 6 positively pins the resting hand at stance instead).
5. `gyaku-zuki`'s `hikite` re-tuned toward the hip (−8 → −20), inside its 31.3 reach at a 30.4 span.

**Acceptance criteria** _(approved 2026-07-19)_

- [x] Given `gyaku-zuki` at contact, when it renders, `shoulderL` has travelled **past**
      `shoulderR` — the torso has twisted, not slid (the resting front shoulder stays at stance +HALF)
- [x] Given the same frame, the **head and midpoint move half** the driving shoulder's travel (pinned
      as the literal half of the cap AND the 2:1 ratio)
- [x] Given a jab and a reverse punch at **mid range**, the reverse punch leans **more** — the
      shortfall is measured per-arm; plus the mirror (a jab drives the front shoulder, rear stays)
- [x] Given `gyaku-zuki` at contact, the pulled fist's arm **keeps its bone lengths** with the
      fist drawn back near the hip — inside reach, retiring slice 4's ≤10% ceiling
- [x] Given a **kick** or a **throw**, when it renders, no rotation occurs (both already gate the
      lean to zero) — status quo preserved
- [x] Given a jab at contact, its **resting rear hand stays at its stance position** — the ride is
      retired with the slide that forced it

**MUTATE**: scripted scan, **12/12 killed** (girdle offsets, both girdle-shift signs, half-vs-full
lean, both midpoint/head halves, the per-arm root, both driving-root signs, the `deriveSkeleton`
girdle pass-through). Every kill attributed to a named failing test — kills recorded only on named
`FAIL` lines, never exit codes (the slice-4 false-kill lesson, still load-bearing).

### ✅ Slice 6 — the roundhouse kicks with the rear leg — DONE

_All 7 approved ACs green (8 net new tests → 152); scan **12/12 killed**, every kill on a named
failing test; `/dojo` sign-off taken. **The carried expressiveness risk resolved by taking the escape
hatch, not by shipping look-alikes.**_

**The finding, and the resolution (approved 2026-07-20).** A front kick and a roundhouse BOTH drive a
foot to the same solved target (`reachTargetX` at the band), so driving the same foot renders them on
the **identical pixel** — the same M3 wall the girdle was built for, now on kicks. In a 2-D sagittal
stickman the chamber cannot rescue it either: a roundhouse's signature is _lateral hip rotation_
(knee to the side), which is into/out of the screen and invisible. So the slice took **M12i's named
escape hatch: the roundhouse drives the REAR leg (`footL`, a new `StrikeLimb`)** — the rear foot
swings across to the near edge while the front foot holds as support. "Different leg" is the one
distinction a side view _can_ show; it is also the classic rear-leg round kick, and mechanically it is
just another endpoint through the shared solver (decision 3), so it stayed **web-only** (the engine
does not model legs — which leg renders is a descriptor choice). Driving `footR` first was skipped:
the identical contact is deterministic from the solve, not an eye question, so it would only have
burned a PR to confirm the wall.

**Value**: the second and last move with real screen time (~13%). Completes S4.
**Path**: `mawashi-geri` descriptor `{ limb: "footL", chamber }` → the existing kick path (now
generalised from `footR` to either foot) → `kneeL` re-derives off the moved `hip → footL` for free.
**Class**: Behaviour change.

**What changed**

1. `StrikeLimb` grows `"footL"`; `poseFor`'s routing gains a `footL` branch.
2. A shared `isKick = limb === "footR" || limb === "footL"` predicate replaces the two
   `limb === "footR"` gates — a kick (either foot) **steps the hip** (M9) and **never leans or rotates
   the girdle**. The routing below still splits which foot.
3. `mawashi-geri` descriptor authors its own chamber (rear knee cocked up and back), eye-tuned in
   `/dojo`; relations pinned, the literal free to retune (decision 9).

**Acceptance criteria** _(approved 2026-07-20)_

- [x] `mawashi-geri` active drives **`footL`** (rear foot) to the solved edge, `footR` planted — and at
      the same band/gap `mae-geri` drives `footR` and rests `footL`: the two kicks move **different
      legs** (the escape hatch; criterion 1)
- [x] Two gaps → two different phase-2 `footL` x — the rear-leg solve is retained, not a fixed
      extension (M8.5)
- [x] Startup draws its own chamber (rear knee cocked), distinct from stance and from the extension,
      with the extension forward of it (M8.3/8.4)
- [x] The support (front) foot stays at stance through every phase (M8.2)
- [x] It reads as a kick: the hip **steps**, the torso stays **upright**, the girdle stays **square**
      (M9) — no lean, no rotation
- [x] `kneeL` re-derives off the moved `hip → footL`, so the kicking leg reads jointed (M8.6)
- [x] `mae-geri` still drives the front leg — the additive `footL` route did not disturb it (M7)

**MUTATE**: scripted scan, **12/12 killed** (limb → footR / hand; the routing branch → footR / dropped;
`isKick` dropping either foot; the lean gate no longer suppressing kicks; the step gate flipped /
always-on; and three chamber-shape mutants). Kills recorded only on named `FAIL` lines, never exit
codes (the slice-4 lesson, still load-bearing).

**`/dojo` sign-off — PASS, read honestly.** The roundhouse and front kick are _distinguishable_, not
identical (the footR-vs-footR alternative would have been pixel-identical). The distinction is carried
by **which leg kicks** (rear-across vs front-snap → a visibly different support-stance width), a
clearly different **cocked-rear-leg chamber**, and — the part a still undersells — the rear leg
sweeping a wide arc in motion. In real fights `mawashi-geri` defaults to its **HIGH** band while
`mae-geri` is **MID-only**, so height separates them further on `/watch`. The contact _stills_ share a
gross shape (both extend a leg to the target); if S7's contact sheet later judges that too weak across
all 13, this is the move to revisit — but it clears the "do not ship two identical kicks" bar.

---

## Pre-PR quality gate (each slice)

1. Scripted manual mutator scan (substitutes for Stryker — `web/` is not reachable) — all applied,
   all killed, re-run after any refactor
2. Refactoring assessment (`refactoring`); record `N/A` if none adds value
3. `npm run typecheck` + `npm run lint` pass
4. **Format only the slice's own files** — `npm run format` is repo-wide and `format:check` fails on a
   pre-existing violation in `docs/archive/variety-telemetry-s3a.md` on clean `main`
5. `/dojo` visual sign-off via Playwright driven directly (**`agent-browser` hangs on Pixi pages**;
   script must live in the repo root so Node resolves `node_modules`)
6. M11 gate: `git diff --stat main -- src/` is **empty**

## Parking lot

- ~~**`hikite`**~~ — **promoted into slice 2** after slice 1's visual check showed the rear-hand drive
  alone reads faintly (one shared shoulder ⇒ the extended arm lands in nearly the same place either
  way). See the note under slice 2.
- **The eight zero-usage moves** — `uraken`, `ushiro-geri`, `yoko-geri`, `shuto`, `kizami-zuki`,
  `empi`, `hiza-geri`, `mae-geri`(authored). S7 decides whether the generic fallback reads acceptably;
  `empi`/`hiza-geri` are S5's regardless.
- **`formatGap` / `formatReach` duplication** (`SpacingControl.tsx` / `FigureControlPanel.tsx`) —
  carried from S3, still unmerged. A standalone tidy, not a feature commit. Do not smuggle it in.

## Warnings

- **The precedence rule is the only structural change in this story.** Everything else is descriptor
  data on proven mechanisms. Keep slice 1 small enough that the rule is reviewable on its own.
- **Slice 6 may fail its own acceptance criterion** (renumbered from slice 4 by the M12 amendment),
  and that is a real outcome, not a defect to code around. See the risk note under slice 6.
- **Do not "fix the stretch"** — read `docs/archive/move-poses-s2.md` first. The bounded stretch is a
  deliberate compromise against a ratio the engine owns, not an oversight.

---

_Archive this file under `docs/archive/` when complete (never delete — house rule), and add its
`docs/archive/README.md` entry._
