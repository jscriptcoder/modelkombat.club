# Arsenal + Gauntlet — story split

> Output of a `story-splitting` session (2026-07-08) for the two new public-page (`web/`)
> sections: **the Arsenal** (showcase of the 13 techniques) and **the Gauntlet** (bios of
> the 6 frozen foes). Feeds `planning` per selected child story. **Split only — no code.**
> Arsenal design-of-record: `plans/arsenal-section-decisions.md`.

## Parent

**A visitor to modelkombat.club can understand _what a fighter is made of_ and _who it must
beat_** — the technique arsenal and the gauntlet opponents — so the "write a bot → clear the
gauntlet → challenge the King" story on the page has concrete stakes and depth.

Too large as one story because it spans two distinct, independently-valuable page sections
that weave into different points of the existing arc:
`Hero → How it works → **Arsenal** → CTA → **Gauntlet** → King → Hall of Kings → Fights`.

## The split: two whole sections, one per slice

This mirrors the **established granularity** — the first five public-page sections each
shipped as one PR (`public-page-s1..s5`). Each new section is a complete, live, visitor-facing
capability on its own. Both are **static** (typed `readonly` array + `<For>`, like
`HowItWorks`) with **no async/empty/loading/error states** — simpler than the data-driven
`King`/`Podium`, which is why neither warrants further splitting.

## Recommended First Slice

**Ship the Arsenal section** — a visitor can browse all 13 techniques, grouped by family, on
the live page.

**Why this first:** its design-of-record is _fully resolved_ (zero open questions), it has no
async states, and it establishes the "static showcase card-grid" pattern that the Gauntlet
then reuses — so we learn/adjust the card aesthetic once, on the fully-specified section,
before repeating it for the fighters.

## Split Candidates

| Slice             | Value                                                                                                                                                               | Includes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Defers                                                                                                                                      | Acceptance Examples                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Release Constraint |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| **S1 — Arsenal**  | Curious visitors / prospective bot authors see the depth & variety of the fighting system → credibility + appetite; teaches the DSL move ids + WKF scoring for free | Static `<section id="arsenal">` between How it works & CTA; all **13** techniques in **5** families (Strikes → Kicks → Close-range → Takedowns → Aerial); each card = romaji (mono) · gloss · one-line descriptor · numeric range score badge (`1`/`2`/`3`/`2·3`/`0→3`) with `aria-label`; **nav "Arsenal"** anchor after "How it works"; end-of-section **`/spec` frame-table link** (`target="_blank"`); responsive + theme per existing patterns; exhaustive exact-assertion tests (node + browser) | Gauntlet section; any interactivity (filter/hover/tabs); raw frame numbers (live in `/spec`); backfilling `tobi-geri` into `move-roster.md` | • Scroll to Arsenal → 5 family headings in order **Strikes, Kicks, Close-range, Takedowns, Aerial**.<br>• Kicks family → exactly 4 cards: `mae-geri, mawashi-geri, yoko-geri, ushiro-geri`.<br>• `mawashi-geri` badge shows **`2·3`** with an `aria-label` conveying "2 points, 3 to the head".<br>• `sweep` badge shows **`0→3`**.<br>• Nav has an **"Arsenal"** link → `#arsenal`, positioned after "How it works".<br>• End of section has a **`/spec`** link (`target="_blank"`) framed around the full frame table. | Shippable, no flag |
| **S2 — Gauntlet** | Sets the competitive stakes — "beat these six to earn a title shot" — and gives each frozen foe a memorable identity, making the CTA → King arc concrete            | Static `<section id="gauntlet">` between CTA & King; **6** fighter cards (`jabber, rekka, zoner, grappler, sweeper, vulture`) = name + authored **style bio**; **nav "Gauntlet"** anchor woven in; a per-fighter visual identity treatment (**not** the `ModelLogo`/`BrandMark` marks — these are strategy archetypes, not LLMs); responsive + theme; exhaustive exact-assertion tests                                                                                                                 | Win-rates / records (deliberately excluded — the roster is balanced ~50%); links to each bot's JSON; any live/fetched data                  | • Scroll past the CTA → a Gauntlet section with exactly **6** fighter cards, before the King section.<br>• `grappler`'s card shows its name + a style bio conveying the clinch/throw identity (exact authored text).<br>• **No** win-rate/record numbers appear anywhere in the section.<br>• Nav has a **"Gauntlet"** link → `#gauntlet`.                                                                                                                                                                               | Shippable, no flag |

## S2 Gauntlet — hardened spec (find-gaps, 2026-07-08)

Resolved detail for the S2 story, captured as confirmed. These tighten the S2 row above into
buildable acceptance criteria.

**AC-G1 — Fighter visual identity: monogram tile.** Each of the 6 fighter cards leads with a
**monogram tile** — a single uppercase letter, the first char of the fighter's name
(**G** grappler · **S** sweeper · **Z** zoner · **J** jabber · **V** vulture · **R** rekka —
all unique, no collision), in a rounded tile with a **per-archetype background tint**. No LLM
`ModelLogo`/`BrandMark` (these are strategy archetypes, not models); no bespoke SVG assets. The
tile is decorative (`aria-hidden="true"`) — the fighter name carries the accessible label. Tints
must meet text contrast in **both** light and dark themes.

- _Deferred upgrade (parking lot):_ archetype glyphs or six stickman-pose marks, if the section
  later warrants bespoke art.

**AC-G2 — Card content model.** Each fighter card shows, top to bottom: (1) the monogram tile
(AC-G1); (2) the fighter **name** in **monospace lowercase** — the literal bot `name` field,
consistent with the Arsenal's mono move-ids; (3) a one-to-two-line **style bio** (AC-G3); (4) a
**Signature** field naming the technique(s) the fighter weaponizes, rendered as a **monospace
token** (styled, **not** a hyperlink — `/spec` and `#arsenal` have no per-move anchors). Faithful
signature tokens (grounded in each bot's actual rules):

| Fighter    | Signature token      |
| ---------- | -------------------- |
| `grappler` | `throw`              |
| `sweeper`  | `sweep → gyaku-zuki` |
| `zoner`    | `ushiro-geri`        |
| `jabber`   | `kizami-zuki`        |
| `vulture`  | `uraken`             |
| `rekka`    | `tobi-geri`          |

**AC-G3 — Style bios (authoritative copy).** The card bios are exactly (faithful to each bot's
rules; this is the "exact authored text" the acceptance examples assert against):

| Fighter    | Bio                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| `grappler` | Owns the clinch. Crowd him and he throws you to the mat, then punishes the knockdown with a reverse punch.     |
| `sweeper`  | Chops your base out with a foot sweep, then cashes the knockdown for a reverse-punch finish.                   |
| `zoner`    | Fights at the fence — picks the exact-length kick for the gap and retreats the instant you close the distance. |
| `jabber`   | Death by a thousand cuts. Walks you down, reads your strike's height and blocks it, then answers with the jab. |
| `vulture`  | Patient predator. Baits the whiff, punishes it with a snap backfist — and feeds on a gassed opponent.          |
| `rekka`    | Flurry artist. Chains cancel into cancel, then leaps in for a jump-kick ippon.                                 |

**AC-G4 — Card order.** The six cards appear in the **canonical gauntlet order** —
`jabber → rekka → zoner → grappler → sweeper → vulture` — matching `GAUNTLET_NAMES`
(`src/engine/benchmark-config.ts:58`). The web **hardcodes** this order (per the decoupling
rule) with a source-of-truth comment citing `GAUNTLET_NAMES`; the test asserts the six cards
render in exactly this sequence.

**AC-G5 — Section framing (heading + lede).** `<section id="gauntlet" class="section gauntlet"
aria-labelledby="gauntlet-heading">` with `<h2 id="gauntlet-heading">The Gauntlet</h2>` (matches
the nav "Gauntlet" anchor and HowItWorks step 3 "Clear the gauntlet"). Lede, **exact copy**
(gate-framing — ties to the CTA → King arc): _"Six house fighters stand between your bot and a
title shot — beat a majority against each to earn your challenge at the King."_

**AC-G6 — Data source (mirrors the Arsenal decision).** The six fighters — order, names, bios,
signature tokens, monogram letters, archetype tints — live in a **hardcoded typed `readonly`
array** in the Gauntlet component (like `STEPS`/the Arsenal), authored from the bot rules +
`GAUNTLET_NAMES`. **No engine import; no cross-boundary drift test.** A source-of-truth comment
cites `GAUNTLET_NAMES` (`src/engine/benchmark-config.ts`) and the `bots/*.json` names. Manual
sync accepted — the gauntlet is version-frozen (v19) and a roster change is rare + PR-gated.

**AC-G7 — Fully static, non-interactive.** No data fetch (unlike `King`/`Podium`), therefore
**no loading / empty / error states**. No hover-expand, filter, or tabs. Cards are **not
interactive** in v1 — not links, no focusable controls. Linking a card to its `bots/*.json` or a
future fighter-detail view is **deferred** (parking lot).

**AC-G8 — Accessibility & responsive.** Section labelled via `aria-labelledby`; the monogram tile
is `aria-hidden="true"` with the fighter name as the accessible label; the per-archetype tint
meets **WCAG AA** text contrast in **both** light and dark themes and is **never the sole signal**
of identity (name + letter + bio carry it — no color-only meaning); cards reflow responsively
(multi-column desktop → single column at ≤360px, per existing card patterns); no motion added
(so `prefers-reduced-motion` is satisfied by construction).

**AC-G9 — No stats (positive assertion).** The section renders **no** win-rate, record, or numeric
stat for any fighter — deliberate, because the roster is balanced to ~50% inter-bot and a
leaderboard would misrepresent it. The test asserts their **absence** (already an S2 acceptance
example; restated here as the authoritative rule).

<!-- find-gaps: append resolved ACs above this line -->

## Parking Lot

- **S2's open design surface is now RESOLVED** (find-gaps, 2026-07-08 → AC-G1…AC-G9 above):
  visual identity (monogram tile), bios authored, signature tokens, ordering, framing, data
  source, static/a11y all pinned. S2 is now plannable. Two items were **deferred** out of v1:
  - **Card interactivity / links** — cards are non-interactive in v1 (AC-G7); linking each to
    its `bots/*.json` or a future fighter-detail view is a later slice.
  - **Visual upgrade** — archetype glyphs or six stickman-pose marks in place of the monogram
    tile (AC-G1), if the section later warrants bespoke art.
- **`docs/move-roster.md` is stale by one move** — `tobi-geri` never got added when the air
  capability shipped. Separate doc-only follow-up PR (not part of either web slice).
- **Roster-drift sync:** per the decisions doc, a future move's Arsenal card is added inside
  that move's own multi-PR chain (manual sync, no cross-boundary test).

## Warnings

- **Do NOT split either section by family or by fighter** (per-family / per-bot stories) or by
  layer (markup vs. data vs. tests). Those are the component-split anti-pattern: a half-arsenal
  isn't a showcase, and a single fighter card isn't a "meet the gauntlet" capability. Each
  whole section is already PR-sized and independently valuable — that's the correct grain.
- **Both slices are presentation-only** — no `src/engine` / `CANONICAL_RULES` / benchmark /
  `INPUT_HASH` change. The TCB boundary stays untouched; the web stays decoupled from the
  engine (hardcoded curated data, per the decisions doc).
- **S1 and S2 are independent** — either can ship without the other; the page order interleaves
  them but the components don't depend on each other. Recommended delivery order is S1 then S2
  only because S1 is fully specified and de-risks the shared card pattern.

## Next Step

Load **`planning`** for **S1 (Arsenal)** — the design-of-record is complete, so it goes
straight to PR-sized slices. Each implementation slice must run the full
**RED → GREEN → MUTATE → KILL MUTANTS → REFACTOR** cycle (load `tdd`, `testing`,
`mutation-testing`, `refactoring` before code). **S2 (Gauntlet)** is now fully specified
(AC-G1…AC-G9, find-gaps 2026-07-08) and equally plannable.

## Gaps closed — find-gaps session, 2026-07-08 (S2 Gauntlet)

Resolved (9 → AC-G1…AC-G9):

```
[Blocker → AC-G1]  Fighter visual identity — monogram tile (per-archetype tint, aria-hidden)
[Should  → AC-G2]  Card content model — mono name + mono signature token
[Blocker → AC-G3]  Style bios authored — all 6, faithful to each bot's rules
[Blocker → AC-G4]  Card order — canonical GAUNTLET_NAMES sequence
[Should  → AC-G5]  Section framing — "The Gauntlet" + gate-framing lede
[Should  → AC-G6]  Data source — hardcoded typed array, no engine import, no drift test
[Should  → AC-G7]  Fully static, non-interactive (no async/loading/empty/error states)
[Nice    → AC-G8]  Accessibility & responsive (contrast both themes, no color-only signal)
[Nice    → AC-G9]  No stats shown — positive absence assertion
```

Deferred (2 → Parking Lot): card interactivity / `bots/*.json` links; visual upgrade
(archetype glyphs or stickman poses). No gaps left parked-unresolved; no owner escalations.
