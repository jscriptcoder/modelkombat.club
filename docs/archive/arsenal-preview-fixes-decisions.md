# Arsenal move-preview fixes — resolved decisions

Grilled 2026-07-24. Two Arsenal previews read wrong: **`throw`** shows no motion at all, and
**`tobi-geri`** — the arsenal's only aerial technique — is previewed from a grounded stance.
Successor work to the completed [arsenal move-preview arc](../docs/archive/arsenal-move-preview.md)
(S1–S4, #414–#417).

## The two defects, diagnosed

### `throw` — the one pose path S8's easing never reached

`throwGrabFor` (`web/src/pages/replay/scene.ts:925`) is phase-blind. It returns a fixed grip point
for every tick:

```ts
handR: { x: reachTargetX(...), y: GRAB_Y },
handL: { x: x - GRAB_SPREAD, y: GRAB_Y },
```

`attackPhase` is never consulted, so all **23 ticks** (7 startup / 2 active / 14 recovery) render
byte-identically. This is **not a preview bug** — a real `/watch` throw is equally frozen. The
preview merely exposed it.

Root cause chain: `strikeHandFor` returns `null` for a grab (`scene.ts:897`) ⇒ `driven === null` ⇒
`easeDriven` is never called, **and** lean, hip step and girdle rotation are all zeroed
(`scene.ts:483-515`). The throw has no torso commitment whatsoever.

### `tobi-geri` — the preview tape has no airborne data

`ATTACKER_BASE` pins `posture: 0` (`web/src/pages/home/move-preview.ts:22`), `controlsToFrame` pins
`y: 0` (`web/src/pages/dojo/controls.ts:38`), and `buildDojoTape` rewrites only `x` and
`attackPhase` (`dojo-tape.ts:41-66`). The renderer already supports airborne on both inputs —
AIR stance at `scene.ts:82`, lift at `scene.ts:1044`, shrinking ground shadow at `scene.ts:1159`,
airborne hip-step suppression at `scene.ts:510` — the tape simply never supplies them.

**Compounding effect:** the descriptor authors _no chamber_ for tobi-geri
(`move-descriptors.ts:247-254`) on the stated assumption that the AIR stance's tucked `footR` **is**
the wind-up. At posture 0 that assumption is false, so `chamberFor` returns null, `easeDriven` lerps
stance→stance, and startup/recovery **hold still** — motion exists only during the 3 active ticks.
Fixing posture restores the wind-up for free.

## Engine facts established (all verified, not assumed)

| fact                                          | source                                                                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| A landed throw downs the defender             | `src/engine/sim.ts:1020`                                                                                                            |
| `sweep` downs the defender, **score 0**       | `src/engine/rules.ts:46` — _"the points live in the okizeme finish, not the sweep itself"_                                          |
| `hiza-geri` downs the defender, **score 0**   | `src/engine/rules.ts:240` — _"a clean mid hit DOWNS the foe for no score"_                                                          |
| `knockdownDuration`                           | 18 ticks (`rules.ts:315`)                                                                                                           |
| Jump arc                                      | `y += vy; vy -= gravity`, `jumpImpulse 12000` / `gravity 4000` ⇒ `12000, 20000, 24000, 24000, 20000, 12000, 0` (`rules.ts:327-339`) |
| Horizontal jump                               | `jumpXSpeed 10000`/tick ⇒ ~60000 closed over ~6 airborne ticks (`rules.ts:340-346`)                                                 |
| tobi-geri is scoring, **not** knockdown-class | `rules.ts:252-253`                                                                                                                  |
| Preview clock                                 | `PREVIEW_SPEED 0.6` × 60fps = 36 tape-ticks/sec (`PreviewStage.tsx:35`)                                                             |

**Knockdown timing** — contact is the first active tick; every knockdown move stays down past its
own tape end, so no wake-up needs modelling:

| move        | contact | tape ends | would wake |
| ----------- | ------- | --------- | ---------- |
| `throw`     | 7       | 23        | 25         |
| `sweep`     | 7       | 22        | 25         |
| `hiza-geri` | 9       | 27        | 27         |

**Displacement scale** (`BODY_HEIGHT_SUB` = 210000): vertical apex 24000 ≈ **11%** of body height;
horizontal closing 60000 ≈ **29%**. The leap is visually dominated by its _horizontal_ travel.

## Decisions

### D1 — the static throw is a `/watch` defect, fixed in the shared renderer

Author `throw` as a real descriptor (`limb: "handR"` + `grab: true` + a chamber) and route it through
`easeDriven` like every other move. `handL` derives as `handR − GRAB_SPREAD`, so the two-handed grab
holds throughout. Lean, hip step and girdle rotation return for free via M14(e).

Real `/watch` throws start animating. **S6·3's byte-identical guarantee is deliberately retired.**

**Cost is far lower than first assumed:** `scene.ts:445` reads
`phase !== 1 && phase !== 2 && phase !== 3 ? strikeHand : easeDriven(...)` — an absent `attackPhase`
bypasses easing and draws the raw solved point (the M7 totality guard). All 8 exact-coordinate throw
cases in `scene.test.tsx:887-1030` build **single-tick tapes with no `attackPhase`**, so they hit
that branch and land on today's values. **They stay green untouched.**

_Rejected:_ preview-only (would freeze `/watch` forever and break the "what you tune is what ships"
rule the dojo/preview pipeline is built on); flag-gated (two grab paths, no removal date).

### D2 — the throw stays inside the existing keyframe vocabulary

Author only a chamber. The grip is the extension (held across active); recovery's existing straight
retract `extension → stance` carries the pull. **Zero new mechanism** — the same four keyframes all
twelve other moves use. The "dump" read is carried by the target dropping prone underneath.

_Escalation, not now:_ if `/dojo` sign-off judges it weak, extend the `arcFor` via-waypoint lever to
the recovery leg (S8 already parked "per-segment curves"). Do that with evidence in hand.

_Rejected:_ a bespoke throw keyframe path — reintroduces exactly the special case S6·3 spent a slice
deleting.

### D3 — all three knockdown moves get a reacting target

`throw`, `sweep` and `hiza-geri` drop the dimmed target to `PRONE` from their contact tick, driven by
a mirrored `knockdown` column in the preset table — a table fact, not a per-move special case. Uses
the existing full-body PRONE override; no new render mechanism.

**This is not a throw fix.** For `sweep` and `hiza-geri` the knockdown is the _entire payload_ (both
score 0), so today those previews fail to show the only thing the move does. They were arguably worse
served than `throw`.

_Rejected:_ throw-only (leaves two previews under-showing their move, and makes the reaction a
special case someone must re-litigate); adding a flinch layer for the other 10 moves (no flinch
mechanism exists — a separate arc, not a slice).

### D4 — new mirrored engine data is split by kind

- **Per-move move-spec facts** → new `knockdown?: boolean` and `air?: boolean` columns on
  `ReachPreset` (`web/src/pages/dojo/reach-presets.ts`), riding its existing value-by-value drift
  test. This is the table's exact remit.
- **Global physics constants** → a small dedicated module mirroring `jumpImpulse` / `gravity` plus a
  pure `jumpArc()` that integrates `y += vy; vy -= gravity`, pinned against the sequence `rules.ts`
  documents in prose.

Matches the existing _distributed_-mirror precedent (`reach-presets.ts`'s own header cites
`scene.ts`'s `WORLD_WIDTH`).

_Rejected:_ hardcoding the 7-value arc — it mirrors a _derived_ value, so a gravity or impulse change
produces a wrong-but-green arc that the drift test can only compare to itself.

### D5 — tobi-geri's arc is faithful, over the full tape

Launch at tick 0; contact lands on the **held apex** (tick 4); touchdown tick 7; full grounded
recovery through tick 20. Matches the engine's own stated design — _"Active 3 opens the window on the
descending approach"_ and _"the LANDING recovery is punishable"_ (`rules.ts:259-262`).

| tick    | 0   | 1–3           | 4 (first active) | 5–6           | 7   | 8–20 |
| ------- | --- | ------------- | ---------------- | ------------- | --- | ---- |
| y       | 0   | 12000 → 24000 | 24000 (apex)     | 20000 → 12000 | 0   | 0    |
| posture | 0   | 2             | 2                | 2             | 0   | 0    |

**Posture is DERIVED, not authored** (refined during planning): `posture = y > 0 ? 2 : 0`. Total and
testable, with no per-tick posture list to keep in step with the arc. It correctly leaves tick 0 a
grounded launch frame (the crouch before the leap) and tick 7 a grounded landing frame — an AIR
stance drawn at y 0 would render as a figure floating on the mat.

Same full-technique tape rule as all twelve other previews — no per-move length logic. Arc (7 ticks)
is _shorter_ than the move (21), so **no tape-span change is needed**.

**Accepted costs, eyes open:**

- Airborne is ~0.17s of a ~0.58s loop (~29%); ~67% is grounded recovery. Mitigated by the recovery
  not being static (`easeDriven` retracts the foot across it) and re-settling after a landing being a
  real part of the technique.
- Posture flips 2 → 0 at touchdown, swapping the `stance`/`stanceDriven` keyframes mid-technique, so
  the retract target changes at tick 7 and **may pop**. This is exactly what `/watch` does on a real
  landing — truthful, but the preview loops it.
- `contactFrame` (the reduced-motion still) = tick 4 = the held apex, so the poster frame becomes
  airborne either way. A clear win.

_Escalation, not now:_ if sign-off says the grounded tail dominates, trim the tape a few ticks past
touchdown.

_Rejected:_ stretching the arc (breaks the arc-to-phase relationship — the exact thing we're trying
to show honestly); holding extra apex ticks (invents ticks the engine never emits, breaking the 1:1
tape-to-engine-timing property the whole pipeline rests on).

### D6 — authoring runs as pure helpers in `moveLoopTape`

Two pure, separately-testable tape transforms (jump arc; knockdown target) composed inside
`moveLoopTape`. `buildDojoTape` keeps its single job — centre two posed fighters.

- **`/sheet` retires its `AIRBORNE_MOVES` duplicate** in favour of the mirrored `air` column. Its own
  comment (`contact-sheet.ts:22-28`) justified keeping it local because posture is _"the engine's,
  not a drawing choice"_ and the sheet was _"the only place that needs it"_ — the preview now needs it
  too, and that same reasoning points at the mirror table, not the descriptor table.
- **`/dojo` stays untouched.** M10 keeps its controls raw so engine-impossible combos remain
  reachable; auto-applying an arc would override the developer's own posture control and defeat the
  lab's purpose.

_Rejected:_ pushing into `buildDojoTape` (breaks M10 — you could no longer pose a grounded tobi-geri
to inspect it).

### D7 — the jump-in x travel ships now, in the same helper

The arc transform writes per-tick `x` alongside `y`. The preview opens at `reach + 60000` ≈ 310000 and
closes to 250000 at contact, where the reach-to-target solve puts the foot on the near edge.

**This reverses an earlier "defer" recommendation.** At ~29% of body height the horizontal closing is
nearly **triple** the vertical displacement, so without it the "jump" is mostly an 11% hop and the fix
under-delivers. `rules.ts:254-256` is explicit: _"the aerial strike must be a genuine jump-IN, not a
free full-range poke."_ Marginal extra code inside a transform being written anyway.

Accepted wrinkle: a travelling attacker drifts off `buildDojoTape`'s symmetric `WORLD_MID` centring,
so framing in the small popover needs an eye-tune — not a mechanism.

### D8 — three PRs, in order

| #   | slice                                      | touches                                                                                 | surfaces                           |
| --- | ------------------------------------------ | --------------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | throw eases through `easeDriven`           | `move-descriptors.ts`, `scene.ts`                                                       | **/watch**, /dojo, /sheet, preview |
| 2   | knockdown target (throw, sweep, hiza-geri) | `reach-presets.ts` + pure transform + `moveLoopTape`                                    | preview                            |
| 3   | airborne tobi-geri (arc + x travel)        | jump-physics module + pure transform + `moveLoopTape`; retire `/sheet` `AIRBORNE_MOVES` | preview, /sheet                    |

Front-loads the only shared-renderer risk. Slice 2 is honestly named — it is a _knockdown_ slice
covering three moves, not a throw slice.

_Rejected:_ two PRs grouped by complaint (mixes a shared renderer change with preview authoring, and
files sweep/hiza-geri work under a "throw" label nobody will find); a groundwork-first PR (horizontal
— pure data, no observable behaviour change).

### D9 — `/dojo` scrub is slice 1's sign-off gate

Scrub the throw tick-by-tick in `/dojo` before and after. It renders through the identical
`scene()`/`createStage` pipeline, is deterministic and always available, and is the only surface that
shows motion across ticks on demand — which is precisely what changes. `/sheet` gives a still
cross-check; the preview becomes a second live check once slice 2 lands. A real `/watch` throw is
opportunistic confirmation, **not a gate**.

Both moves are genuinely thrown in real fights (`docs/variety.md:18,20` — `throw` 4.9%, `tobi-geri`
2.6% of commitments), but whether any archived King replay contains one isn't guaranteed, the archive
is eviction-prone and version-scoped, and `agent-browser` is known to hang on the Pixi `/watch` page.

## Scope boundaries

- **No `src/` change.** No engine, no TCB, no `INPUT_HASH`, `BENCHMARK_VERSION` held at `v19`.
- Slice 1 is the only `/watch`-visible change. Slices 2–3 are preview-side authoring over machinery
  that already ships.
- Testing per repo convention: `web/` is outside Stryker ⇒ exhaustive exact-assertion tests +
  scripted manual mutator scan + visual sign-off.

## Parked

- A recovery via-waypoint for the throw's dump (D2 escalation).
- Trimming tobi-geri's grounded tail (D5 escalation).
- A flinch/hit-reaction layer for the 10 non-knockdown moves (D3) — a separate arc.
