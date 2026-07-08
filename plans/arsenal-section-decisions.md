# Arsenal section — resolved design decisions

> Output of a `grill-me` session (2026-07-08). This is the design-of-record for the
> **Arsenal** section of the ModelKombat public page — an orientation showcase of the
> karate techniques a bot can wield. Next step: `story-splitting` (this is one slice of
> the two-section "moves + fighters" web addition), then `planning`, then TDD. **Design
> only — no code written yet.**

## What we're building

A new **static** `<section id="arsenal">` on the public page (`web/`) that showcases the
**depth and variety** of the fighting system — every technique a fighter can be built
from — grouped by family, characterful and skimmable. It slots into the page arc
**between "How it works" and the CTA** (per the parent decision: `Hero → How it works →
Arsenal → CTA → The Gauntlet → King → Hall of Kings → Fights`).

The companion **Gauntlet** section (the 6 frozen foes, style bios only) is a **separate
slice** and is _not_ covered here.

## The data reality that shaped every decision

Grounding facts discovered up front (they drove the choices below):

- **The roster is 13 techniques, not 12.** `src/engine/types.ts` `MoveId` has **11**
  named `attack` moves — `kizami-zuki`, `gyaku-zuki`, `mae-geri`, `mawashi-geri`,
  `uraken`, `shuto`, `yoko-geri`, `ushiro-geri`, `empi`, `hiza-geri`, `tobi-geri` — plus
  `sweep` and `throw` as their own action types.
- **`docs/move-roster.md` documents only 12** — it predates the air capability, so
  **`tobi-geri` (the aerial jump-in — rekka's signature jodan ippon) is absent from it.**
  Its data must come from `CANONICAL_RULES` / `docs/spec.md`, not the roster doc.
- **`docs/spec.md` (`GET /spec`, already linked in the nav) already carries the complete
  frame table** for bot authors. So the Arsenal must justify itself as something _other_
  than a second copy of that table.
- **The `web/` app is deliberately decoupled from `src/engine`.** Its `tsconfig` scopes
  to `web/src` only; there are **zero** imports from `../src`; contract types are
  _redeclared_ locally (e.g. `Champion` in `King.tsx`). `CANONICAL_RULES` is not, and
  should not become, a web import.
- **Static-section pattern is established.** `HowItWorks` defines a typed `readonly`
  array (`STEPS`) and `<For>`s over it — pure, no network. The Arsenal fits this mold
  exactly. `Podium`/`HowItWorks` supply the card-grid + `<h2 id>`/`aria-labelledby`
  conventions.
- **`web` mutation testing is node-only** (Stryker doesn't cover browser-mode), so
  web-presentation logic is pinned by **exhaustive exact-assertion** tests instead.

## Resolved decisions

1. **Purpose — orientation showcase, not a manual.** The section conveys _depth and
   variety_ ("a real fighting system: 13 distinct techniques across families, governed by
   a read-game") and builds credibility/appetite. It is **not** an authoring reference —
   `docs/spec.md` is the manual. Density is low; numbers deep-link out.

2. **Content source — hardcoded curated array, authored from `docs/move-roster.md`**
   (+ `tobi-geri` from `CANONICAL_RULES`/`spec.md`). A typed `readonly` array in the
   component, exactly like `STEPS`. A source-of-truth comment cites `move-roster.md`.
   **No engine import; no cross-boundary drift test** — the roster is currently frozen,
   and a future move already lands via a multi-PR chain where adding its card is a natural
   step. Manual sync is accepted for a showcase.

3. **Roster — all 13 techniques**, in **5 families**, ordered to build to the
   spectacular:

   | Family              | Moves                                                     |
   | ------------------- | --------------------------------------------------------- |
   | **Strikes** (hands) | `kizami-zuki` · `gyaku-zuki` · `uraken` · `shuto`         |
   | **Kicks**           | `mae-geri` · `mawashi-geri` · `yoko-geri` · `ushiro-geri` |
   | **Close-range**     | `empi` · `hiza-geri`                                      |
   | **Takedowns**       | `throw` · `sweep`                                         |
   | **Aerial**          | `tobi-geri`                                               |

   `sweep` lives under **Takedowns** (shares "knockdown → okizeme" with `throw`), keeping
   Kicks a clean 4-move standing family. Order: **Strikes → Kicks → Close-range →
   Takedowns → Aerial**. The solo Aerial family lands as a deliberate "and one more thing."

4. **Per-move fields — four, identity-level only:**
   - **Romaji id** in monospace, primary label (it _is_ the DSL token an author writes,
     e.g. `"move": "mawashi-geri"` — teaches the vocabulary for free).
   - **English gloss**, secondary label ("roundhouse kick").
   - **One-line descriptor** — authored, characterful; this is where reach/tempo/role are
     expressed in prose.
   - **Score badge** (see 6).

   **Omitted** (→ `/spec`): raw reach sub-units, startup/active/recovery ticks, stamina
   cost, cancel routes, exact bands. The _interesting_ ones fold into the descriptor prose.

5. **Layout — grouped responsive card grid.** `<section id="arsenal" class="section
arsenal">` → `<h2>The Arsenal</h2>` + one lede sentence → per family an **`<h3>`**
   heading + a `<ul class="moves">` grid of `<li class="move-card">`. Cards flow
   multi-column on desktop, stack to one column on mobile (matching existing card
   patterns). **Move ids are a styled term, NOT headings** (a `<dfn>`/`<p class="move-id">`,
   following `Podium`'s champion-name precedent) — the _families_ are the meaningful
   outline level; 13 move headings would bloat it.

6. **Score badge — numbers-only, encoding the real range.** Three shapes:
   - **Flat:** `1` (hands) · `2` (`mae-geri`, `yoko-geri`, `empi`) · `3` (`throw`).
   - **Band-conditional** (`mawashi-geri`, `ushiro-geri`, `tobi-geri`): `2·3` — 2 to the
     body, 3 (ippon) to the head.
   - **Setup / scores-0** (`sweep`, `hiza-geri`): `0→3` — no points on the hit, knocks
     down for a 3-point okizeme finish.

   WKF vocabulary (_yuko_ / _waza-ari_ / _ippon_) is taught **once in the lede** and woven
   into descriptors — **not** repeated on each badge (the range badges have no single
   term). Each badge carries a descriptive **`aria-label`** (e.g. "scores 2 points, 3 to
   the head").

7. **Connective tissue.**
   - **Nav:** insert **"Arsenal"** right after "How it works" —
     `How it works · Arsenal · King · Champions · Fights · Spec ↗`. (The Gauntlet slots in
     later, in its own slice.)
   - **`/spec` hand-off:** **one** contextual link at the **end** of the section —
     _"Reach, frames, stamina, cancels — see the full frame table → /spec"_ — reusing the
     nav's `target="_blank"` + `↗` treatment. No per-card links.

8. **Interactivity — fully static.** No hover-to-expand, no filter/search, no tabs. All 13
   cards visible at once. (A filter over 13 items is over-engineering and breaks the
   "one glance = the whole arsenal" intent.)

9. **Copy voice — terse, evocative, technically grounded**, matching the site register
   (_"A bounded JSON document — data, not code."_). Descriptors are one idea each, e.g.
   `ushiro-geri` → _"The longest, most committed strike in the game — a turn-away thrust
   you'll see coming."_ Not marketing fluff, not dry spec prose.

## Testing approach (follows the established `web` pattern)

Node + browser-mode Vitest with **exhaustive exact-assertion** tests (Stryker is node-only
on `web`, so presentation logic is pinned by exact assertions + a manual mutator scan):

- Every family heading renders (exact text), in order.
- Every one of the 13 move ids, glosses, descriptors, and score badges renders with **exact
  text**.
- Each badge exposes its descriptive `aria-label`.
- The section has `id="arsenal"` + `aria-labelledby`; the nav has the `#arsenal` anchor.
- The end-of-section `/spec` link exists with `target="_blank"`.

## Out of scope (this slice)

- The **Gauntlet** fighters section (separate slice — style bios of the 6 frozen foes).
- Any change to `src/engine`, `CANONICAL_RULES`, `move-roster.md`, `spec.md`, or the
  benchmark. This is a **presentation-only** addition to `web/`.
- Backfilling `tobi-geri` into `docs/move-roster.md` (noted as a latent doc gap; not
  required for this slice, which sources `tobi-geri` from the engine/spec).

## Latent gap surfaced (not this slice)

`docs/move-roster.md` is stale by one move — it never gained `tobi-geri` when the air
capability shipped. Worth a follow-up doc PR, tracked separately from this web work.
