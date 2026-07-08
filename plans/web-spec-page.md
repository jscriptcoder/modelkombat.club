# Plan: Human-readable spec page

**Branch**: `feat/web-spec-page`
**Status**: Slice 1 shipped (commit `22e14d3`) + Slice 2 complete — ready for PR.

## Goal

Clicking the Nav **"Spec ↗"** link opens a rendered, human-readable HTML page of the
bot-authoring spec inside the site — instead of the raw `text/markdown` dump the
`/spec` endpoint returns today.

## Decisions (locked with the human)

- **Exposure**: a **new page inside the SolidJS site** at **`/spec-guide`**, sharing the
  site's brand/footer/theme. The Nav "Spec" link points to it. **`/spec` stays raw
  markdown** (the LLM contract, unchanged), and the two other "Read the spec" links
  (`Cta` "Enter the ring", `King` "Current King") stay pointed at `/spec` — untouched.
- **Renderer**: the **`marked`** library (GFM on) converts markdown → HTML. It handles
  the frame table, ` ```jsonc ` code fences, blockquotes, and links correctly out of the
  box and stays robust as the generated spec grows.
- **Source of truth**: the page **fetches the live `/spec`** at runtime, so it renders the
  exact bytes the LLM sees (including the serve-time API-endpoint envelope). No second
  copy of the spec to drift.
- **Routing (no router dep)**: the Nav link keeps `target="_blank"`, so `/spec-guide` is a
  **fresh full page load**. `main.tsx` picks which root to render from
  `window.location.pathname`. A single shared **`SPEC_PATH`** constant feeds both the Nav
  `href` and the route test, so the link and the route can't drift.
- **Trust / security**: the rendered markdown is **our own generated spec** from a
  same-origin endpoint (trusted), so `marked` output is injected via `innerHTML` with **no
  sanitizer**. A code comment records this; if we ever render untrusted markdown, add
  DOMPurify. No `src/engine` / TCB / benchmark / `/spec` API surface is touched.

## Acceptance Criteria

Behaviour, verified by browser-mode Vitest with **exhaustive exact-assertion** (see Testing
note). `web/`-only change plus one dependency (`marked`); **no** `src/engine`, TCB,
benchmark, or `/spec` endpoint change.

- [x] Visiting **`/spec-guide`** renders the spec as a **human-readable HTML document**
      (not raw markdown) inside the site shell (shared footer, brand, dark theme).
- [x] The rendered doc reflects `/spec` bytes as **semantic HTML**: markdown headings →
      `<h1>`/`<h2>`/`<h3>`, the GFM frame table → a real `<table>` (with a known cell), a
      ` ```jsonc ` fence → `<pre><code>`, a blockquote → `<blockquote>`, bullet/numbered
      lists → `<ul>`/`<ol>`, inline `code`/**bold**/links preserved.
- [x] While the spec is loading, an accessible **status** region (`role="status"`) is shown.
- [x] On fetch failure a **distinct error state** (`role="alert"`) with a working **Retry**
      is shown — never a blank page (mirrors the `King` card's states).
- [x] The Nav **"Spec ↗"** link points to **`/spec-guide`**, keeps `target="_blank"` and the
      `↗` affordance, and derives its `href` from the shared **`SPEC_PATH`** constant.
- [x] `/spec` still returns raw markdown (endpoint untouched); the **`Cta`** and **`King`**
      "Read the spec" links still resolve to **`/spec`**.
- [x] The spec page has a **slim header**: the brand (logo + "ModelKombat") links **home
      (`/`)**, and a **"Raw markdown ↗"** link points to **`/spec`** (`target="_blank"`) for
      machine consumers.
- [x] `document.title` on the spec page names the spec (e.g. "ModelKombat — Bot authoring
      spec"), and the home page title is unchanged.
- [x] The doc is **responsive** — the wide frame table scrolls inside **its own**
      `overflow-x:auto` container, so the page never scrolls sideways at 360px — and
      theme-consistent with the rest of the site.

## Testing note (web project reality)

`web` runs Vitest **browser-mode** (Playwright/Chromium); **Stryker is node-only and its
`mutate` globs exclude `web/`** (confirmed in `stryker.config.mjs`). So this presentation
logic is pinned by **exhaustive exact-assertion tests + a mandatory manual mutator scan**,
the established pattern for `web/` sections. Specifics:

- Inject a fake **`fetchSpec`** prop (mirroring `King`'s `fetchKing`) so tests drive
  **loading / error / retry / success** deterministically without the network.
- Feed a **known small markdown fixture** and assert the **semantic HTML** it produces
  (a heading string → an `<h1>` bearing that text; a pipe table → a `<table>` with a known
  cell; a fenced block → `<pre><code>`). This kills "renderer wiring removed / replaced by
  raw text" mutants without testing `marked` itself.
- Assert the Nav link `href` is **exactly** `/spec-guide` and `target` is exactly `_blank`
  (a changed `SPEC_PATH` fails), and assert `Cta`/`King` links are **exactly** `/spec`
  (guards the "leave them alone" AC).
- `SPEC_PATH` / `isSpecRoute` live in a small `web/src/routes.ts`; a `routes.test.tsx`
  asserts `isSpecRoute("/spec-guide")` is true and `"/"` / `"/spec"` are false (so the raw
  endpoint is never captured by the SPA route).

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without a
failing test. Before code, load `tdd`, `testing`, `mutation-testing`, `refactoring`, and
`front-end-testing`.

Planned as **one PR** (a "rendered spec page" is one coherent, one-sentence behaviour),
delivered in **ordered TDD increments** — matching the established public-page precedent
(`Arsenal`, `Gauntlet`, etc. each shipped whole in one PR). _Alternative if smaller reviews
are wanted: increments 1–4 (skeleton) and 5–7 (failure + finish) could be two PRs — flagged,
not chosen._

### Slice 1: Clicking "Spec" opens a rendered, human-readable spec page

**Value**: A prospective bot author (or curious visitor) reads the spec as a styled,
scannable document — the frame table, code samples, and DSL rules laid out legibly — instead
of an unstyled markdown wall.
**Actor / Trigger / Outcome**: A visitor clicks Nav "Spec ↗" → a new tab loads `/spec-guide`
→ the spec renders as semantic HTML within the site shell.
**Path**: `Nav.tsx` "Spec" link → `SPEC_PATH` (`/spec-guide`, new tab) → fresh load →
`main.tsx` reads `window.location.pathname`, `isSpecRoute` (in `routes.ts`) selects
`SpecPage` over `App` → `SpecPage` (`createResource(fetchSpec)`, default `fetch("/spec")` →
`.text()`) renders loading `status` then `marked.parse(md)` injected as `innerHTML` inside a
slim header + shared `Footer`. `vercel.json`'s SPA catch-all already serves `index.html` for
`/spec-guide` (no dot, not `api/`) — **no `vercel.json` change**. `/spec` rewrite untouched.
Intentionally deferred to Slice 2: the error/Retry state, the "Raw markdown ↗" header link,
`document.title`, and the `.spec-doc` typographic/responsive polish.
**Required implementation skills**: load `tdd`, `testing`, `mutation-testing`,
`refactoring`, `front-end-testing` before code.
**Acceptance criteria**: ACs 2, 3, 4, 5, 6 above (the functional page — all fetch states),
plus AC 1 minus the branded header. **Present to human and confirm before writing code.**
_Boundary note: the error+Retry state (AC 4) is pulled into Slice 1 because reading a Solid
resource in its error state throws unless guarded, so the three fetch states ship together
(as in `King`); Slice 2 is then pure chrome & polish._
**RED**: (a) `routes.test.tsx`: `isSpecRoute("/spec-guide")` true, `"/"`/`"/spec"` false.
(b) `SpecPage.test.tsx`: with a pending `fetchSpec`, a `role="status"` shows; with a
`fetchSpec` resolving a known markdown fixture, the DOM contains the expected `<h1>`, a
`<table>` with a known cell, and a `<pre><code>` block; with a rejecting `fetchSpec`, a
`role="alert"` shows and a working **Retry** (fetch now resolving) renders the doc, and the
success content is absent before Retry. (c) `Nav.test.tsx`: the "Spec" link `href` ===
`/spec-guide` with `target="_blank"`, and `Cta`/`King` links still === `/spec`.
Likely mutants to pre-empt (per `mutator-rules.md`): string-literal swap on `SPEC_PATH`
(exact href assertion), boolean flip in `isSpecRoute` (both-branches assertion), removed
`innerHTML` wiring (semantic-HTML assertion), error-vs-empty confusion (assert error copy
present AND success content absent before Retry), removed Retry handler (assert click
transitions to the doc).
**GREEN**: add `marked`; `web/src/routes.ts` (`SPEC_PATH`, `isSpecRoute`); `web/src/SpecPage.tsx`
(resource + loading/success/error+Retry states, mirroring `King`, with the success body as
`marked.parse(md)` injected via `innerHTML`, plus `Footer`); route switch in `main.tsx`;
point `Nav.tsx` "Spec" link at `SPEC_PATH`.
**MUTATE**: run `mutation-testing` (node project) to confirm no regressions in mutatable
`src/`/`api/`; for `web/`, perform the manual mutator scan per the Testing note.
**KILL MUTANTS**: strengthen exact assertions for any manual-scan gap (ask the human if a
survivor's value is ambiguous).
**REFACTOR**: assess only if it adds value (e.g. a shared `renderMarkdown` helper vs inline).
**Done when**: ACs 1/2/3/5/6 met, manual scan clean, typecheck + lint + format pass, human
approves the commit.

### Slice 2: The spec page wears the site's chrome and reads like a finished document

**Value**: The page carries the site's brand, lets a visitor navigate home or grab the raw
markdown, and reads as a polished, responsive document (the wide frame table scrolls within
itself on a phone).
**Actor / Trigger / Outcome**: On the spec page a visitor can click the brand to go home or
"Raw markdown ↗" for the machine version; the tab title names the spec; the frame table
scrolls inside its own container at 360px.
**Path**: add the slim header — brand (logo + "ModelKombat") → `/`, and "Raw markdown ↗" →
`/spec` (`target="_blank"`); set `document.title`; add `.spec-doc` CSS (headings, tables in
an `overflow-x:auto` wrapper, code, blockquote, list rhythm) reusing the existing tokens
(`--border`, `--code-bg`, `--accent`, …). No new production path — chrome + polish on Slice
1's surface.
**Required implementation skills**: load `tdd`, `testing`, `mutation-testing`,
`refactoring`, `front-end-testing` before code.
**Acceptance criteria**: ACs 1 (branded header), 7, 8, 9 above. **Present to human and
confirm before writing code.**
**RED**: `SpecPage.test.tsx`: the header brand link `href` === `/` and the "Raw markdown" link
=== `/spec` with `target="_blank"`; the loaded page sets `document.title` to the spec title.
Pre-empt mutants: string-literal swaps on the two hrefs (exact assertions), removed
`document.title` assignment (assert the title after load).
**GREEN**: minimum code to pass — the two header links, `document.title`, and the `.spec-doc`
styles.
**MUTATE**: node `mutation-testing` run (no `src/`/`api/` regressions) + manual `web/` scan.
**KILL MUTANTS**: strengthen exact assertions for any gap.
**REFACTOR**: assess only if valuable.
**Done when**: ACs 4/7/8/9 met, manual scan clean, typecheck + lint + format pass, an
out-of-band `agent-browser` preview spot-check (viewport/theme) looks right, human approves.

## Pre-PR Quality Gate

1. Manual mutator scan (per Testing note) — exact-assertion coverage confirmed; run node
   `mutation-testing` to confirm `src/`/`api/` are unaffected.
2. Refactoring assessment (`refactoring` skill) — only if it adds value.
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass.
4. Out-of-band preview smoke via `agent-browser` (render `/spec-guide`, spot-check the frame
   table, code blocks, and narrow-viewport reflow), per the web-section precedent.

---

_Delete this file when the plan is complete (archive per the plans-archive rule — completed
`plans/` files move to `docs/archive/` with a README entry, never deleted). If `plans/` is
empty afterward, delete the directory._
