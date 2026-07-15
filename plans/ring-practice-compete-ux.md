# Plan: `/ring` two-step practice → claim UX

**Branch**: feat/ring-practice-compete-ux (Slice 1) · feat/ring-claim-staleness (Slice 2)
**Status**: Active

## Goal

Turn the `/ring` page into the deliberate two-step the platform now supports: a submit runs a
footprint-free **practice** projection (where the bot *would* land), and a separate, deliberate
**claim** actually competes (`X-Compete: true`) — so a human couriering an iterating LLM never
crowns a throwaway.

## Context / source of truth

This is **Slice 2 — web UX** from the shipped practice/compete split
(`docs/archive/practice-compete-decisions.md`, and its archived plan
`docs/archive/fight-practice-compete.md`). Slice 1 of that feature shipped the API + all contract
copy and made the ring send `x-compete: true` on its single submit **purely to keep crowning while
this UX was built** (`RingPage.tsx:57`). This plan removes that stop-gap and builds the real flow.

**API is already done** — practice returns `{ ...report, projection }`, compete returns
`{ ...report, title }`, identical `placement` shape (`{ outcome, rank?, board, displaced? }`). No
`src/` change here; this is a **`web/`-only** feature. Per the house pattern, `web/**` is outside
Stryker → **exact-assertion browser tests + a manual mutator scan** (the `RingPage.test.tsx` /
`King.tsx` precedent), not a Stryker run.

## Resolved UX decisions (grill-me, 2026-07-15)

| #   | Decision | Choice | Rationale |
| --- | --- | --- | --- |
| R1  | **Flow shape** | Submit = practice → render `projection` → deliberate claim button → second POST `X-Compete: true`. Stateless (decision #4): claim is a fresh POST of the same fields, no token. | Pre-settled by the split's decisions doc; matches "iterate free, commit once." |
| R2  | **Claim-button gating** | Show the claim button **only** for a `crowned` or `entered` projection. `unplaced` shows "cleared but wouldn't place" with **no** button. | Claiming an `unplaced` bot changes nothing visible (arena byte-identical; only the not-yet-built `/replay` archive grows). No confusing no-op CTA. |
| R3  | **Staleness guard** | Editing the doc textarea **or** the handle clears the whole result + claim button; the user re-runs practice for a fresh projection. | Guarantees the claimed artifact === the previewed artifact — a claim can never crown an un-previewed bot. One rule. (Slice 2.) |
| R4  | **Claim in-flight / failure** | Claim reuses the existing spinner + error banners. Success → the committed `title` result (with the "See the throne" link) replaces the projection. A `409 throne-moved` on claim → existing banner; its **retry re-runs practice** so the user re-previews the moved arena before re-claiming. | The arena moved, so the old projection is stale; re-previewing is the honest next step. |
| R5  | **Claim label** | Outcome-aware: **"Take the throne"** for a `crowned` projection, **"Claim your place"** for an `entered` projection. | Each CTA says exactly what the click does; no mismatch (an `entered` bot seats as a defender, it doesn't take the throne). |
| R6  | **Projection framing** | Projection headline is hypothetical ("This bot would dethrone the reigning King" / "would enter the arena at #n" / "clears the gauntlet, but wouldn't crack the top ranks"); board label reads "The arena defenders you'd face"; **no** throne link on a projection. Committed (`title`) keeps today's strings + link + "…you fought". | A projection must never read as a real crown (mirrors API decision #5: `projection` ≠ `title`). |

## Acceptance Criteria (whole plan)

- [ ] A bare submit sends `x-compete: "false"` (practice) and renders the `projection` — hypothetical
      headline, "defenders you'd face" board, **no** throne link.
- [ ] A `crowned`/`entered` projection shows an outcome-aware claim button; an `unplaced` projection shows
      the "wouldn't crack the top ranks" line and **no** button; an uncleared bot shows neither.
- [ ] Clicking claim sends `x-compete: "true"`; on success the committed `title` result (throne link for a
      crown) replaces the projection.
- [ ] A `409 throne-moved` on claim surfaces the banner; its retry re-runs **practice**.
- [ ] Editing the doc or the handle after a projection clears the result + claim button (Slice 2).
- [ ] The live ring never loses crowning across either merge (each deploy is consistent).

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. No production code without a failing test.
Load `tdd`, `testing`, `mutation-testing`, `refactoring` before code. `web/**` is outside Stryker →
exact-assertion browser tests + a manual mutator scan (state it in the PR).

### Slice 1: The ring previews a projection, then a deliberate claim crowns

**Value**: A human couriering an iterating LLM sees where the bot *would* land and only crowns when they
deliberately click — iterating stops polluting the ladder, and the happy path still crowns end-to-end
(deploy stays consistent; no crowning is lost vs today).
**Actor / Trigger / Outcome**: Ring user → submits a clearing bot → sees a projection, clicks the
outcome-aware claim button → the committed title (+ throne link for a crown) replaces it.
**Path**: `RingPage` submit → `postFight({ doc, handle, compete: false })` (new `compete` on the seam;
`postFightToApi` sends `x-compete: compete ? "true" : "false"`) → render `body.projection` via a shared
placement view-model that reads **either** `projection` (preview) **or** `title` (committed) and carries a
`committed` flag → claim button (R2/R5) fires `postFight({ …, compete: true })`, reusing the existing
loading/error path (R4); success replaces `result` with the committed body. Intentionally **not** in this
slice: the edit-clears-result staleness guard (R3) — the happy path (run → claim without editing) is
complete and deployable; the guard is Slice 2.
**Required implementation skills**: load `tdd`, `testing`, `mutation-testing`, `refactoring` before code.
**Acceptance criteria** (confirm before coding):
  - Practice submit posts `x-compete: "false"` (fetch-spy asserts the exact header value) and renders the
    projection headline for each outcome: crowned-empty-board, crowned-non-empty-board ("would dethrone the
    reigning King"), entered-#n ("would enter the arena at #n"), unplaced ("wouldn't crack the top ranks").
  - A projection renders the board under "The arena defenders you'd face" and shows **no** "See the throne"
    link (exact-absence assertion).
  - Claim button: present + labelled "Take the throne" for crowned, "Claim your place" for entered; **absent**
    for unplaced and for an uncleared bot (exact-absence assertions — kills a "show button always" mutant).
  - Clicking claim posts `x-compete: "true"` (fetch-spy), and the committed `title` body it returns replaces
    the projection: committed headline ("dethroned the reigning King!"), "…defenders you fought", and — for a
    crown — the "See the throne" link now present.
  - A `409 throne-moved` returned by the claim shows the throne-moved banner; its retry issues a **practice**
    POST (`x-compete: "false"`), asserted via the fetch-spy call sequence.
  - Regression: an uncleared bot still shows "Didn't clear the gauntlet." and the raw-JSON copy block.
**RED**: `RingPage.test.tsx` — drive each state through the injected `postFight` seam (return canned
`projection` / `title` / problem bodies via the factory pattern; no real network). Mutator-aware: assert the
**exact** header value on both POSTs (kills "send any/empty value"), the **exact** button label per outcome
and its **absence** for unplaced/uncleared (kills gating mutants), that a projection has **no** throne link
and a crown title **does** (kills a "link always/never" mutant), and the practice-retry header on
throne-moved (kills "retry re-competes").
**GREEN**: add `compete` to the `PostFight` seam + `postFightToApi`; a `placementView(body)` returning
`{ committed, outcome, rank, board } | null` keyed on `title` vs `projection`; outcome-aware headline/label
helpers; a `claim` action posting `compete: true`; render the button only for a non-committed
crowned/entered view.
**MUTATE**: `web/**` is outside Stryker — manual mutator scan over the new helpers/JSX against
`mutator-rules.md` (header value, outcome equality, button gating, link gating, headline branches); record
the scan in the PR.
**KILL MUTANTS**: strengthen any exact-assertion the scan finds unguarded.
**REFACTOR**: assess folding the old `titleView` into the shared `placementView` (avoid two board-shapers)
— only if it adds value.
**Done when**: all AC met, manual mutator scan recorded, `npm test` + typecheck + lint green, human approves.

### Slice 2: Editing the bot or handle after a projection clears the pending claim

**Value**: A claim can never crown a bot the user didn't preview — editing invalidates the stale projection,
closing the "edit-then-claim a different artifact" footgun.
**Path**: the doc `onInput` and handle `onInput` also clear `result` (and the projection-derived claim
state) so the claim button disappears until practice is re-run on the edited fields.
**Required implementation skills**: load `tdd`, `testing`, `mutation-testing`, `refactoring` before code.
**Acceptance criteria** (confirm before coding):
  - After a `crowned`/`entered` projection renders (claim button present), typing into the bot textarea
    removes the result section + claim button (the button is gone until a new practice run).
  - The same holds for typing into the handle field.
  - Re-running practice on the edited bot renders a fresh projection/button (no stuck stale state).
**RED**: `RingPage.test.tsx` — render a projection via the seam, fire an `input` on the textarea (then, in a
second test, the handle), assert the result section + claim button are gone. Mutator-aware: assert the claim
button specifically disappears (kills a "clear errors but keep result" mutant that leaves the button live).
**GREEN**: clear `result` (+ any claim-pending signal) in both `onInput` handlers.
**MUTATE**: manual mutator scan (web/ outside Stryker) — verify a mutant that clears only one field, or
clears errors but not `result`, would fail a test; record in the PR.
**KILL MUTANTS**: add the missing assertion for any gap.
**REFACTOR**: assess a single `clearResult()` helper shared by both handlers — only if it adds value.
**Done when**: all AC met, manual mutator scan recorded, green, human approves.

## Pre-PR Quality Gate (each slice)

1. Manual mutator scan (`web/**` outside Stryker) recorded in the PR body.
2. Refactoring assessment — `refactoring` skill.
3. `npm run typecheck` + `npm run lint` pass; `npm test` green.
4. Format only the files this slice touches (`prettier --write <files>`; never repo-wide — it reflows
   hand-wrapped live plan docs).

## Out of scope

- Any `src/` / API change — the practice/compete contract is already live (decisions #1–#10).
- Placement semantics (join-if-room, per-author slot limits) — decision #8, unchanged.
- Slice-1 HowItWorks / llms.txt / spec copy — already teach the flow (shipped in #301); this plan only
  changes the interactive ring, whose contract-level blurb already mentions practice/X-Compete.

---
*Archive this file under `docs/archive/` when the plan is complete (repo convention — never delete).*
