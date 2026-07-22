# Per-move character differentiation — design decisions

> Post-arc follow-up to the **move-showcase arc** (`docs/archive/move-poses-*`). That arc got every
> move to read as its own _limb_ (a kick draws a foot, a punch a hand) and closed accepting M3's
> expressiveness limit: **only the driven endpoint moves**, so moves that drive the same limb to the
> same band render the identical contact picture and differ only by reach. A user browsing `/dojo` +
> `/sheet` then reported the visible consequence — `mae-geri`/`yoko-geri`, `mawashi-geri`/`ushiro-geri`,
> and `uraken`/`kizami-zuki`/`shuto` look the same, "only the distance" differs, "even the execution is
> the same." This is that deferred expressiveness problem, now taken up deliberately.

Resolved via `grilling` (2026-07-22). Feeds `story-splitting` → `planning` → TDD, **PR per slice**.

## Parent capability

**A developer browsing the arsenal in `/dojo` (and eventually `/sheet`) can tell each colliding move
apart as a distinct technique — not merely by its reach.**

- **Actor:** the developer comparing techniques in `/dojo` (primary); the spectator on `/watch`
  (secondary — the same tapes play there)
- **Constraint today:** M3 — the renderer drives ONE endpoint to a solved target and derives the rest,
  so two moves sharing a driven limb + band are one picture apart from reach

## The colliding sets (scope)

Seven moves in three groups. The other six are already distinct and are **out of scope**
(`gyaku-zuki` rear-hand + hikite; `empi`/`hiza-geri` mid-joint; `sweep` floor height; `tobi-geri`
airborne; `throw` grab).

| Group      | Moves                                | Shared driven limb |
| ---------- | ------------------------------------ | ------------------ |
| Front foot | `mae-geri`, `yoko-geri`              | `footR`            |
| Rear foot  | `mawashi-geri`, `ushiro-geri`        | `footL`            |
| Front hand | `uraken`, `kizami-zuki`, `shuto`     | `handR`            |

## Decisions (D1–D8)

1. **Bar — recognizable convention.** Each move reads as clearly different from its same-limb siblings
   via a legible drawing cue that _evokes_ the real technique — **not** an anatomically exact
   side-profile (a single-hip 2-D figure cannot show hip rotation, the real front-vs-side-kick
   difference). Matches the viewer's already-stylized look (glyph heads, stick bodies).

2. **Where the distinctness lives — the execution is enough.** A per-move change in _how the move
   plays_ (wind-up / motion path) satisfies the goal; we do **not** have to re-sculpt every contact
   pose. (User steer: "as long as there is a change, it could be in the execution also.")

3. **Lever ambition — layered.** Reuse the existing keyframe easing first (distinct **chambers**, and
   a distinct **recovery** waypoint where useful), so the wind-up + return _paths_ differ with no new
   mechanism. Add an **arc "via" waypoint** only for moves a straight chamber→contact path cannot
   express (a roundhouse swings across; a knife-hand drops from high). Cheapest-first.

4. **Scope — the 7 colliding moves only.** Leave the 6 already-distinct moves alone. The value driver
   is the `/dojo` + `/sheet` **browsing** experience, so — unlike the arc's S4 — **telemetry usage is
   NOT the ordering principle here** (of these 7 only `mawashi-geri` is ever thrown on `/watch`, yet
   all 7 appear whenever the arsenal is browsed).

5. **`/sheet` — accept now, trail later.** `/sheet` freezes each move's contact frame
   (`contactSheetCells` poses at the first active tick). Twins that differ only in execution will still
   look alike there. The core work is verified in `/dojo`/`/watch` playback; a **`/sheet` motion-trail**
   (ghost the driven limb across its keyframes so a swing-vs-thrust reads statically) is an explicit,
   optional **follow-up story**, not required to prove the mechanism.

6. **Facing / turn — excluded from v1.** The most authentic back-kick cue is turning the fighter's
   back, but `facing` is the axis the whole projection flips around (Pixi container flip, reach
   direction, the facing-relative math in `strikeHandFor`/`reachTargetX`, the contact-mark projection).
   A mid-move turn ripples through all of it — high risk for a cosmetic gain. Rely on chamber + arc for
   back-kick character; revisit facing only if nothing else separates `ushiro` from `mawashi` by eye.

7. **Levers in v1 — chamber · arc via-waypoint · per-move contact lean/posture.** Contact lean/posture
   **is allowed** where it helps, even though at the contact frame the driven foot/hand is pinned to the
   solved target and the mid-joint is derived — so the real contact-pose freedom is **torso lean**.
   Allowing it consciously **reopens the upright-kick rule** (kicks are currently held upright; the lean
   is hand-only) and generalizes the lean from a derived hand-only value to an authored per-move one.
   Because lean is allowed, some twins **will** also differ on `/sheet` — a bonus, not a requirement.

8. **Per-move character — intended direction (exact values eye-tuned in `/dojo`).**
   - **`mae-geri` vs `yoko-geri`:** `mae` = straight front snap (as today). `yoko` = a **higher, tighter
     knee chamber** + a slight **torso lean-back** (bladed counterbalance) — edge-on, not a forward snap.
   - **`mawashi-geri` vs `ushiro-geri`:** `mawashi` = the foot **swings across in an arc** (arc waypoint,
     high-and-around). `ushiro` = a **straight back-thrust** with the torso pitched **forward** — linear,
     the opposite of the roundhouse's swing.
   - **`uraken` vs `kizami-zuki` vs `shuto`:** `kizami` = fast **straight jab**, minimal chamber.
     `uraken` = fist **cocked across the body**, whips out (arc). `shuto` = **high chamber by the ear**,
     chops **down-and-in** on an arc.

## Non-negotiable constraints

- **Web-only.** No `src/` change → engine/TCB, `INPUT_HASH`, and `BENCHMARK_VERSION` (`v19`) untouched.
  (Same discipline as the whole move-poses arc after S0.)
- **Additive / backward-compatible.** New descriptor fields are **optional**; any move that does not
  author them renders exactly as today. The 6 out-of-scope moves and every idle/finish frame are byte-
  unchanged.
- **New descriptor fields.** An arc/via waypoint and a per-move lean/posture. The `chamber` field
  already exists; a distinct `recovery` waypoint may be added.
- **Verification (web is outside Stryker).** Exact-assertion tests + a scripted **manual mutator scan**
  over the diff + a `/dojo` visual sign-off (via the Playwright screenshot driver — `agent-browser`
  hangs on Pixi canvases). Assert the **relation, not the literal** (decision-9 precedent): the
  machine-checkable proxy for "distinct" is that the driven endpoint's **trajectory** (or the torso
  lean) **differs between the two colliding moves at a representative tick** — the eye is the real judge.
- **PR per slice**, TDD (RED → GREEN → MUTATE/scan → REFACTOR).

## Carried risks (stated, not solved)

- **A straight-path arc fights the kime snap.** S8 eases `stance → chamber` over startup, then **snaps
  to the extension on the first active tick** (the _kime_ commit) and holds it. An arc waypoint on the
  chamber→contact leg would soften that snap; the arc likely belongs on the **wind-up** (stance→chamber)
  and/or **recovery** (extension→stance) legs, which are already eased, rather than on the kime. Planning
  must decide where the via point sits without dulling the strike.
- **Per-move lean reopens M9.** The upright-kick rule (`docs/archive/move-poses-decisions.md`, M9) was a
  stated design decision, pinned by a test. Authoring a kick lean must consciously amend it, not trip
  over it — expect to update that test with a documented rationale.
- **Execution-only twins stay identical on `/sheet`** until the parked trail story lands. State that in
  any PR so "the sheet still shows two the same" is not read as the fix failing.
- **The two footR / two footL pairs still share the extension endpoint.** Differentiation rides entirely
  on chamber + arc + lean; if by eye that is not enough for a given pair, per-move lean (D7) is the first
  fallback and facing (D6) the escalation — do not silently widen scope.

---

_Archive under `docs/archive/` when the work closes — do not delete (`archive-plans-not-delete`)._
