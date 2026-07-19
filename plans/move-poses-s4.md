# Plan: S4 — the moves fighters actually throw look distinct

**Branch**: `feat/move-poses-s4-gyaku-zuki` (slice 1; one branch per slice thereafter)
**Status**: Active
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

- [ ] A spectator watching a replay can tell a **reverse punch** from a **jab** — they are thrown
      with different arms
- [ ] `gyaku-zuki` winds up, commits, and recovers through a shape authored for it, not through its
      stance
- [ ] A committed punch leans the upper body **only when the arm cannot otherwise reach**, so a
      close-range punch no longer leans for nothing
- [ ] `mawashi-geri` is distinguishable from `mae-geri` at the same band
- [ ] Every unauthored move still renders exactly as it does today (M7 totality — the fallback is the
      status quo, not a degraded state)
- [ ] `web/` only: no `src/` touch, no `BENCHMARK_VERSION` bump, no TCB change (M11)

## Non-goals

- **The close-range overlap problem** (`empi`/`hiza-geri` interpenetrating at true reach) — that is
  **S5's**, and S4 must not drift into it. `gyaku-zuki` sits at 240k, the default gap, which is
  exactly the distance the current bounded-stretch compromise was tuned for.
- **Easing between phases** — S8. S4 authors _endpoints_; S8 makes them flow.
- **The contact sheet** — S7, and deliberately after S4 so it has something to compare.
- **`hikite`** (the non-punching hand pulling back to the hip) — see Parking lot.

---

## Slices

All four are **behaviour change**; each loads `tdd`, `testing`, `mutation-testing`, `refactoring`
before code, and completes RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR before the next starts.
`web/` is outside Stryker, so **mutation evidence = the scripted manual mutator scan** (apply each
mutant to real source → run → restore) plus a `/dojo` visual sign-off. Never reason about a mutant
without applying it; re-run the scan after any refactor, because moving code invalidates the anchors.

### Slice 1 — the reverse punch is thrown with the rear arm

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

### Slice 2 — the reverse punch chambers at the hip

**Value**: kills the wind-up defect for the move that occupies 80% of screen time. Without a chamber
the rear arm sits at stance (x −18) through startup and recovery and then _snaps_ to full extension —
the S2 defect, reappearing for this move.
**Path**: `chamberFor("gyaku-zuki")` → `poseFor`'s existing phase gate → startup/recovery draw the
chamber.
**Class**: Behaviour change (data on an existing mechanism + eye-tuning).

**Acceptance criteria** _(refined at approval time)_

- [ ] Given `gyaku-zuki` on a **startup** tick, when it renders, `handL` sits at the authored chamber,
      **distinct from both its stance position and its extension** (the M8.3 assertion floor)
- [ ] Given a **recovery** tick, when it renders, `handL` returns to that same chamber
- [ ] Given the **active** tick, when it renders, the extension is unchanged from slice 1

**RED**: chamber-distinctness assertions per phase. **MUTATE**: chamber → stance, chamber → extension,
phase gate inverted. **Note**: authored from anatomy first (rear fist at the ribs, pulled back and
low), then re-tuned by eye in `/dojo` — the same sequence `mae-geri`'s chamber followed.

### Slice 3 — a punch leans only when it cannot otherwise reach

**Value**: closes the item carried from **S2 · slice 3**. `strikeLean` is a heuristic
(`min(16, handX × 0.5)`) while its lower-body counterpart `rootTravel` is _derived_ (the actual
shortfall beyond the limb's straight reach). They agree at the workhorse distance and diverge close
in, where the heuristic leans the torso forward **even though the arm could already reach** — a
spurious lunge on exactly the punch this story just authored.
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

- **`hikite`** — the non-punching hand pulling back to the hip. It is the other half of what makes a
  karate reverse punch read as karate, but it needs a _new_ mechanism (a second authored endpoint per
  descriptor, an "off hand"), which would benefit every hand technique. Deliberately deferred:
  slice 1 does not need it to make the move distinguishable. Revisit after S4 lands, or fold into S8.
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
