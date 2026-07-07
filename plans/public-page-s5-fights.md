# Plan: Public webpage — Slice 5 (fights "coming soon" teaser + nav finalize)

**Branch (this plan PR)**: docs/public-page-s5-plan
**Status**: Active
**Source of truth**: `plans/public-page-decisions.md` (decision 8 — honest "coming soon"
teaser; decision 11 — page skeleton + nav) + `plans/public-page-stories.md` (Slice 5 row +
AC-R2/R3, AC-A1/A3).

## Goal

A visitor learns that **fight replays are coming** — an honest "⏳ Fight replays — in
development" section with a **disabled, clearly-labelled play control** — and the sticky nav
links to every section. This is the **last slice**; it completes the public-page feature.

## Context (grounded in the current code)

- The page sections today (in `App.tsx`, inside `<main id="top">`): `<Hero>` → `<HowItWorks>`
  → `<Cta>` → `<King>` → `<Podium>`, then `<Footer>`. Slice 5 adds a `<Fights>` teaser after
  `<Podium>` (decision 11 order: Hero → How it works → Current King → Hall of Kings → Fight
  replays → footer).
- The nav (`Nav.tsx`) links `#how-it-works · #king · #champions · /spec` (brand → `#top`).
  Slice 5 adds a **`#fights`** anchor between Champions and Spec. `App.test.tsx` pins the nav
  href order (`["#top","#how-it-works","#king","#champions","/spec"]`) — that assertion updates.
- **Smooth-scroll + reduced-motion (AC-R2 motion) and the nav flex-wrap (AC-R2 collapse) are
  already shipped** in Slice 1c (`app.css`: `@media (prefers-reduced-motion: no-preference)`
  gate + `.nav { flex-wrap: wrap }`), and `App.test.tsx` already pins the reduced-motion gate.
  Slice 5 reuses them — no new nav mechanism (a hamburger is over-engineering for 6 links).
- **No fabricated fight rows** (decision 8; invariant #1 — fights are never persisted). The
  section is copy + a disabled control only. Persisting real title fights is the parked
  **next feature**, not this slice.

## Resolved planning decisions

1. **Disabled control uses `aria-disabled`, not the `disabled` attribute.** A real `disabled`
   button drops out of the tab order and suppresses hover/`title`, breaking AC-A1 (keyboard
   reachable) and AC-R3 (tooltip enhancement). `aria-disabled="true"` keeps it focusable and
   hoverable; with **no click handler wired**, activating it simply does nothing.
2. **The "in development" state is in the visible label, tooltip is enhancement-only.** AC-R3:
   touch devices have no hover, so the disabled state must be conveyed by **visible text/badge**
   on the control (its accessible name — AC-A3 — doubles as the visible label). The `title`
   hover tooltip is a progressive enhancement, never the sole signal.
3. **Single PR (no a/b split).** The slice is one static section + one nav link — thin enough
   for one reviewable PR. Its close-out is the **feature close-out** (see below).

## Acceptance Criteria

- [ ] A labelled **"Fight replays" region** with `id="fights"` renders after the Hall of Kings,
      headed "⏳ Fight replays — in development" with a sentence describing what's coming (replay any
      title fight tick-for-tick). No fight rows, no fabricated data (decision 8).
- [ ] **AC-A3:** the replay control is a `<button aria-disabled="true">` with the accessible name
      **"Replays — in development"** — not a bare visually-greyed button.
- [ ] **AC-R3 (touch):** the "in development" state is a **visible label** on the control (not
      hover-only); a `title` tooltip is present as an enhancement.
- [ ] **AC-A1 (keyboard):** the control is reachable in tab order with a visible focus ring (it is
      focusable because it uses `aria-disabled`, not `disabled`); activating it does nothing.
- [ ] **Nav finalize:** the sticky nav gains a **`#fights`** link between Champions and Spec —
      href order `["#top","#how-it-works","#king","#champions","#fights","/spec"]`; clicking it
      smooth-scrolls to the section (honoring `prefers-reduced-motion`, already gated).
- [ ] **AC-R1 (mobile):** the section stacks single-column at ≤360px with no horizontal scroll
      (verified on the preview, per the durable pattern).

## Slices

Follows RED → GREEN → MUTATE → KILL MUTANTS → REFACTOR. Load `tdd`, `testing`,
`mutation-testing`, `refactoring` before code. Pure presentation → **Vitest browser mode** with
strong exact assertions; no `src/`/`api/` logic → **Stryker scope unchanged**.

### Slice 5: The fights "coming soon" teaser + nav link

**Value**: A visitor sees the replay feature is coming and knows the page is a living product;
the single-page nav is complete.
**Path**: `web/src/Fights.tsx` (the labelled `#fights` section + disabled replay control) →
mount after `<Podium>` in `App.tsx`; add the `#fights` link to `Nav.tsx`; add `.fights` /
`.replay-*` CSS.
**Intentionally skipped**: real fight rows + working replay (parked next feature — needs
title-fight persistence + the Pixi viewer).
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria**: the six ACs above. **Present + confirm before code.**
**RED**:

- `Fights.test.tsx` (browser mode): (a) a labelled `region` "Fight replays" whose `id` is
  `fights`; (b) `getByRole("button", { name: /replays — in development/i })` has
  `aria-disabled="true"`; (c) that button carries a `title` (tooltip enhancement); (d) the
  "in development" wording is in the button's **visible text** (not only the title).
- `App.test.tsx`: update the nav-href assertion to include `"#fights"` before `"/spec"`; add a
  `#fights` labelled-landmark assertion on the composed page.
  **GREEN**: build `Fights.tsx`, wire it into `App.tsx`, add the nav link + CSS.
  **MUTATE**: `npm run mutation` confirms Node/Stryker scope unchanged (pure `.tsx`, no `src/`/`api/`
  change); the exact assertions (aria-disabled, accessible name, nav order) are the kill mechanism.
  **KILL MUTANTS**: strengthen any under-asserted attribute (e.g. assert `aria-disabled` is exactly
  `"true"`, not just present).
  **REFACTOR**: assess only if duplication appears (none expected — it's a leaf section).
  **Done when**: all AC met, preview-smoke (section renders + 360px no-scroll + nav link scrolls)
  passes, human approves commit.

## Pre-PR quality gate

1. `npm run mutation` — Node/Stryker scope unchanged.
2. `refactoring` assessment.
3. `npm run typecheck` · `npm run lint` · `npm run format:check`.
4. `npm test` green (node + web).
5. **Preview-smoke** on the Vercel preview URL: `GET /` renders the SPA; `/spec` · `/validate` ·
   `/fight` still respond; `agent-browser` a11y snapshot shows the `#fights` section + the
   disabled control; no horizontal scroll.

## PR / branch plan

- **This plan** → PR on `docs/public-page-s5-plan`, `docs: plan public-page Slice 5 (fights teaser)`.
- **Slice 5** → `feat/public-page-fights`, `feat(web): fights "coming soon" teaser + nav finalize (Slice 5)`.
- **Feature close-out** → `docs/public-page-closeout`. Because Slice 5 is the **last** slice, this
  close-out **also archives the spanning `plans/public-page-{decisions,stories}.md`** to
  `docs/archive/` (per the platform-http-api precedent — the spanning docs archive only when the
  whole feature ships), plus this plan; update `docs/archive/README.md` and the memory. `plans/`
  keeps the still-active `platform-http-api-{decisions,stories}.md`, so it is not emptied.

## Notes & guardrails

- **`INPUT_HASH` / `BENCHMARK_VERSION` (v19) / the TCB stay untouched** — pure web/presentation.
- **No fabricated fight data** (decision 8, invariant #1). Copy + a disabled control only.
- **Do NOT touch `docs/STATUS.md`** (engine/platform-API scope, per the S1–S4 close-outs).
- Merge PRs with `gh pr merge <N> --merge --delete-branch` (repo convention = merge commits).

---

_At this slice's close-out, archive this file **and** the spanning
`public-page-{decisions,stories}.md` to `docs/archive/` (the whole feature ships here), per
`archive-plans-not-delete`._
