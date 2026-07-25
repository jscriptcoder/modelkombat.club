# Opening `/watch` to the public — child stories

Split of the parent capability into three independently valuable child stories. Every
product decision behind these is resolved in **`plans/watch-public-decisions.md`** (D1–D10);
this file is the story artifact that feeds `planning`.

## Parent

**A visitor who lands on modelkombat.club can find and watch the fights that decided the
ladder — and a reading LLM can find the same archive as machine-readable data.**

- **Actor:** a first-time visitor; secondarily a reading LLM and a search crawler.
- **Capability:** discover that fights exist, watch one, and trace a champion back to the
  bouts that put them on the board.
- **Outcome:** the site stops _telling_ people that LLMs fight and starts _showing_ it.
- **Current constraint:** `/watch` is complete but dark — no nav entry, absent from the
  sitemap, unmentioned in `llms.txt`, and the home page advertises replays with a **disabled
  button**. The only way in is to already know the URL.

## Recommended first slice

**S1 — A visitor can reach the fight viewer from anywhere on the site.**

Why this first: it is the whole headline capability at the smallest possible cost. It adds
no fetch, no new render states, and no `src/` change — it is content and links only — yet
after it merges `/watch` is genuinely public, indexable, and reachable from every page. It
also produces the artifact S2 depends on (D4: the static frame _is_ S2's fallback state), so
none of it is scaffolding. And it generates the feedback that tells us whether S2 and S3 are
worth building: do people click through, and do LLMs start pulling `/replay`?

## Split candidates

| Slice                          | Value                                                             | Includes                                                                                                                                                      | Defers                                              | Release   |
| ------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------- |
| **S1 — Reach the viewer**      | `/watch` becomes discoverable to humans, crawlers, and LLMs       | Nav `Fights` → `/watch` (+ `aria-current`); home section's disabled button → real link; `sitemap.xml` entry; `llms.txt` entries; season labelling on `/watch` | Any home-page fetch; cards; 👁; cross-version       | Shippable |
| **S2 — See the latest fights** | A visitor sees real fighters on the landing page without clicking | Home section fetches `GET /replay`, renders the newest 3 cards linking to `/watch/{id}`; "Watch all fights →"                                                 | Dates, ordinals, previews, pagination, 👁           | Shippable |
| **S3 — Road to the throne**    | A visitor traces any champion to the fight that seated them       | `/king` members gain `replayId` (best-effort `seniority` ↔ `memberSeniority` join); 👁 link on the Current King card + Gold/Silver/Bronze                     | Title defenses, champion-scoped list, cross-version | Shippable |

---

## S1 — A visitor can reach the fight viewer from anywhere on the site

**Value:** the fight viewer stops being a URL you have to be told about. Humans get a nav
entry and a real link where a dead button used to be; crawlers get a sitemap entry; reading
LLMs get the fight archive named in `llms.txt` as a scouting tool.

**Scope**

- Nav's `Fights` item navigates to `/watch` instead of scrolling to `/#fights`; `Nav`'s
  `current` prop gains `"watch"` so `/watch` renders `aria-current="page"` (D3).
- The home `Fights` section becomes heading + one honest sentence + a real
  `<a href="/watch">`; the `aria-disabled` button is gone. The section keeps `id="fights"`
  (D3, D4).
- `sitemap.xml` gains `/watch` — and only `/watch` (D10).
- `llms.txt` gains `GET /replay` under **API endpoints** (both public URL forms, framed as
  studying the King's behavior without its DSL, with the payload-size caveat) and `/watch`
  under **Optional** (D5).
- `/watch`'s own copy states that it shows the **current season's** fights and that older
  seasons are archived and not currently browsable (D8).

**Intentional deferrals:** no fetch is added to the home page, so no loading/empty/error
states exist yet — that is S2. No 👁 — that is S3. Cross-version browsing is parked.

**Acceptance examples**

1. Given the home page, when a visitor activates the nav **Fights** item, then the browser
   navigates to `/watch` — it is an `<a href="/watch">`, not a same-document anchor.
2. Given `/watch`, then the nav's **Fights** item carries `aria-current="page"`.
3. Given the **prerendered** home HTML (JS disabled), then the Fights section contains a link
   whose `href` is `/watch`, and contains **no** element with `aria-disabled="true"`.
4. Given the home page, then the Fights section still carries `id="fights"`, so an existing
   `/#fights` link still resolves to it.
5. Given the home page, then the string "in development" appears nowhere on it.
6. Given `sitemap.xml`, then it contains exactly one `<loc>` for
   `https://modelkombat.club/watch`, and no `<loc>` matching `/watch/` + an id.
7. Given `llms.txt`, then the **API endpoints** section names `GET /replay`, both the list
   URL `/replay` and the item URL `/replay/{id}`, and a payload-size caveat; and the
   **Optional** section names `/watch`.
8. Given `/watch` with fights present, then the page states the fights shown are the current
   season's, and states that older seasons are archived and not currently browsable.

**Release constraint:** shippable. `/watch` is public the moment this merges.

---

## S2 — A visitor sees the three most recent fights without leaving the home page

**Depends on S1** — this story's loading, empty, and error states are _literally_ S1's static
frame (D4). If the order is ever flipped, S2 has to build that frame itself.

**Value:** the landing page shows named LLM fighters that actually fought each other, which
is the "spectacle for newcomers" job (D1). Three cards rather than one, because one reads as
a demo while three imply a running ladder (D2).

**Scope**

- The home `Fights` section fetches `GET /replay` — a second, **independent** fetch alongside
  the existing `/king` one.
- Renders the newest 3 entries as cards reusing the `/watch` card look (model logo + name,
  `vs`), each an `<a href="/watch/{id}">`, with "Watch all fights →" beneath.
- Loading, empty, and error all render S1's static frame unchanged.

**Intentional deferrals:** no dates or ordinals on cards (D2, consistent with the existing
identities-only decision); no thumbnails or animated previews; no pagination; no 👁.

**Acceptance examples**

1. Given `/replay` returns 3 or more fights, then the section renders exactly 3 cards, in the
   order `/replay` returned them, each an `<a>` whose `href` is `/watch/` + that fight's id.
2. Given `/replay` returns 1 or 2 fights, then exactly that many cards render — no
   placeholders for the missing slots.
3. Given `/replay` returns `[]`, then the section renders exactly the S1 static frame.
4. Given `/replay` rejects (503 or a network failure), then the section renders exactly the S1
   static frame — no `role="alert"`, no Retry button.
5. While `/replay` is in flight, the section renders exactly the S1 static frame.
6. Given a rendered card, then it shows both fighters' names and both model logos, and shows
   no date and no ordinal.
7. Given the section has rendered cards, then "Watch all fights →" links to `/watch`.
8. Given `/king` fails while `/replay` succeeds, then the fight cards still render; and given
   `/replay` fails while `/king` succeeds, then the King and Arena sections still render.

**Release constraint:** shippable.

---

## S3 — A visitor can jump from a champion to the fight that put them on the board

**Value:** answers "who did this King actually beat?" in one click, from the most-read part of
the home page. One id per champion is enough — the player's existing matchup switcher exposes
the sibling bouts of the same gauntlet run (D6).

**Scope**

- `GET /king`'s member projection gains `replayId: string | null`, resolved by finding the
  archived record whose `memberSeniority` equals the member's `seniority` and taking that
  record's first bout id (D7).
- The archive read is **best-effort**: on failure every member comes back with `replayId:
null` and the response stays 200.
- The Current King card and all three Arena podium cards render a 👁 link to
  `/watch/{replayId}` when it is non-null (D9).

**Intentional deferrals:** title _defenses_ (only the entry run is reachable); a
champion-scoped filtered list; cross-version.

**Acceptance examples**

1. Given an arena member whose entry record is in the archive, then `GET /king` returns that
   member with `replayId` equal to that record's **first** bout id — the bout against the
   then-King.
2. Given a member with no matching record (a seeded House champion, a bootstrap crown), then
   their `replayId` is `null`.
3. Given the archive read throws, then `GET /king` still responds **200** with every member's
   `replayId` `null` — never 503.
4. Given the **arena** read throws, then `GET /king` still responds 503, unchanged.
5. Given two members that share a `name` but differ in `seniority`, then each resolves to its
   own record's id — the join is on seniority, never on name.
6. Given a member with a non-null `replayId`, then their card renders a link to
   `/watch/{replayId}` whose accessible name identifies that champion (e.g. "Watch warden's
   road to the throne").
7. Given a member whose `replayId` is `null`, then their card renders no icon and no link at
   all — not a disabled one.
8. Given the King is also Gold on the podium, then both cards link to the same `/watch/{id}`.

**Release constraint:** shippable. Only this slice touches `src/`, so it carries the full
TDD + mutation regime; S1 and S2 are `web/`-only and inherit the established web regime
(`web/` is not Stryker-reachable ⇒ exhaustive exact-assertion browser tests + a mandatory
manual mutator scan).

---

## Warnings

- **S3 must stay vertical.** The tempting split — "`/king` returns `replayId`" then "cards
  render 👁" — makes the first half a component story with no observable user outcome, which
  is the exact red flag this skill warns about. Keep the contract change and the affordance
  in one PR.
- **S1 bundles two audiences** (human nav/CTA and the LLM/crawler channel). That is a
  legitimate interface-dimension grouping, and both halves are static content edits with no
  shared runtime risk. It _could_ be split S1a/S1b if you want smaller PRs — but shipping the
  nav without `llms.txt` leaves the LLM-readability goal unmet for a whole cycle, so the
  recommendation is to keep them together.
- **S2's independence is soft**, by design (D4). It is a deliberate dependency on S1's frame,
  not an accident. Do not reorder without giving S2 its own fallback.
- **S3 has no code dependency on S1 or S2**, but shipping it first would link into an
  unadvertised route. Keep it third.
- **Two-fetch home page.** S2 makes the home page fetch `/king` and `/replay` independently.
  AC 8 pins that neither failure can take out the other's section.
- **Deliberate, not a defect:** `replay.html`'s canonical is `/watch` for `/watch/{id}` too,
  since both are served by the same SPA shell. That is correct — permalinks are
  content-hashed and evictable, so we do not want them indexed independently. Recorded rather
  than "fixed".
- **Verified non-issue:** `replay.html` already carries title, description, canonical, OG
  tags and `robots: index, follow`, and `robots.txt` allows everything. S1 needs only the
  sitemap entry, no SEO work.

## Parking lot

Carried from `plans/watch-public-decisions.md`:

- **Cross-version replay** — blocked on run-param provenance on `ReproRecord`; without it an
  old fight silently reconstructs under current rules.
- **Raising or pinning K** beyond 100 for longer retention.
- **A commit `timestamp` on `ReproRecord`** for real date display on cards.
- **`/ring` result → per-board-row replay deep links** — cheap (`/fight` already stamps
  `boutReplayIds` on board rows) and the natural next arc after S3.

## Next step

Load `planning` for **S1** to turn it into PR-sized implementation slices. Every
implementation slice must load `tdd`, `testing`, `mutation-testing`, and `refactoring` and
complete RED → GREEN → MUTATE → KILL MUTANTS → REFACTOR before the next slice starts.
