# Plan: `/king` endpoint link in the empty-state fallbacks

**Branch**: feat/king-fallback-endpoint-link
**Status**: Active

## Goal

Make the live King/Hall-of-Kings data discoverable to no-JS visitors (LLMs, crawlers)
by showing a link to the `GET /king` JSON endpoint inside each section's empty-state
fallback — the exact markup the prerendered HTML serves.

## Context / why

The King and Hall-of-Kings sections fetch `/king` **client-side after hydration** (see
`web/src/App.tsx`, `createClientResource`). The build-time prerender therefore bakes the
**empty-state fallback** into the static HTML — "The throne awaits" / "No champions have
been crowned yet" — never the real standings. A bot or LLM that reads the page without
running JS sees only that fallback and has no pointer to where the real data lives.

Placing a real `<a href="/king">` inside each empty fallback closes that gap: it ships in
the prerendered HTML (bot-facing) and also appears on the live site whenever a section is
genuinely empty. It keeps the deliberate "prerender never touches the network" invariant
intact (no SSR data fetch). It complements `web/public/llms.txt`, which already documents
`GET /king` for LLMs.

## Resolved design decisions

- **Where**: the `<Show>` **empty-state fallback** of each section only (King's empty
  throne, Podium's empty hall). NOT the loading or error branches — those are transient
  client states a no-JS bot never sees, and the prerender only ever renders the empty
  fallback. This is what "visible in the fallback" means.
- **Both sections link to `/king`**: each landmark self-describes its data source, so a
  bot summarising just the "Hall of Kings" region still finds the pointer. The redundant
  second link to the same endpoint is intentional and harmless.
- **Href + text mirror the existing `/spec` precedent** in `HowItWorks` (`App.test.tsx`
  asserts `href="/spec"` with link text `${CANONICAL_ORIGIN}/spec`): use `href="/king"`
  with visible/accessible text `${CANONICAL_ORIGIN}/king`. The absolute text keeps the
  endpoint legible to plain-text scrapers that read link text but don't resolve relative
  hrefs; the relative href keeps in-page navigation origin-independent. `CANONICAL_ORIGIN`
  is imported from `web/src/config.ts` (as `HowItWorks` already does).
- **Populated state hides the link**: it belongs to the empty fallback, so once a King /
  succession is present the card/podium replaces the fallback and the link is gone.
- **Copy** (final wording confirmable at implementation; the AC asserts the link, not the
  prose): a short caption beneath the existing empty line, e.g.
  - King: `Live standings are served as JSON at <a>…/king</a>.`
  - Podium: `Live standings are served as JSON at <a>…/king</a>.`
    The existing empty-state sentences are preserved verbatim.

## Acceptance Criteria

- [ ] The King section's empty-throne fallback (`current` null) renders a link with
      `href="/king"` and accessible name `${CANONICAL_ORIGIN}/king`.
- [ ] The Hall-of-Kings empty-hall fallback (`recent` empty) renders a link with
      `href="/king"` and accessible name `${CANONICAL_ORIGIN}/king`.
- [ ] When a section is populated (King present / `recent` non-empty), no `/king` fallback
      link is rendered.
- [ ] Neither the loading nor the error branch renders the `/king` fallback link.
- [ ] The prerendered / SSR HTML (`renderToString(<King/>)`, `renderToString(<Podium/>)`,
      and `renderApp()`) contains `href="/king"` — the no-JS bot-discoverability guarantee.
- [ ] The existing empty-state copy ("The throne awaits" / "No champions have been crowned
      yet") is preserved.
- [ ] No existing test regresses (nav link-set, "links to /spec", section landmarks).

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without a
failing test.

### Slice 1: Both empty-state throne fallbacks link to the live `/king` endpoint, visible in the prerendered HTML

**Value**: An LLM/crawler reading the static (no-JS) page gets a real, followable pointer
to the live `/king` JSON; a human viewing a genuinely-empty throne sees where standings live.
**Path**: `web/src/King.tsx` empty-throne `<Show>` fallback + `web/src/Podium.tsx`
empty-hall `<Show>` fallback each gain an `<a href="/king">${CANONICAL_ORIGIN}/king</a>`
caption → rendered client-side in the empty state AND baked into the prerendered HTML via
`renderApp()` (App → King/Podium fallbacks). Loading/error branches intentionally
unchanged.
**Required implementation skills**: Before code changes, load `tdd`, `testing`,
`mutation-testing`, and `refactoring`.
**Acceptance criteria**: All criteria above. **Present to human and confirm before writing
any code.**
**RED**:

- `web/src/King.test.tsx` (browser): `<King current={null} />` →
  `getByRole("link", { name: \`${CANONICAL_ORIGIN}/king\` })`has`href="/king"`; and
`<King current={champion()} />`→`queryByRole("link", …/king)`is null (populated hides
it); and`<King error={true} />`→ no`/king` link.
- `web/src/Podium.test.tsx` (browser): `<Podium recent={[]} />` → link present with
  `href="/king"`; `<Podium recent={[champ()]} />` → no `/king` link; `<Podium error />` →
  no `/king` link.
- `web/src/prerender.ssr.test.tsx` (node): `renderToString(() => <King />)` and
  `renderToString(() => <Podium />)` each contain `href="/king"`; `renderApp()` contains
  `href="/king"` (the whole-page no-JS guarantee).
- Mutator-aware gaps to pre-empt: assert the exact `href` value (string-literal mutation),
  assert the link's accessible name is the full URL (not an empty/partial mutation), and
  assert **absence** in the populated + error branches (kills a mutant that hoists the link
  out of the `<Show>` fallback into the always-rendered path).
  **GREEN**: Add the caption + anchor to each empty `<Show>` fallback; import
  `CANONICAL_ORIGIN` from `./config` in both components. Add minimal CSS class hooks
  (`king-empty-link` / `podium-empty-link`) consistent with existing empty-state classes if
  styling is needed.
  **MUTATE**: Stryker is node-only and cannot reach `web/` browser-mode components, so run a
  **manual mutator scan** (per house practice) over the two anchors: verify the `href`
  literal, the accessible-name text, and the empty-vs-populated-vs-error placement are each
  pinned by a test. The `renderApp()`/`renderToString` SSR assertions are the load-bearing
  checks — run `--project web-ssr`.
  **KILL MUTANTS**: Strengthen any assertion the scan shows unpinned (e.g. add the absence
  assertions if missing). Ask the human only if wording/link-text format is ambiguous.
  **REFACTOR**: Assess only. If the caption markup is identical across King and Podium,
  consider whether a tiny shared snippet adds value — likely NOT worth it for two lines; note
  and skip unless it clearly helps. Do not fold in the pre-existing error/status-markup
  duplication (out of scope).
  **Done when**: All acceptance criteria met, `--project web` + `--project web-ssr` green,
  typecheck/lint/format clean, manual mutator scan documented, human approves commit.

## Pre-PR Quality Gate

1. Manual mutator scan documented (browser-mode components are outside Stryker's node-only
   `mutate` scope — `src/**`,`api/**`).
2. Refactoring assessment — run `refactoring` skill.
3. `npm run typecheck`, `npm run lint`, and `format:check` (touched files only) pass.
4. Full `npm test` green.

## Notes / follow-ups (out of scope)

- Deeper bot visibility (baking the _actual_ current King into the HTML via request-time
  SSR, or a JSON-LD block) was considered and deferred — it would break the
  "prerender never fetches" invariant and/or add staleness. This slice is the low-risk
  first step and can stand alone.

---

_Delete this file when the plan is complete. If `plans/` is empty, delete the directory._
