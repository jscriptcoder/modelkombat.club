# `/replay` + Pixi stickman viewer — story split

Output of `story-splitting` (2026-07-15). Decisions source:
`plans/replay-viewer-decisions.md`. Feeds `planning` (one child story → PR-sized
slices). Actor vocabulary: **spectator** (anyone browsing/watching), **challenger** /
**King**, **operator**.

## Parent

A **spectator**, given the site, can **browse the current King's title fights and watch
them play back as two stickmen fighting** — the deferred payoff of the whole platform
(fights are bit-reproducible but have never been *seen*). Too large for one PR, and the
naive cut (engine export, then API, then viewer) is **horizontal** — none of those three
is independently watchable. Split instead into vertical, spectator-visible capabilities,
each a whole (thin) end-to-end path from the archive to pixels on screen.

**Success metric:** a spectator opens the site, finds the King's fights, plays one, and
sees a faithful stickman re-enactment of a real archived bout — with nothing fabricated
(invariant #1) and no bot document exposed (decision 1).

## Recommended First Slice

**S1 — Watch the King's latest title fight (walking skeleton).** A spectator opens the
viewer page and the most-recent watchable archived fight **auto-plays**: two stickmen move
along the floor (X + facing) with a live **score/tick HUD** and play/pause.

**Why this first:** it's the **tracer bullet** — it pulls the entire production path
through end-to-end in one thin vertical: the new engine `renderTape` export → `GET
/replay` (resolve which fight) + `GET /replay/{id}` (the reconstructed tape, docs never
leaked) → a Pixi page that animates it. It retires the biggest unknown (does
archive→reconstruct→tape→Pixi actually animate a real bout, byte-faithfully?) at the
lowest feature cost, and it's genuinely demonstrable (you can watch a real fight, just
crudely). Postures, the browsable list, and transport all build on this spine.

## Split Candidates

| Slice | Value | Includes | Defers | Acceptance Examples | Release Constraint |
|---|---|---|---|---|---|
| **S1 · Watch the King's latest fight** (walking skeleton) | Spectator: sees a real archived title bout re-enacted — proves the whole reconstruct→render pipeline | New engine **`renderTape(cfg)`** sibling (rich per-tick frames; byte-identical, TCB-untouched); **`GET /replay`** minimal (resolve newest watchable fight, content-hash id, bootstrap-filtered) + **`GET /replay/{id}`** returns the headline-bout tape (challenger vs `defenders[0]` at `seeds[0]`) + the two fighters' display identities (`name`/`model`), **never docs** (reconstruction reuses the arena's exact `rules`/`maxTicks`/`match`; `GET /replay/{id}` carries `Cache-Control: immutable` + a `/fight`-style WAF backstop); a **Pixi viewer page** auto-playing that tape — two stickmen at their X positions, facing, a score/tick HUD, autoplay + play/pause/restart, with loading / fetch-error (retry) / not-found (back-to-list) states; pure `scene(tape,tick)` model + display-object assertions | Full posture rendering; browsable list UI; scrub/speed; drill-down to other defenders/seeds; historical versions | `GET /replay/{id}` for a real record → tape of rich frames + both identities, **no bot documents** in the body · an unknown / evicted / malformed / bootstrap id → `404 /problems/replay-not-found` (no fight run) · opening the page → the newest fight auto-plays; two figures move to their per-tick X, face each other, HUD shows the running score + tick; pause halts, restart returns to tick 0 · reconstructed motion is **byte-faithful** to `runFight` (a tape-vs-fight equality test on the same pinned params) · viewer shows loading, a retryable fetch-error, and a no-retry "fight no longer available" 404 state | Shippable (read-only, safe); the route ships **dark** — unlinked from the Nav (see **Nav visibility**), independent of S2 |
| **S2 · See the fighters do karate** (postures) | Spectator: the bout *looks* like a fight — the emotional payoff (bargain: most of the "wow" for a viewer-only change) | Render the full posture vocabulary from the **same tape** (no API/engine change — `renderTape` already emits the fields): crouch, jump arc (Y), guard-by-band, strike-by-band (punch/kick extension at high/mid/low), throw grab, knockdown/prone, wake-up; **score pops** when points rise; hit/whiff read-through | Scrub/speed; list UI; visual juice (particles/camera/sound) | croucher vacates high → a high strike visibly whiffs over them · a jumper follows the gravity arc and a sweep passes under · a guard raises to the incoming band; a mismatched guard is struck · a throw shows a grab; a knockdown shows a prone figure then wake-up · a scored point flashes + increments the HUD | Shippable — this is the "show it off" release |
| **S3 · Browse the King's fights** (the list) | Spectator: discovers *which* fights exist and picks one — the explicit "list all the king's fights" ask | Enrich **`GET /replay`** to the identities-only collection (challenger `name`/`model` vs King `name`/`model`, newest-first, bootstrap-filtered, zero fights run); a **browsable list UI** (cards) in `web/`; click-through to the player; **shareable permalink** per fight (`/{id}`). The route ships **dark** — **no primary-Nav link** and the existing "Fight replays — in development" teaser stays a non-link; reachable only by direct URL / permalink (see **Nav visibility**) | Verdict/outcome badges; drill-down to non-headline bouts | list shows one card per real title attempt, **newest-first by reversed append order, no date shown**, no bootstrap entries, identity = `name`+`model` only (`model` absent → name-only; no handle, none in archive) · two cards with identical challenger-vs-King names are disambiguated by a short content-hash fragment · empty archive → `200` + `[]` → honest empty state · click a card → its fight plays; the URL is a shareable permalink that deep-links back (and gracefully 404s if the fight has since evicted) | Shippable — completes the "browse + watch" loop |
| **S4 · Control playback** (transport) | Spectator: rewatch the decisive moment, study a fight frame-by-frame | Scrub bar (seek to any tick), speed multiplier, frame-step; playhead reflects scrub | — | drag the scrub bar → the scene jumps to that tick deterministically · 0.5×/2× changes playback rate; frame-step advances one tick · scrubbing backward then playing resumes correctly | Shippable polish |

> **Reconciled with find-gaps (2026-07-15):** the split *structure* (S1–S4, ordering) is
> unchanged — every gap resolved was an error path, non-functional quality, or UI state
> that folds into an existing slice, not a new capability. S1/S3 acceptance examples above
> were refreshed to carry the error contract, reconstruction-param provenance, caching, and
> viewer async states. See `plans/replay-viewer-decisions.md` for the full detail.

## Parking Lot

- **Drill-down to non-headline bouts** — watch the challenger vs *each* defender, or other
  seeds (decision 2 deferred the drill-down). Additive; `/replay/{id}` gains a bout
  selector.
- **Per-entry verdict badge** — "beat the King / lost" in the list (decision 3 deferred;
  costs re-running fights on list load).
- **Historical-version replay** — retired ladders (decision 4 deferred; needs
  rules-snapshotting, a separate large capability).
- **Visual juice** — particles, hit sparks, camera work, sound; Pixi headroom (why Pixi
  was kept, decision 9). Pure viewer.
- **Surface `/watch` in the Nav + teaser** — the viewer ships **dark** (Nav visibility
  decision, 2026-07-16): no primary-Nav link and the "Fight replays — in development"
  teaser stays a non-link, so the route is reachable only by direct URL / permalink until
  we deliberately promote it. Wiring both entry points is the deferred follow-up.
- **Not standalone stories (planning-level PR slices):** the `renderTape` engine export and
  the `/replay` endpoints are *implementation slices inside* S1 (and S3 grows the
  collection) — never split out as their own component stories.

## Warnings

- The input sequence (engine → API → viewer) was **horizontal/component-shaped**; none of
  the three is independently watchable. Reframed into vertical capabilities (S1 tracer →
  S2 postures → S3 list → S4 transport). Watch that `planning` doesn't re-collapse S1 into
  "wire renderTape" / "wire endpoint" / "wire page" as if they were the deliverables —
  keep the **watch-a-real-fight outcome** as S1's done bar, proven by the byte-faithful
  tape-vs-fight test.
- **S2 vs S3 ordering is negotiable.** Recommended S2 (make one fight compelling) before S3
  (browse many), because the posture payoff is the higher-value bargain; but if "browse the
  list" is the priority ask, S3 can precede S2 — both build only on S1.
- **Doc-privacy is load-bearing** (decision 1): every `/replay` response ships motion +
  `name`/`model` identities only. A slice that returns bot documents breaks KotH integrity
  — call it out in review.
- S1 is multi-PR at the planning level (engine slice + endpoint slice + Pixi-page slice);
  that's expected — it's one *capability*, sliced into PRs by `planning`, not four stories.

## Next Step

Load **`planning`** for **S1** to turn it into PR-sized TDD slices (likely:
① `renderTape` engine export, ② `GET /replay` + `/replay/{id}`, ③ Pixi walking-skeleton
page). Every implementation slice runs the full RED-GREEN-MUTATE-KILL-MUTANTS-REFACTOR
cycle — load `tdd`, `testing`, `mutation-testing`, `refactoring` before code. Optionally
run `find-gaps` on this split first to harden S1's acceptance examples.
