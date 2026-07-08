# Plan: Arsenal section (S1)

**Branch**: `feat/web-arsenal-section`
**Status**: ✅ SHIPPED — all 5 increments merged in **PR #218** (2026-07-08). All ACs met.
Archived (S1 plan); the spanning `arsenal-gauntlet-stories.md` + `arsenal-section-decisions.md`
stay live in `plans/` until S2 (The Gauntlet) also lands, then all archive together.
**Design-of-record**: `plans/arsenal-section-decisions.md` · **Story/ACs**: `plans/arsenal-gauntlet-stories.md` (S1)

## Goal

A visitor scrolling the public page sees **the Arsenal** — all 13 karate techniques grouped
into 5 families, each card showing its mono move-id, gloss, one-line descriptor, and numeric
score badge — with an "Arsenal" nav anchor and an end-of-section link to the full `/spec` frame
table.

## Slicing rationale (one PR)

Planned as **a single PR**, matching the established public-page precedent (each prior section
— `HowItWorks`, `Podium`, `Fights` — shipped whole in one PR). The Arsenal is one static section
with trivial integration risk (it mirrors the `HowItWorks` pattern: a typed `readonly` array +
`<For>`), and splitting it into skeleton/badges/descriptors PRs would only create half-styled
production states with no risk-burndown. TDD proceeds in **ordered increments inside** the slice
(each leaves tests green). _Alternative if smaller reviews are wanted: increments 1 / 2–3 / 4–5
could be three PRs — flagged, not chosen._

## Acceptance Criteria

Behaviour, verified by node + browser-mode Vitest with **exhaustive exact-assertion** (see
Testing note). Presentation-only — **no** `src/engine` / `CANONICAL_RULES` / benchmark change.

- [ ] The page renders a `<section id="arsenal" aria-labelledby="arsenal-heading">` with
      `<h2 id="arsenal-heading">The Arsenal</h2>` + one lede sentence, positioned **between**
      `HowItWorks` and `Cta` in `App.tsx`.
- [ ] Exactly **5 family** `<h3>` headings render, in order: **Strikes · Kicks · Close-range ·
      Takedowns · Aerial**.
- [ ] Each family lists exactly its moves, in order (**13 cards total**):
  - Strikes = `kizami-zuki, gyaku-zuki, uraken, shuto`
  - Kicks = `mae-geri, mawashi-geri, yoko-geri, ushiro-geri`
  - Close-range = `empi, hiza-geri`
  - Takedowns = `throw, sweep`
  - Aerial = `tobi-geri`
- [ ] Each card shows its **romaji id** (monospace), **English gloss**, a **one-line
      descriptor**, and a **score badge** — all with the exact text in the Data appendix.
- [ ] Score badges render the range encoding exactly: `1` / `2` / `3` / `2·3` / `0→3`, and each
      badge carries a descriptive `aria-label` (per the Data appendix).
- [ ] The nav has an **"Arsenal"** link → `#arsenal`, positioned immediately after "How it works".
- [ ] The section ends with **one** link to `/spec` (`target="_blank"`, `↗` affordance) framed
      around the full frame table; no per-card `/spec` links.
- [ ] Fully **static** — no data fetch, no loading/empty/error states, no filter/hover/expand.
- [ ] Move data lives in a **hardcoded typed `readonly` array** in the component with a
      source-of-truth comment citing `docs/move-roster.md` (+ `tobi-geri` from `CANONICAL_RULES`).
      No import from `src/engine`.
- [ ] Section is responsive (multi-column desktop → single column ≤360px) and theme-aware, per
      existing card patterns.

## Testing note (web project reality)

`web` runs Vitest **node + browser-mode** projects; **Stryker is node-only**, so this
presentation logic is pinned by **exhaustive exact-assertion** tests **+ a mandatory manual
mutator scan** (established pattern: assert exact move-ids/glosses/descriptors/badges so a
renamed constant fails; use paragraph-unique phrases so empty-copy is caught; assert the badge
`aria-label` by exact text so an `aria-hidden`/label leak is caught). The move data is a pure
static array with **no branchy logic** (badge strings are authored, not derived — keeping engine
score-semantics out of the web), so there is no node-mutatable pure function; coverage comes from
the exact-assertion suite + manual scan, as with the other `web` sections.

## Slice: The Arsenal section renders live on the public page

**Value**: Prospective bot authors / curious visitors see the depth & variety of the fighting
system (credibility + appetite) and learn the DSL move-ids + WKF scoring for free.
**Actor / Trigger / Outcome**: A visitor scrolls the public page → the Arsenal section is
visible → they see 13 techniques grouped by 5 families with identity + score.
**Path**: `web/src/Arsenal.tsx` (new, static `readonly` data + `<For>`, like `HowItWorks`) →
mounted in `App.tsx` between `HowItWorks` and `Cta` → nav anchor in `Nav.tsx` → deployed to
modelkombat.club. Intentionally skipped: async states (none exist), interactivity, per-card links.
**Required implementation skills**: Before code, load `tdd`, `testing`, `mutation-testing`,
`refactoring`, and `front-end-testing` (browser-mode Vitest patterns).
**Acceptance criteria**: the AC list above. **Present to human and confirm before writing code.**

**Ordered TDD increments** (each RED→GREEN→(MUTATE via exact-assertion + manual scan)→REFACTOR,
each leaves the suite green):

1. **Skeleton + wiring** — RED: a test asserting the page shows a `#arsenal` section with
   `<h2>The Arsenal</h2>` + lede, 5 family `<h3>`s in order, and all 13 mono move-ids + glosses
   in the right family/order. GREEN: the `Arsenal` component (families→moves nested array,
   double `<For>`) + mount in `App.tsx` + "Arsenal" nav link after "How it works". This is the
   walking skeleton — the section is live.
2. **Score badges** — RED: each card renders its exact badge text (`1`/`2`/`3`/`2·3`/`0→3`) and
   the badge's exact `aria-label`. GREEN: add the badge + aria-label fields to the data + render.
3. **Descriptors** — RED: each card renders its exact one-line descriptor (paragraph-unique
   phrase per move). GREEN: add the descriptor field + render.
4. **`/spec` hand-off** — RED: an end-of-section link to `/spec` with `target="_blank"` and the
   frame-table framing text. GREEN: add the link.
5. **Responsive/theme + a11y polish** — verify (browser-mode) the section labelling
   (`aria-labelledby`), reflow, and theme classes match existing sections; add assertions where
   cheap.

**MUTATE**: exhaustive exact-assertion + manual mutator scan (per Testing note) — confirm a
renamed move-id/gloss/descriptor/badge/aria-label or a dropped family/link fails a test.
**KILL MUTANTS**: strengthen exact assertions for any gap the manual scan finds (ask the human if
a survivor's value is ambiguous).
**REFACTOR**: assess only if it adds value (e.g. shared card sub-component vs. inline) — the data
array is the source of truth; keep it flat and readable.
**Done when**: all ACs met, the manual mutator scan is clean, typecheck + lint + format pass, and
the human approves the commit.

## Data appendix (authoritative content — drafts to confirm at increment 1)

Faithful to `docs/move-roster.md` + `CANONICAL_RULES` (`tobi-geri`). Descriptors are drafts in the
site's terse-technical voice; confirm/tweak when building increment 1.

| Family          | id (mono)      | Gloss           | Badge | Badge `aria-label`                                                | Descriptor (draft)                                                         |
| --------------- | -------------- | --------------- | ----- | ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Strikes**     | `kizami-zuki`  | jab             | `1`   | scores 1 point                                                    | Fast lead-hand poke — the tempo-setter that opens the cancel chain.        |
| Strikes         | `gyaku-zuki`   | reverse punch   | `1`   | scores 1 point                                                    | The power hand and cancel hub — every combo routes through it.             |
| Strikes         | `uraken`       | backfist        | `1`   | scores 1 point                                                    | Cheapest, shortest hand — a gas-proof jodan snap and combo starter.        |
| Strikes         | `shuto`        | knife-hand      | `1`   | scores 1 point                                                    | The longest-reaching hand, out-ranging even the reverse punch.             |
| **Kicks**       | `mae-geri`     | front kick      | `2`   | scores 2 points                                                   | The straight-line body kick — a reliable waza-ari from mid range.          |
| Kicks           | `mawashi-geri` | roundhouse kick | `2·3` | scores 2 points, 3 to the head                                    | Arcs to the body for two, or over the guard to the head for the ippon.     |
| Kicks           | `yoko-geri`    | side kick       | `2`   | scores 2 points                                                   | A beyond-neutral thrust that out-reaches even the roundhouse.              |
| Kicks           | `ushiro-geri`  | back kick       | `2·3` | scores 2 points, 3 to the head                                    | The longest, most committed strike — a turn-away thrust you'll see coming. |
| **Close-range** | `empi`         | elbow strike    | `2`   | scores 2 points                                                   | Shortest reach in the game — a point-blank two-point payoff.               |
| Close-range     | `hiza-geri`    | knee strike     | `0→3` | scores no points on the hit, but knocks down for a 3-point finish | The only standing mid-band knockdown — it sets up a three-point finish.    |
| **Takedowns**   | `throw`        | throw           | `3`   | scores 3 points                                                   | Clean takedown for the instant ippon — the anti-turtle answer.             |
| Takedowns       | `sweep`        | foot sweep      | `0→3` | scores no points on the hit, but knocks down for a 3-point finish | Chops the base out; scores nothing, but the okizeme finish pays three.     |
| **Aerial**      | `tobi-geri`    | jumping kick    | `2·3` | scores 2 points, 3 to the head                                    | Leap in from range for a head-height ippon — the only airborne strike.     |

Lede (draft): _"Thirteen real karate techniques — every fighter is built from these. Scores run
1 yuko · 2 waza-ari · 3 ippon."_
`/spec` link text (draft): _"Reach, frames, stamina, cancels — see the full frame table → /spec"_.

## Pre-PR Quality Gate

1. Manual mutator scan (per Testing note) — exact-assertion coverage confirmed.
2. Refactoring assessment (`refactoring` skill) — only if it adds value.
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass.
4. Out-of-band preview smoke via `agent-browser` (viewport/theme spot-check), per the web
   section precedent.

---

_Delete this file when the plan is complete (archive per the plans-archive rule with the rest of
the feature). If `plans/` is empty, delete the directory._
