# Plan: S4 — the moves fighters actually throw look distinct

**Branch**: `feat/move-poses-s4-lean` (slice 3) — slices 1–2 shipped together in **#363**
(`feat/move-poses-s4-gyaku-zuki`, merged 2026-07-19 as `4f0d3b7`)
**Status**: Active — **2 of 4 slices done**
**Parent story**: `plans/move-poses-stories.md` § S4 · **Decisions**: `plans/move-poses-decisions.md` (M1–M11)

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
| `gyaku-zuki`   |          15 037 |  ~80% | ✅ slices 1–3         |
| `mawashi-geri` |           2 397 |  ~13% | ✅ slice 4            |
| `tobi-geri`    |             798 |   ~4% | → **S6** (air)        |
| `sweep`        |             646 |   ~3% | → **S6** (non-strike) |
| `throw`        |             110 | ~0.6% | → **S6** (non-strike) |

The three moves below `mawashi-geri` are all **S6's** territory, not S4's — they are the non-strike
and air techniques, which compose with existing layers rather than authoring a new driven endpoint.
So S4's stopping rule resolves cleanly: **S4 is `gyaku-zuki` + `mawashi-geri`, and then it stops.**
The remaining eight moves have _zero_ on-screen presence and are S7's call (does the generic
fallback read acceptably?), not an authoring obligation.

## Acceptance criteria

- [x] A spectator watching a replay can tell a **reverse punch** from a **jab** — they are thrown
      with different arms _(slice 1 drove the rear hand; slice 2's `hikite` is what makes it read)_
- [x] `gyaku-zuki` winds up, commits, and recovers through a shape authored for it, not through its
      stance _(slice 2)_
- [x] A committed punch leans the upper body **only when the arm cannot otherwise reach**, so a
      close-range punch no longer leans for nothing _(slice 3)_
- [ ] `mawashi-geri` is distinguishable from `mae-geri` at the same band
- [~] Every unauthored move still renders exactly as it does today (M7 totality — the fallback is the
      status quo, not a degraded state) — **M7 holds** (no descriptor lookup degrades an unauthored
      move: it gets the generic limb, no chamber, no pull), but slice 3 deliberately changed the lean
      and the resting hand for **every** move, authored or not, so the criterion's literal wording no
      longer describes what shipped. Recorded rather than ticked.
- [ ] `web/` only: no `src/` touch, no `BENCHMARK_VERSION` bump, no TCB change (M11)

## Non-goals

- **The close-range overlap problem** (`empi`/`hiza-geri` interpenetrating at true reach) — that is
  **S5's**, and S4 must not drift into it. `gyaku-zuki` sits at 240k, the default gap, which is
  exactly the distance the current bounded-stretch compromise was tuned for.
- **Easing between phases** — S8. S4 authors _endpoints_; S8 makes them flow.
- **The contact sheet** — S7, and deliberately after S4 so it has something to compare.

---

## Slices

All four are **behaviour change**; each loads `tdd`, `testing`, `mutation-testing`, `refactoring`
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

### Slice 4 — the roundhouse arcs in from the side

**Value**: the second and last move with real screen time (~13%). Completes S4.
**Path**: `mawashi-geri` descriptor → the existing kick path (`footR`, already proven by `mae-geri`).
**Class**: Behaviour change.

**Acceptance criteria** _(refined at approval time)_

- [ ] Given `mawashi-geri` at a band, when the active phase renders, its driven endpoint is
      **distinguishable from `mae-geri`'s at the same band**
- [ ] Given a startup tick, when it renders, it draws its own chamber (knee lifted to the side)

**Known risk — this is where M3's expressiveness limit bites.** M3 accepts that _only the driven
endpoint moves_, and a roundhouse differs from a front kick mainly in the **path** the foot travels
and the **hip rotation**, not in where the foot ends up. Two kicks may well end up looking alike at
the same band. That is the arc's carried expressiveness risk, and this slice is its detector.
**If they read the same, stop and escalate** — decision 3 holds a bespoke escape hatch, and S7's
contact sheet is the confirming instrument. Do not quietly ship two identical kicks.

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
- **Slice 4 may fail its own acceptance criterion**, and that is a real outcome, not a defect to code
  around. See the risk note above.
- **Do not "fix the stretch"** — read `docs/archive/move-poses-s2.md` first. The bounded stretch is a
  deliberate compromise against a ratio the engine owns, not an oversight.

---

_Archive this file under `docs/archive/` when complete (never delete — house rule), and add its
`docs/archive/README.md` entry._
