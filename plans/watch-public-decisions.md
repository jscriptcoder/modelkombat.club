# Opening `/watch` to the public — resolved decisions

A `grill-me` pass (2026-07-25) resolving the decision tree behind promoting the replay
viewer from its dark launch to a public, linked feature. This is the deliberate revisit
that `docs/archive/replay-viewer-decisions.md` § "Nav visibility — dark launch" parked as
_"Reversible — revisit when we promote the feature."_

Every decision below is **resolved**; the parked items at the end are recorded, not built.

## Facts that framed the tree

Established by reading the code before any decision was put:

- **`/watch` is complete and unlinked.** The list (`ReplayList`) and the permalink player
  (`ReplayFight`) both ship, wrapped in the shared `Nav`/`Footer` (`ReplayApp.tsx`). It is
  absent from `web/public/sitemap.xml` and has no nav entry.
- **The home `Fights` section is a placeholder.** `web/src/pages/home/Fights.tsx` renders a
  heading, a "coming soon" paragraph, and a **disabled** button (`aria-disabled="true"`).
- **The home page prerender does not await resources.** `renderToString`
  (`web/src/prerender/entry-server.tsx`) renders the client-gated King/Podium fetches as
  their empty fallback. So an LLM or crawler fetching `/` already sees fallbacks, never live
  data — a new client-fetched section neither improves nor degrades that.
- **`llms.txt` never mentions fights.** It lists `/spec`, `/ring`, `/validate`, `/fight`,
  `/king`, home, `/variety`.
- **`/replay`'s list is one card per submission** — each record's bout against the King
  (`handle-replay.ts`). The sibling bouts are reachable inside the player via `matchups`.
- **`/king` reads only the arena** (`handle-king.ts`); `/replay` is the sole archive reader.
- **The pin key already exists.** `ArenaMember.seniority` ↔ `ReproRecord.memberSeniority`
  keeps every live member's entry record un-evictable — an exact join key. Bot names are
  **not** unique; seniority is.
- **`ReproRecord` carries no run params.** It stores `{challenger, defenders, seeds,
version, memberSeniority}`, and reconstruction injects the **current**
  `rules`/`maxTicks`/`match`. Replaying an older version's record would silently use today's
  parameters. It is safe across v19→v20 only because that bump was a pure season wipe with
  an unchanged `INPUT_HASH` — coincidence, not a guarantee.
- **Version bumps are deliberate**, and old keys are **orphaned, not deleted**
  (`src/engine/benchmark-config.ts`).

## D1 — Primary job: spectacle for newcomers

The feature's job is that a **first-time visitor sees LLMs actually fighting without
hunting for it**. The home page keeps its current structure, sections, order, and copy; the
only section that changes is the dead `Fights` placeholder. Entry points are the home
section, the nav, the sitemap, and `llms.txt`.

Rejected as _primary_ (both remain valuable, see parking): the submitter feedback loop
(`/ring` result → replay deep links) and ladder-history drill-down as the lead entry point.

## D2 — The home section renders the newest 3 fight cards

`GET /replay`, newest 3, each an `<a href="/watch/{id}">` reusing the `/watch` card look
(model logo + name, `vs`), with a "Watch all fights →" link beneath. Three cards — not one —
because a single card reads as a demo while three imply a running ladder.

No dates and no ordinals on cards, consistent with the existing identities-only decision
(`replay-viewer-decisions.md` § list ordering).

## D3 — The nav's `Fights` item repoints to `/watch`

`Fights` stops scrolling to `/#fights` and navigates to `/watch`. The nav stays at 7 items
and the label keeps its meaning. `Nav`'s `current` prop gains a `"watch"` value so `/watch`
renders `aria-current="page"`. The home section **keeps `id="fights"`** so existing
`/#fights` links still resolve.

Rejected: adding a second `Watch` item (8 items, two entries for one concept) and leaving
the nav untouched (`/watch` would be unreachable from `/ring` or from a permalink).

## D4 — One static frame serves prerender, loading, empty, and error

The section's static frame — heading + one honest sentence + a real `<a href="/watch">` —
**is** the prerendered output, **and** the loading state, **and** the empty state, **and**
the error state. Cards layer on top when they arrive.

Rationale: the frame has to exist for the prerender regardless, so reusing it costs nothing;
it avoids a third possible red `role="alert"` stacked on a marketing landing page; and it
produces no layout shift. `/watch` itself keeps its loud, retryable states — that is where a
visitor who came to watch actually wants them.

This also makes S1 (below) a genuine prerequisite artifact rather than scaffolding: S1's
static CTA _is_ S2's fallback state.

## D5 — `llms.txt` advertises `/replay` as a scouting tool

`GET /replay` is added under **API endpoints**, framed honestly: the bare list is small
(ids + identities); `/replay/{id}` returns one bout's full tick-by-tick tape — **how the King
actually moves, without ever exposing its DSL**. An explicit size caveat (~100–300 KB; fetch
a tape only to analyze it) is included so a reading model does not blow its context by
reflex.

The public item URL is `/replay/{id}`; `vercel.json` rewrites it to `/api/replay?id=$1`.
`llms.txt` must advertise the public form.

`/watch` is added under **Optional** as the human viewer for the same data.

Note: this advertises a capability that is **already public** — the endpoint is
unauthenticated. Doc-privacy is unaffected; behavior was always observable, the DSL never is.

## D6 — 👁 links to the champion's entry bout

The affordance targets `/watch/{entry bout vs the then-King}`. One id per champion is
sufficient: the player's existing matchup switcher exposes the other bouts of that same
gauntlet run, so no new API surface is needed beyond the id itself.

Rejected: a champion-scoped filtered list (`/watch?champion=…`), which would additionally
cover title _defenses_ but needs a new route, a new `/replay` query param, filtering logic,
and its own states.

## D7 — `/king` resolves `replayId` server-side, best-effort

Each member identity in the `GET /king` projection gains `replayId: string | null`, resolved
by finding the archived record whose `memberSeniority` equals that member's `seniority`, then
taking that record's first bout id (`boutReplayIds(record)[0]`).

- **Join on seniority, never on name.** Names are not unique; a name-based client-side join
  would silently resolve to the wrong fight with no way to detect it.
- **Best-effort.** If the archive read throws, members are returned with `replayId: null`.
  `/king` must never 503 over an archive problem — it feeds the home page's King and Arena
  sections.
- **Cost.** `/king` now also reads the archive (~0.36 MiB typical, ~1.4 MiB worst case),
  bounded by its existing `public, max-age=30` cache.
- A member with no record — a seeded House champion, a bootstrap crown — yields `null`.

## D8 — Live season only, labelled honestly

`/watch` continues to serve the current version's archive. The copy says so ("this season's
title fights", and older seasons are archived and not currently browsable) rather than
implying a complete history.

Nothing is destroyed: previous versions' archives sit orphaned but intact in Redis, so a
future cross-version story can still recover them. Cross-version replay is **not** a filter
change — it needs run-param provenance on `ReproRecord` (see parking).

Within the current season the answer is already yes: a deposed King's fights stay watchable —
their record un-pins on relegation and then survives while it remains inside the newest-100
window.

## D9 — 👁 on the Current King card and all three podium cards

Both the standalone `Current King` section and Gold/Silver/Bronze in `The Arena` carry the
icon. The King's icon and Gold's icon lead to the same `/watch/{id}` — the same `replayId`
from the same `/king` payload, so it costs an extra usage, not extra data.

A `replayId: null` member renders **no icon at all**, not a disabled one. The icon is a link
with a real accessible name (e.g. "Watch warden's road to the throne"), never a bare emoji.

## D10 — Three slices

| Slice                       | Scope                      | Ships                                                                                                                              |
| --------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **S1 — promote**            | `web/` only, no new fetch  | nav → `/watch`, dead button → real CTA, sitemap entry, `llms.txt` entries, season labelling. **`/watch` is public after this PR.** |
| **S2 — live cards**         | `web/` only, `GET /replay` | newest 3 cards, degrading to S1's frame                                                                                            |
| **S3 — road to the throne** | `src/` + `web/`            | `/king` → `replayId` (best-effort join), 👁 on the King + 3 podium cards                                                           |

Each PR is independently valuable and independently revertible. Only S3 touches `src/`, so
only S3 carries the full TDD + mutation regime; S1 and S2 are `web/`-only and inherit the
established web testing regime (not Stryker-reachable ⇒ exhaustive exact-assertion browser
tests + a mandatory manual mutator scan).

Only `/watch` enters `sitemap.xml` — **not** `/watch/{id}` permalinks, which are
content-hashed and evictable.

## Deferred (parking)

- **Cross-version replay.** Blocked on run-param provenance: `ReproRecord` must carry the
  `rules`/`maxTicks`/`match` it was fought under (or a version→params registry must exist),
  plus a multi-key archive read, a season dimension in the `/replay` contract and UI, and a
  decision about existing records that predate the provenance field.
- **Raising or pinning K** beyond 100 for longer retention (previously parked at K=50, since
  raised to 100).
- **A commit `timestamp` on `ReproRecord`** for real date display on cards.
- **`/ring` result → per-board-row replay deep links.** Cheap — `/fight` already stamps
  `boutReplayIds` on board rows — and the natural next arc after S3.
