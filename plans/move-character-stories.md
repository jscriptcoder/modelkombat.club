# Per-move character differentiation — child stories

Split via `story-splitting` (2026-07-22) from `plans/move-character-decisions.md` (D1–D8 + constraints).
Feeds `planning` → TDD, **PR per slice**. Every implementation slice loads `tdd`, `testing`,
`mutation-testing` (N/A for web — substitute the manual scan) and `refactoring`, and completes
RED-GREEN-MUTATE/SCAN-REFACTOR before the next slice starts.

**Status (2026-07-22):** **S1 ✅ shipped** (#386, `main`@`2212318`) + closed out (#387, `main`@`56d0b28`;
per-slice plan archived → `docs/archive/move-character-s1.md`). **S2 ✅ shipped** (#388, `main`@`3b24d0c`;
the per-move lean lever on `yoko-geri`) — closeout (archive `move-character-s2.md`) in flight. **S3–S5
remain** — next up is **S3** (the arc via-waypoint lever). This split + the decisions stay live in
`plans/` until the whole arc closes.

## Parent

**A developer browsing the arsenal in `/dojo` can tell each colliding move apart as a distinct
technique, not merely by its reach.**

- **Actor:** the developer comparing techniques in `/dojo` (primary); the spectator on `/watch`
  (secondary — same tapes)
- **Capability:** each of the 7 colliding moves reads as its own technique in playback — a distinct
  wind-up / motion / posture — instead of the same picture at a different distance
- **Outcome:** the arsenal becomes legible to browse and tune; the M3 "one picture per driven limb"
  ceiling is lifted for the moves that hit it
- **Current constraint:** the renderer drives ONE endpoint to a solved target and derives the rest, so
  same-limb moves are one picture apart from reach (M3). Two NEW levers (arc via-waypoint, per-move
  lean) plus the existing `chamber` field must combine to break that — without touching `src/`

## Recommended first slice

**S1 — the front-hand trio (`uraken` / `kizami-zuki` / `shuto`) each wind up from its own chamber.**

**Why this first:** the biggest bargain and the cheapest end-to-end whole. These three carry **no
descriptor at all** today (pure generic-hand fallback, no wind-up), so authoring `{limb:"handR",
chamber}` for each — **reusing the existing `chamber` field, no new mechanism** — immediately makes
their wind-ups three different motions in `/dojo`. It also **burns the one real cost hiding in this
group early**: `kizami-zuki` is the canonical "real move with no descriptor" test fixture threaded
through ~15 sites in the `scene`/`sheet` suites, and this is where that rework lands. It proves the core
hypothesis — _does execution-only differentiation read as distinct at all?_ — before we invest in either
new lever. Needs neither the arc nor the lean mechanism.

## Split candidates

| Slice | Value | Includes | Defers | Acceptance examples | Release constraint |
| ----- | ----- | -------- | ------ | ------------------- | ------------------ |
| **S1 ✅ SHIPPED (#386)** — front-hand trio winds up (chambers only) | The hand group's wind-ups become three distinct motions; proves execution-differentiation reads as distinct; retires the `kizami-zuki` fixture debt | Distinct `chamber` for `uraken` (fist cocked across the body), `kizami-zuki` (minimal / near-guard, fast), `shuto` (high by the ear); rework the ~15 `kizami-zuki`-as-undescribed test sites; `contact-sheet` reach test already re-pointed to `uraken` vs `shuto` (done in #384) | The arc SWING for `uraken`/`shuto` (S5); any lean; the other two groups | Given each of the three committed, when a mid-startup tick renders, its driven `handR` sits at a DIFFERENT point from the other two (distinct chambers) · Given each at contact, `handR` still lands at the same solved target (contact unchanged, M3) · Given an unauthored move, the generic hand still draws (M7) · The suite is green with `kizami-zuki` no longer standing in for "undescribed" | Shippable, `/dojo` |
| **S2 ✅ SHIPPED (#388)** — a move can LEAN as part of its technique (walking skeleton on `yoko-geri`) | Introduces the per-move lean/posture lever end-to-end and burns the "reopen M9 upright-kick" risk on one move; differentiates the front-foot pair | New optional per-move lean/posture descriptor field + pose wiring (generalise the hand-only, reach-derived lean to an authored value); `yoko-geri` = higher/tighter knee chamber + torso lean-BACK; consciously amend the M9 upright-kick test with rationale | Lean on any other move; the arc lever | Given `yoko-geri` committed, when it renders, the torso lean and/or knee-chamber differ from `mae-geri` at a representative tick (yoko ≠ mae) · Given a move that authors no lean (e.g. `mae-geri`), the torso is upright exactly as today (M9 preserved for it) · `BENCHMARK_VERSION` `v19`, no `src/` | Shippable, `/dojo` |
| **S3 — a technique can SWING its driven endpoint through an arc (walking skeleton on `mawashi-geri`)** | Introduces the arc via-waypoint lever end-to-end and burns the "arc vs the kime snap" placement risk on one move; makes the roundhouse read as a swing | New optional arc/via-waypoint descriptor field + eased 3-point path (decide where the via sits — the wind-up and/or recovery legs, NOT dulling the kime commit); `mawashi-geri` foot swings across into contact | The arc for `uraken`/`shuto` (S5); `ushiro` (S4) | Given `mawashi-geri` committed, when the wind-up→contact renders, the driven `footL` passes through the authored intermediate point — its mid-path position is off the straight chamber→contact line (a swing) · Given a move with no arc waypoint, the path is the straight ease exactly as today (backward-compat) · the kime contact tick still lands on the solved extension (arc must not shift where contact happens) | Shippable, `/dojo` |
| **S4 — `ushiro-geri` reads as a straight back-thrust, apart from the roundhouse** | Completes the rear-foot pair: the back kick contrasts with the roundhouse's swing | `ushiro-geri` = torso pitched FORWARD (opposite sign to `yoko`'s back-lean, reusing S2's lean lever) + a straight thrust path (no arc), so it contrasts with `mawashi`'s arc | — (last of the rear-foot group) | Given `ushiro-geri`, when it renders, the torso pitches forward (opposite sign to `yoko`) and the driven `footL` path is straight (no via point) — so `ushiro` ≠ `mawashi` at a representative tick (one arcs, one thrusts) | Shippable, `/dojo`. **Depends on S2** (lean lever); reads best after **S3** (the contrast) |
| **S5 — `uraken` and `shuto` get their arc character** | Enriches the hand trio from distinct wind-ups (S1) to distinct MOTION PATHS | Apply S3's arc lever to `uraken` (fist whips across) and `shuto` (chops down-and-in from the high chamber), on top of their S1 chambers | — (last of the hand group) | Given `uraken`/`shuto`, when rendered, each drives `handR` through its own via point — mid-path off the straight line, differing from the straight jab (`kizami`) and from each other | Shippable, `/dojo`. **Depends on S1** (their chambers) **+ S3** (arc lever) |

## Dependencies

```
S1 ─────────────────────────┐
S2 (lean lever) ──▶ S4        ├──▶ (all 7 differentiated)
S3 (arc lever) ──▶ S5 ◀── S1 ┘
```

S1, S2, S3 are each independent and can ship in any order (S1 = cheapest value + fixture debt; S2, S3 =
the two architecture-risk skeletons). S4 needs S2's lean lever; S5 needs S1's chambers + S3's arc lever.
**Recommended order: S1 → S2 → S3 → S4 → S5** — value + fixture debt first, then the two new levers
early (so their risk is burned before the group-completion slices), then finish each group.

## Parking lot

- **`/sheet` motion-trail** (D5) — ghost the driven limb across its keyframes so a swing-vs-thrust reads
  in one static `/sheet` image. The eventual answer for at-a-glance comparison of execution-only twins;
  a Pixi/`figures.ts` render change, not pose data. Explicitly optional, after the core lands.
- **`mae-geri` is the reference**, not a slice — the front kick is unchanged; `yoko-geri` differs _from_
  it. `/dojo` sign-off compares the two side by side.
- **Per-segment easing curves** (ease-in for kime vs ease-out for recovery) — a `/dojo` eye-tuning
  follow-up carried from the move-poses arc; may ride along with S3 if the arc needs it.
- **Facing / turn** (D6) — excluded from v1; the escalation lever only if `ushiro` ≠ `mawashi` cannot be
  achieved by lean + straight-thrust by eye. Do not pull in silently.

## Warnings

- **S1 carries test-fixture debt, not new behaviour risk.** The value is real (three distinct wind-ups)
  but a chunk of the work is re-pointing ~15 `kizami-zuki`-as-undescribed sites. If the whole effort
  were abandoned after S1, that rework is the sunk cost — worth knowing, though S1 still delivers a
  shippable group. If we'd rather burn _mechanism_ risk before fixture rework, pull **S2 or S3 first**.
- **S2 reopens a stated design decision (M9 upright kicks).** That is intended — but the amendment must
  be conscious and documented in the PR + the amended test, not a silently flipped rule.
- **S3's via-point placement is the open technical question.** The kime commit snaps to the extension on
  the first active tick and holds it; an arc on that leg would dull the strike. Planning must site the
  via on the wind-up / recovery legs (already eased) or find another seam — decide in the plan, prove by
  eye. This is the slice most likely to need a spike; keep it small.
- **Execution-only twins stay identical on `/sheet`** until the parked trail lands (except where S2/S4
  lean changes the contact silhouette). Say so in each PR so "the sheet still shows two the same" is not
  misread as the fix failing.
- **Do not split by lever as a component task.** Each slice above ships a _visible move differentiation_
  (a whole capability for that group), even the ones whose main content is a new mechanism — the
  mechanism rides in on a real, demoable move, never as a standalone "add the arc field" ticket.

## Next step

S1 and S2 are shipped (S1 closed out #387; S2 closeout in flight). **Next up is S3** (the arc
via-waypoint lever — the second and last mechanism-risk skeleton, on `mawashi-geri`). Load `planning`
for **S3** to turn it into PR-sized implementation slices with TDD detail. Its open technical question
(see Warnings): where the via-point sits without dulling the kime commit — likely the wind-up / recovery
legs (already eased), NOT the chamber→contact kime leg. (S4 depends on S2's lean lever and reads best
after S3; S5 depends on S1's chambers + S3's arc lever.)

---

_Archive under `docs/archive/` when the work closes — do not delete (`archive-plans-not-delete`)._
