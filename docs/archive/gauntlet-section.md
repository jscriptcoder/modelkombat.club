# Plan: Gauntlet section (S2)

**Branch**: `feat/web-gauntlet-section`
**Status**: ✅ SHIPPED — all 4 increments merged in **PR #220** (2026-07-08). All AC-G1…AC-G9 met.
Archived together with the spanning `arsenal-gauntlet-stories.md` + `arsenal-section-decisions.md`
now that S2 has landed, closing the Arsenal + Gauntlet feature.
**Design-of-record / Story + ACs**: `plans/arsenal-gauntlet-stories.md` (S2 row + **AC-G1…AC-G9**,
find-gaps 2026-07-08). Sibling shipped slice: `docs/archive/arsenal-section.md` (S1 — the
pattern this reuses).

## Goal

A visitor scrolling past the CTA sees **the Gauntlet** — the six house fighters they must beat
to earn a title shot — each a card with a monogram tile, its mono lowercase name, an authored
style bio, and its signature technique(s), plus a "Gauntlet" nav anchor.

## Slicing rationale (one PR)

Planned as **a single PR**, matching the established public-page precedent (every prior section
— `HowItWorks`, `Arsenal`, `Podium`, `Fights` — shipped whole in one PR). The Gauntlet is one
static section that **reuses the Arsenal's static showcase-card pattern** (typed `readonly`
array + `<For>`), so integration risk is trivial and there is no half-section state worth
shipping separately. TDD proceeds in **ordered increments inside** the slice (each leaves the
suite green). _The story split (`arsenal-gauntlet-stories.md`) explicitly forbids splitting the
section by fighter or by layer — a single fighter card isn't a "meet the gauntlet" capability._

## Acceptance Criteria

Behaviour, verified by node + browser-mode Vitest with **exhaustive exact-assertion** (see
Testing note). Presentation-only — **no** `src/engine` / `CANONICAL_RULES` / benchmark /
`INPUT_HASH` / `BENCHMARK_VERSION` change; the web stays decoupled from the engine.

- [ ] The page renders a `<section id="gauntlet" aria-labelledby="gauntlet-heading">` with
      `<h2 id="gauntlet-heading">The Gauntlet</h2>` + the exact gate-framing lede, positioned
      **between** `Cta` ("Enter the ring") and `King` ("Current King") in `App.tsx`. _(AC-G5)_
- [ ] Exactly **6 fighter cards** render, in the **canonical gauntlet order**
      `jabber → rekka → zoner → grappler → sweeper → vulture` (matching `GAUNTLET_NAMES`,
      `src/engine/benchmark-config.ts`). _(AC-G4)_
- [ ] Each card shows, top to bottom: a **monogram tile** (single uppercase first letter —
      **J·R·Z·G·S·V** — `aria-hidden="true"`, decorative); the fighter **name** in **monospace
      lowercase** (the literal bot `name`); a one-to-two-line **style bio** (exact authored text);
      and a **Signature** field rendering the technique token(s) as a **monospace, non-link**
      token. _(AC-G1, AC-G2, AC-G3)_
- [ ] The Signature tokens are exactly: `jabber`→`kizami-zuki`, `rekka`→`tobi-geri`,
      `zoner`→`ushiro-geri`, `grappler`→`throw`, `sweeper`→`sweep → gyaku-zuki`,
      `vulture`→`uraken`. _(AC-G2)_
- [ ] The nav has a **"Gauntlet"** link → `#gauntlet`, positioned immediately after "Arsenal".
      New nav order: `#top · #how-it-works · #arsenal · #gauntlet · #king · #champions · #fights · /spec`.
- [ ] The section renders **no numeric stat** — no win-rate, record, or number for any fighter
      (positive-absence assertion; the copy is deliberately digit-free — the lede reads "Six",
      not "6"). _(AC-G9)_
- [ ] Fully **static** — no data fetch, no loading/empty/error states, no interactivity (cards
      are not links or focusable controls). _(AC-G7)_
- [ ] Fighter data lives in a **hardcoded typed `readonly` array** in the component with a
      source-of-truth comment citing `GAUNTLET_NAMES` (`src/engine/benchmark-config.ts`) and the
      `bots/*.json` names. No import from `src/engine`. _(AC-G6)_
- [ ] Section is responsive (multi-column desktop → single column ≤360px) and theme-aware, per
      existing card patterns; the monogram tile is `aria-hidden` so the fighter name carries the
      accessible label; identity is **never colour-only** (letter + name + bio carry it). _(AC-G8)_

## Testing note (web project reality)

`web` runs Vitest **node + browser-mode** projects; **Stryker is node-only**, so this
presentation logic is pinned by **exhaustive exact-assertion** tests **+ a mandatory manual
mutator scan** — identical to the Arsenal (`Arsenal.test.tsx`): assert exact
names/monograms/bios/signature-tokens so a renamed or reordered constant fails; use
paragraph-unique phrases so empty-copy is caught; assert the monogram's `aria-hidden` so a
label-leak is caught. The fighter data is a pure static array with **no branchy logic** (no
derived values — bios/tokens are authored, engine semantics stay out of the web), so there is no
node-mutatable pure function; coverage comes from the exact-assertion suite + manual scan, as
with every other `web` section. Independent EXPECTED data is **hardcoded in the test**, NOT
imported from the component.

## Note — theme scope (spec vs. reality)

AC-G1/AC-G8 call for tint contrast "in both light and dark themes", but the shipped site is
**dark-only** (`app.css` has a single `:root { color-scheme: dark }`; there is no light theme or
`prefers-color-scheme` block, and `App.test.tsx` asserts a dark background). So the **testable**
contrast requirement is **WCAG AA against the dark theme** (the only theme). The letter colour
will track a theme variable (e.g. `var(--fg)`) so it stays legible if a light theme is added
later. Contrast is verified by the manual/agent-browser smoke, not an automated assertion (as
with all `web` CSS). Flagging so the "both themes" wording isn't read as a missing requirement.

## Slice: The Gauntlet section renders live on the public page

**Value**: Sets the competitive stakes — "beat these six to earn a title shot" — and gives each
frozen foe a memorable identity, making the CTA → King arc on the page concrete.
**Actor / Trigger / Outcome**: A visitor scrolls past the CTA → the Gauntlet section is visible →
they see 6 named fighters with identity, bio, and signature technique, before the King section.
**Path**: `web/src/Gauntlet.tsx` (new, static `readonly` data + `<For>`, like `Arsenal`) →
mounted in `App.tsx` between `Cta` and `King` → nav anchor in `Nav.tsx` → CSS in `app.css` →
deployed to modelkombat.club. Intentionally skipped: async states (none exist), interactivity,
per-card `bots/*.json` links (parking lot), any stats.
**Required implementation skills**: Before code, load `tdd`, `testing`, `mutation-testing`,
`refactoring`, and `front-end-testing` (browser-mode Vitest patterns).
**Acceptance criteria**: the AC list above. **Present to human and confirm before writing code.**

**Ordered TDD increments** (each RED→GREEN→(MUTATE via exact-assertion + manual scan)→REFACTOR,
each leaves the suite green):

1. **Skeleton + wiring + monogram identity** — RED: a test asserting the page shows a
   `#gauntlet` region named "The Gauntlet" with a paragraph-unique lede phrase; exactly 6 cards
   in canonical order, each with its mono lowercase name (`.fighter-name`) and its monogram tile
   (`.fighter-monogram`, exact letter, `aria-hidden="true"`). Plus `App.test.tsx`: nav order gains
   `#gauntlet` after `#arsenal`, and the Gauntlet region sits **after** "Enter the ring" and
   **before** "Current King" (via `compareDocumentPosition`). GREEN: the `Gauntlet` component
   (fighters `readonly` array + `<For>`) + mount in `App.tsx` between `Cta` and `King` +
   "Gauntlet" nav link. This is the walking skeleton — the section is live.
2. **Style bios** — RED: each card renders its exact authored bio (AC-G3), asserted in order
   (paragraph-unique phrase per fighter). GREEN: add the `bio` field + render (`.fighter-bio`).
3. **Signature tokens** — RED: each card renders its exact signature token (AC-G2) as a mono,
   non-link token, in order. GREEN: add the `signature` field + render (`.fighter-signature-token`
   inside a labelled "Signature" field). Assert the token is **not** an anchor (no `href`).
4. **No-stats invariant + a11y/responsive/tint polish** — RED: the section's `textContent`
   matches **no digit** (`/\d/`) and no `%` (AC-G9). GREEN/verify: per-archetype tint CSS +
   responsive roster grid (reuse the `.arsenal-moves` idiom: `repeat(auto-fill, minmax(min(100%,
…), 1fr))`) + theme classes; re-confirm the monogram `aria-hidden` and region labelling. Add
   cheap assertions where they strengthen the scan.

**MUTATE**: exhaustive exact-assertion + manual mutator scan (per Testing note) — confirm a
renamed name/monogram/bio/signature-token, a reordered roster, a dropped card, or a leaked
monogram label fails a test.
**KILL MUTANTS**: strengthen exact assertions for any gap the manual scan finds (ask the human if
a survivor's value is ambiguous).
**REFACTOR**: assess only if it adds value (e.g. a shared card sub-component vs. inline) — the
data array is the source of truth; keep it flat and readable, mirroring `Arsenal.tsx`.
**Done when**: all ACs met, the manual mutator scan is clean, typecheck + lint + format pass, and
the human approves the commit.

## Data appendix (authoritative content — from AC-G2/G3/G4)

Canonical order (`GAUNTLET_NAMES`), monogram = first letter, bios + signature tokens verbatim
from `plans/arsenal-gauntlet-stories.md`:

| #   | Name (mono) | Monogram | Signature token      | Bio                                                                                                            |
| --- | ----------- | -------- | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | `jabber`    | **J**    | `kizami-zuki`        | Death by a thousand cuts. Walks you down, reads your strike's height and blocks it, then answers with the jab. |
| 2   | `rekka`     | **R**    | `tobi-geri`          | Flurry artist. Chains cancel into cancel, then leaps in for a jump-kick ippon.                                 |
| 3   | `zoner`     | **Z**    | `ushiro-geri`        | Fights at the fence — picks the exact-length kick for the gap and retreats the instant you close the distance. |
| 4   | `grappler`  | **G**    | `throw`              | Owns the clinch. Crowd him and he throws you to the mat, then punishes the knockdown with a reverse punch.     |
| 5   | `sweeper`   | **S**    | `sweep → gyaku-zuki` | Chops your base out with a foot sweep, then cashes the knockdown for a reverse-punch finish.                   |
| 6   | `vulture`   | **V**    | `uraken`             | Patient predator. Baits the whiff, punishes it with a snap backfist — and feeds on a gassed opponent.          |

Lede (exact, AC-G5): _"Six house fighters stand between your bot and a title shot — beat a
majority against each to earn your challenge at the King."_

## Pre-PR Quality Gate

1. Manual mutator scan (per Testing note) — exact-assertion coverage confirmed.
2. Refactoring assessment (`refactoring` skill) — only if it adds value.
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass.
4. Out-of-band preview smoke via `agent-browser` (viewport/theme/contrast spot-check), per the
   web section precedent.

---

_Archived on feature close (per the plans-archive rule): this file **and** the spanning
`arsenal-gauntlet-stories.md` + `arsenal-section-decisions.md` were moved to `docs/archive/` when
S2 landed (PR #220) — all three archived together, closing the Arsenal + Gauntlet feature._
