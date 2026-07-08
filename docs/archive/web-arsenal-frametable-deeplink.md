# Plan: Arsenal → rendered-spec frame-table deep link

**Branch**: `feat/web-arsenal-frametable-deeplink`
**Status**: ✅ SHIPPED — PR #224 (merged 2026-07-08). Archived.

## Goal

Make **every section of the rendered spec deep-linkable** (`/spec-guide#<section-slug>`), then
use that to land the Arsenal's **"…see the full frame table ↗"** link on the **Frame table
section** (`/spec-guide#frame-table`). The deep-link machinery is **generic** — the Arsenal link
is simply its first consumer; any component (or an external link) can target any section the
same way, with no per-section code.

## Why it needs more than a link change

`marked` (v18) does **not** add `id`s to headings, and the spec page fetches its content
**async**, so the browser's native hash-scroll fires before the target exists. Two enablers
are required alongside the link change:

1. Rendered spec headings get stable **slug ids** (`## Frame table` → `<h2 id="frame-table">`).
   _Verified_: a small dep-free custom `marked` renderer produces exactly this (inline
   code/bold still render via `this.parser.parseInline`).
2. The spec page **scrolls the hash target into view after the fetched content renders**
   (a `createEffect` on the resolved resource → `document.getElementById(hash)?.scrollIntoView()`).

## Decisions

- **Heading ids**: a **dep-free custom `marked` renderer** with a small **deduping** slugger
  (fresh per render, so a Retry re-render doesn't accumulate `-1` suffixes), not the
  `marked-gfm-heading-id` extension — keeps the web deps at just `marked`.
- **Arsenal link**: keep `target="_blank"` + the `↗` affordance (current behaviour); only the
  `href` changes to `/spec-guide#frame-table`.
- Scope: `web/`-only, **no new dependency**; **no** `src/engine` / TCB / benchmark / `/spec`
  API change. The raw `/spec` endpoint and the `Cta`/`King` links are untouched.

## Acceptance Criteria

Behaviour, verified by browser-mode Vitest with **exhaustive exact-assertion** (Stryker
excludes `web/`; manual mutator scan as usual).

- [x] The rendered spec gives **every heading** a **slug id**, generically — e.g.
      `## Frame table` → `<h2 id="frame-table">` **and** `## What ModelKombat is` →
      `id="what-modelkombat-is"` — so any section is addressable by `#slug`. Slugs are
      **deduped** (a repeated heading text yields `…-1`, and a Retry re-render still yields
      `frame-table`, not `frame-table-1`).
- [x] Existing spec rendering is unchanged (headings/table/code/blockquote/lists still render;
      the "raw markdown never visible as text" guarantee holds).
- [x] On the spec page, when `window.location.hash` names an existing section, that section is
      **scrolled into view once the fetched content has rendered**; with **no hash**, nothing
      is scrolled (the page stays at the top).
- [x] The Arsenal **"…see the full frame table ↗"** link's `href` is exactly
      **`/spec-guide#frame-table`**, keeping `target="_blank"` and the `↗`.
- [x] `/spec` (raw markdown) and the `Cta`/`King` "Read the spec" links are unchanged.

## Testing note

- **Heading id (generic)**: render a fixture with **two differently-named** headings and assert
  **each** gets its expected slug id (e.g. `h2#frame-table` and `h2#what-modelkombat-is`) — this
  proves the slugging is general, not a `frame-table` special-case. A two-**same**-heading
  fixture asserts the second gets a `-1` id (dedupe).
- **Scroll-to-hash (generic)**: spy on `Element.prototype.scrollIntoView`; with the hash set to
  an arbitrary section slug (restored after), rendering a fixture that contains that heading
  calls `scrollIntoView` on that element; with no hash it is **not** called. (Tests set the hash
  via `history.replaceState` and restore it, staying idempotent — no `beforeEach`.)
- **Arsenal link**: assert the frame-table link `href` is exactly `/spec-guide#frame-table`
  and `target` is `_blank` (kills a string-swap on the href).

## Slice: The Arsenal frame-table link deep-links into the rendered spec

**Value**: A visitor reading the Arsenal jumps straight to the authoritative frame table in the
human-readable spec — not the top of a page, and not the raw markdown.
**Actor / Trigger / Outcome**: A visitor clicks the Arsenal "…full frame table ↗" link → a new
tab opens `/spec-guide#frame-table` → the spec renders and the Frame table section is scrolled
into view.
**Path**: `SpecPage.renderMarkdown` gains a custom `marked` renderer adding deduped slug ids →
`SpecPage` gains a `createEffect` that scrolls to `location.hash` once `spec()` resolves →
`Arsenal.tsx` frame-table `href` → `/spec-guide#frame-table`. One PR (one coherent behaviour).
**Required implementation skills**: load `tdd`, `testing`, `mutation-testing`, `refactoring`,
`front-end-testing` before code.
**Acceptance criteria**: the AC list above. **Present to human and confirm before writing code.**
**RED**: `SpecPage.test.tsx` — a `## Frame table` fixture renders `h2#frame-table`; a duplicate
-heading fixture dedupes; with `#frame-table` set, `scrollIntoView` is called on that element;
with no hash it is not. `Arsenal.test.tsx` — the frame-table link href is exactly
`/spec-guide#frame-table` (`target="_blank"`). Pre-empt mutants: slug string ops (assert exact
id), dedupe off-by-one (assert `-1`), scroll guard removed (assert not-called with no hash),
href swap (exact assertion).
**GREEN**: custom renderer + deduping slugger in `renderMarkdown`; the `createEffect` scroll;
the Arsenal href change.
**MUTATE**: node `mutation-testing` (no `src`/`api` regressions) + manual `web/` scan.
**KILL MUTANTS**: strengthen exact assertions for any gap.
**REFACTOR**: assess only if valuable.
**Done when**: all ACs met, manual scan clean, typecheck + lint + format pass, an out-of-band
`agent-browser` smoke confirms the deep link lands on the Frame table section, human approves.

## Pre-PR Quality Gate

1. Manual mutator scan (exact-assertion coverage) + node `mutation-testing` (src/api unaffected).
2. Refactoring assessment — only if it adds value.
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass.
4. Out-of-band `agent-browser` smoke: open `/spec-guide#frame-table` against the rendered
   preview and confirm the Frame table heading is scrolled into view.

---

_Archive this file to `docs/archive/` at feature close (plans-archive rule), never delete._
