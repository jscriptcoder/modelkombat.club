# Plan: Public webpage — Slice 4 (SVG logo-headed hero + logo system)

**Branch (this plan PR)**: docs/public-page-s4-plan
**Status**: Active
**Source of truth**: `plans/public-page-decisions.md` (decisions 6, 10, 11) +
`plans/public-page-stories.md` (Slice 4 row + AC-L1–L3, AC-C1–C4, AC-R1, AC-A1–A4).

## Goal

A visitor is greeted by a static **SVG face-off hero** (three logo-headed stickmen in
karate stances facing center), and **every champion card shows its model's brand mark** —
replacing the `🥷` generic-head placeholders in the King and Hall-of-Kings sections.

## Context (grounded in the current code)

- The King card renders a placeholder head at **`web/src/King.tsx:54`**
  (`<div class="king-head" aria-hidden="true">🥷</div>`); the podium step at
  **`web/src/Podium.tsx:83`** (`<div class="podium-head" aria-hidden="true">🥷</div>`).
  Both already show the model as text (`.king-model` / `.podium-model`) via
  `<Show when={champion().model}>` — so the mark **accompanies** existing text (AC-L3).
- The hero today is the placeholder text block at **`web/src/App.tsx:36–37`**
  (`<h1>{SITE_NAME}</h1><p>{TAGLINE}</p>`). The `<title>`/meta (AC-M1) are already set in
  `App.tsx`. Slice 4b keeps the `<h1>` + tagline as the hero's accessible heading and wraps
  them with the SVG art.
- `Champion.model` is `string | null` (`web/src/King.tsx:5–10`).

## Resolved planning decisions (confirm at plan approval)

1. **`modelToLogo` home & test strategy — web-layer, exact-assertion, Stryker scope
   unchanged.** The classifier is pure but **web-presentation** logic (`GET /king` returns
   identity only — never a logo; the mapping happens in the browser) with no engine/`api`
   consumer. Per the **durable web rule** (Stryker's Vitest runner can't drive browser mode;
   `stryker.config.mjs` mutates only `src/**`+`api/**`), it lives under **`web/src/`** and is
   covered by a **strong exact-assertion fixture table** — _not_ Stryker. The fixture table's
   exhaustiveness over the mutation space (every alias, the precedence order, the lowercasing,
   and empty/null/undefined) **is** the mutation-kill mechanism. `npm run mutation` is run only
   to confirm the Node/Stryker scope is unaffected and still 100%.
2. **`modelToLogo` earns its own module via DRY, not testability.** It classifies a model for
   **both** the champion cards (4a) and the hero is a _fixed_ set (4b uses the brand marks
   directly, not the classifier) — the classifier's consumers are the King card + the podium
   step (same knowledge, two places). That DRY justifies the module; it is tested **through
   its consumer's observable output** (`<ModelLogo model={…}>` renders the right labeled mark),
   not as an isolated unit, honoring the testing skill.
3. **Slice split — 4a logo-system-on-cards, then 4b hero.** Mirrors the S2/S3 two-PR cadence.
   4a carries the branch-heavy classifier (de-risk the logo system first, with its exhaustive
   table) and retrofits the real data-driven cards; 4b is the pure-visual hero that reuses the
   four inline marks. Both are independently shippable.
4. **Live-throne honesty.** v19's throne is uncrowned, so 4a's card marks are **not visible on
   the live preview** (King/podium show their empty states) — the behavior ("a champion's card
   shows its model's mark") is proven by browser tests with **injected champions**, exactly as
   Slices 2b/3b proved their card behavior. 4b's hero marks are throne-independent and **are**
   visible live. Preview-smoke for 4a verifies no regression to the empty states; for 4b it
   verifies the rendered face-off + no horizontal scroll at 360px.

## Acceptance Criteria (from the hardened AC set)

- [ ] **AC-L1 (roster):** exactly four inline SVG marks — Claude, OpenAI/ChatGPT, Gemini, and a
      neutral generic "mystery challenger". No other brand marks.
- [ ] **AC-L2 (matching rule):** `modelToLogo(model)` lowercases and tests substrings in fixed
      priority `claude` → (`gpt`|`openai`|`chatgpt`) → (`gemini`|`google`|`bard`), first-match-wins;
      no match / empty / absent → generic. Pinned by the fixture table below.
- [ ] **AC-L3 (a11y):** each **card** mark has an accessible label naming the brand
      (`role="img"` + `aria-label`); the model text label accompanies it (the mark is never the only
      signal). Hero marks are decorative (the hero's `<h1>` is its accessible heading).
- [ ] **AC-C4 (absent optionals):** `model` absent (`null`) → generic mark **and** no model text
      label (never the string "null"/"undefined").
- [ ] **AC-C1 (escaping) regression:** a `<script>`-laden model still renders as inert text and
      never changes which mark is chosen (classifier operates on the raw string; Solid escapes text).
- [ ] **Hero:** visiting `/` renders three logo-headed stickmen (Claude, OpenAI, Gemini) in
      karate stances facing center; the `<h1>` heading + tagline remain.
- [ ] **AC-R1 (mobile):** at ≤360px the hero scales/stacks with **no horizontal scroll**; the
      page stays single-column.
- [ ] **AC-A4 (motion):** the hero is static; any future entrance animation must gate on
      `prefers-reduced-motion` (documented; nothing animated in this slice).
- [ ] **AC-A1/A2:** interactive elements keep a visible focus ring; dark-theme text/marks meet
      WCAG AA contrast.

## Slices

Every slice follows RED → GREEN → MUTATE → KILL MUTANTS → REFACTOR. Load `tdd`, `testing`,
`mutation-testing`, `refactoring` before any code. Solid components → **Vitest browser mode**
(exact assertions); no new Node/`src` logic → **Stryker scope unchanged**.

### Slice 4a: Every champion card shows its model's brand mark

**Value**: Returning fans see each King/predecessor branded by the LLM that authored it —
brand identity on the existing data-driven cards.
**Path**: `web/src/model-logo.ts` (pure classifier + brand→SVG registry) + `web/src/Logo.tsx`
(`<Logo brand>` inline-SVG primitive + a `<ModelLogo model>` wrapper that calls the classifier
and adds the a11y label) → retrofit `King.tsx:54` and `Podium.tsx:83` to `<ModelLogo>`.
**Intentionally skipped**: the hero (4b); live visibility of card marks (empty throne — proven
via injected fixtures).
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria**: AC-L1, AC-L2, AC-L3, AC-C4, AC-C1-regression. **Present + confirm
before code.**
**RED**: browser-mode tests driving the full classification space **through** `<ModelLogo>`
(assert `getByRole("img", { name })` for each expected mark), and through the card context
(model `null` → generic mark + no `.king-model` text). Fixture table (each row = a `<ModelLogo
model={m}>` render):

| `model`                                                 | expected mark        | proves                                                  |
| ------------------------------------------------------- | -------------------- | ------------------------------------------------------- |
| `"claude-opus-4-8"` / `"claude-3-5-sonnet"`             | Claude               | claude alias                                            |
| `"gpt-4o"` / `"openai/o1"` / `"chatgpt-4o-latest"`      | OpenAI               | all three OpenAI aliases                                |
| `"gemini-2.5-pro"` / `"google/gemini-flash"` / `"bard"` | Gemini               | all three Gemini aliases                                |
| `"GPT-4O"`                                              | OpenAI               | lowercasing (kills the `.toLowerCase()` removal mutant) |
| `"gpt-via-gemini"`                                      | OpenAI               | precedence: gpt before gemini                           |
| `"claude-vs-gpt"`                                       | Claude               | precedence: claude first                                |
| `"weirdmodel"` / `""` / `null` / `undefined`            | generic              | no-match / empty / absent                               |
| `'<script>alert(1)</script>'`                           | generic + inert text | AC-C1 regression                                        |

Every alias, both precedence orders, the case-fold, and all three empties are covered — the
exact-assertion equivalent of a Stryker pass on the classifier (per resolved decision 1).
**GREEN**: implement `modelToLogo` (lowercase + ordered `includes`, first-match-wins), the four
inline SVGs, `<Logo brand>` and `<ModelLogo model>` (`role="img"` + `aria-label="authored by
{Brand}"`, generic → a neutral label); swap the two `🥷` heads for `<ModelLogo model={…}>`.
**MUTATE**: run `npm run mutation` — confirm Node/Stryker scope is unchanged (no new `src/`/`api/`
files entered `mutate`) and still 100%. The classifier's coverage is the fixture table above.
**KILL MUTANTS**: manual mutator-rules scan (substring/precedence/lowercase/boundary) against the
table; add any missing alias/precedence fixture.
**REFACTOR**: assess the `<Logo brand>` / `<ModelLogo model>` split (keep only if the hero's
reuse in 4b makes `<Logo brand>` a real shared primitive — else inline).
**Done when**: all AC met, mutation report shows scope unchanged + 100%, human approves commit.

### Slice 4b: A logo-headed face-off hero greets the visitor

**Value**: The engaging visual hook the page was pitched on — three branded stickmen squaring off
the moment you land.
**Path**: `web/src/Hero.tsx` (inline SVG: three stickman bodies in karate stances facing center,
each topped by a `<Logo brand>` from 4a — Claude / OpenAI / Gemini) → replace the placeholder
`<h1>`+tagline block at `App.tsx:36–37`, keeping the `<h1>` + tagline as the hero's heading; add
`.hero` CSS (responsive scale/stack, dark theme).
**Intentionally skipped**: entrance animation (parked); Pixi (replay-viewer slice).
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria**: hero renders the three named marks + the `<h1>`; AC-R1 (no h-scroll at
360px); AC-A4 (static / reduced-motion note); AC-A2 contrast. **Present + confirm before code.**
**RED**: browser-mode tests — the hero renders exactly the three brand marks (Claude, OpenAI,
Gemini, identifiable by their brand hook/testid), the `<h1>` "ModelKombat" heading is present,
and the hero is a labeled region. (AC-R1's no-horizontal-scroll is verified out-of-band on the
preview via `agent-browser` at 360px, per the Slice-3 precedent — a viewport-overflow unit test
is brittle.)
**GREEN**: build `Hero.tsx`, wire it into `App.tsx`, add `.hero` styles to `web/src/app.css`.
**MUTATE**: `npm run mutation` — Stryker scope unchanged (pure-visual `.tsx`, no `src/`/`api/`
change).
**KILL MUTANTS**: none expected (no Node logic); strengthen browser assertions if any render
detail is under-asserted.
**REFACTOR**: assess extracting a `<Stickman>` sub-component (only if it removes real duplication
across the three fighters).
**Done when**: all AC met, preview-smoke (rendered face-off + 360px no-scroll) passes, human
approves commit.

## Pre-PR quality gate (each sub-slice)

1. `npm run mutation` — confirm Node/Stryker scope unchanged + 100% (web additions stay out of
   scope; classifier covered by the fixture table).
2. `refactoring` assessment.
3. `npm run typecheck` (`tsc` + `tsconfig.api.json` + `web/tsconfig.json`), `npm run lint`,
   `npm run format:check`.
4. `npm test` green (node + web projects).
5. **Preview-smoke on the Vercel preview URL** before merge (per the durable per-slice pattern):
   `GET /` renders the Solid SPA; `/spec` · `/validate` · `/fight` still respond; `agent-browser`
   a11y snapshot (4a: empty states intact; 4b: the face-off + 360px no-horizontal-scroll).

## PR / branch plan

- **This plan** → PR on `docs/public-page-s4-plan`, title
  `docs: plan public-page Slice 4 (SVG hero + logo system)`.
- **4a** → `feat/public-page-logos`, `feat(web): brand each champion by its model's logo (Slice 4a)`.
- **4b** → `feat/public-page-hero`, `feat(web): SVG logo-headed face-off hero (Slice 4b)`.
- **Close-out** → `docs/public-page-s4-closeout` (archive this plan to `docs/archive/` + README
  entry; refresh `plans/public-page-stories.md` "Next Step" to Slice 5; update the memory).

## Notes & guardrails

- **`INPUT_HASH` / `BENCHMARK_VERSION` (v19) / the TCB stay untouched** — Slice 4 is pure
  web/presentation (no engine, no `api/`, no `/spec` core change).
- **Marks are nominative inline SVGs** (simple in-house glyphs, CSP-safe, not official brand
  assets) — decision 10; keep them lightweight and inline (no external requests).
- **Do NOT touch `docs/STATUS.md`** (it tracks the engine/platform-API, not the public-page
  feature — established in the S1/S2/S3 close-outs).
- Merge PRs with `gh pr merge <N> --merge --delete-branch` (repo convention = merge commits).

---

_Archive this file to `docs/archive/` at the Slice-4 close-out (per `archive-plans-not-delete`);
the spanning `public-page-{decisions,stories}.md` stay live in `plans/` until the whole feature
ships._
