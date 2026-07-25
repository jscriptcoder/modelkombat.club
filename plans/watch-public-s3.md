# Plan: S3 — Road to the throne

**Branch**: `feat/king-road-to-throne`
**Status**: Active
**Story**: `plans/watch-public-stories.md` § S3 · **Decisions**: `plans/watch-public-decisions.md` D6, D7, D9

## Goal

A visitor can jump from any champion on the home page to the fight that put them on the
board — one click from the Current King card or any of the three Arena podium cards.

## Acceptance criteria

The story's eight acceptance examples, verbatim:

- [ ] **AC1** Given an arena member whose entry record is in the archive, `GET /king` returns
      that member with `replayId` equal to that record's **first** bout id — the bout against
      the then-King.
- [ ] **AC2** Given a member with no matching record (a seeded House champion, a bootstrap
      crown), their `replayId` is `null`.
- [ ] **AC3** Given the archive read throws, `GET /king` still responds **200** with every
      member's `replayId` `null` — never 503.
- [ ] **AC4** Given the **arena** read throws, `GET /king` still responds 503, unchanged.
- [ ] **AC5** Given two members that share a `name` but differ in `seniority`, each resolves to
      its own record's id — the join is on seniority, never on name.
- [ ] **AC6** Given a member with a non-null `replayId`, their card renders a link to
      `/watch/{replayId}` whose accessible name identifies that champion (e.g. "Watch warden's
      road to the throne").
- [ ] **AC7** Given a member whose `replayId` is `null`, their card renders no icon and no link
      at all — not a disabled one.
- [ ] **AC8** Given the King is also Gold on the podium, both cards link to the same
      `/watch/{id}`.

Two more the codebase demands, not the story:

- [ ] **AC9** `/fight`'s title block is byte-unchanged. `memberIdentity` is shared with
      `handle-fight.ts` (`board[].defender`, `displaced`); `replayId` must not appear there.
- [ ] **AC10** The build-time prerender still renders the empty throne and empty arena — no
      `/watch/` link in the prerendered home HTML, and hydration produces no mismatch.

## Slices

### Slice 1 (only): A visitor clicks 👁 on a champion and lands on the fight that seated them

**Class**: Behavior change.

**Value**: answers "who did this King actually beat?" in one click, from the most-read part of
the home page.

**Path**: home page → the existing single `/king` fetch (`App`) → `handle-king` joins the
archive onto the arena → `King` / `Podium` render a 👁 link → `/watch/{id}` plays the bout.

**Why it is not split**: the story warns explicitly. "`/king` returns `replayId`" alone is a
component story with no observable outcome; "cards render 👁" alone has nothing to render.
One PR.

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.

#### Decisions taken here

- **P1 — `replayId` is composed in `handle-king.ts`, not in `memberIdentity`.**
  `champion-identity.ts` is shared with `/fight`, whose board rows already carry their own
  `replayId` from a different source (`boutReplayIds(reproRecord(...))`). Widening
  `ChampionIdentity` would put an unresolvable field on `/fight`'s title block. `handle-king`
  spreads instead: `{ ...memberIdentity(member), replayId }`. This mirrors `handle-fight.ts`'s
  `BoardRow`, which composes the same way — one established pattern, two callers.
- **P2 — the 👁 link is one home-local component, used twice.** `King.tsx` and `Podium.tsx`
  both render it, and the accessible-name rule ("Watch {name}'s road to the throne") is the
  knowledge that must not drift. It lives in `web/src/pages/home/`, not `shared/` — only one
  page renders it, and `FightCard` set the precedent that `shared/` is for cross-page reuse.
- **P3 — the join uses `find`, first match wins.** Seniority is a strictly-increasing
  per-version counter, so at most one archived record can carry a given `memberSeniority`;
  `find` vs `findLast` is unobservable. Documented in a comment so a surviving equivalent
  mutant is recognised as equivalent rather than chased.
- **P4 — `null` covers three cases with one expression.** No record found, a bootstrap crown
  (`defenders: []` ⇒ `boutReplayIds` is `[]` ⇒ `[0]` is `undefined`), and a failed archive
  read all yield `null`. The endpoint never distinguishes them, and no caller needs to.

#### RED

`src/http/handle-king.test.ts` — the contract, driven through hand-rolled fake stores (the
file's existing seam; `handle-replay.test.ts`'s `fakeStore` / `throwingStore` are the shape):

1. A member whose record is in the archive comes back with `replayId` equal to
   `boutReplayIds(record)[0]` — asserted against the value `/replay` itself computes, not a
   hard-coded hash, so the two can never drift. (AC1)
2. A member with no matching record → `replayId: null`. (AC2)
3. A bootstrap-crown record (`defenders: []`) pinned to a member → `replayId: null`. (AC2)
4. An archive read that rejects → **200**, every member `replayId: null`, `current` and
   `recent` otherwise identical to the healthy response. (AC3)
5. An arena read that rejects → still 503. (AC4)
6. Two members sharing a `name`, different `seniority`, each with its own record → each gets
   its own id, and they differ. (AC5)

`web/src/pages/home/King.test.tsx` and `Podium.test.tsx` (browser project):

7. A champion with a `replayId` → a link whose `href` is `/watch/{id}` and whose accessible
   name contains that champion's name. (AC6)
8. A champion with `replayId: null` → no link and no `aria-disabled` element in that card.
   (AC7)
9. Podium: gold's link and the King section's link resolve to the same href for the same
   champion. (AC8)
10. `App.test.tsx`: the `/king` payload's `replayId` reaches both sections. (AC8, integration)

`web/src/pages/home/*.ssr.test.tsx` (`web-ssr` project): the prerendered home HTML contains no
`/watch/` href. (AC10)

#### GREEN

- `src/http/handle-king.ts`: read the archive inside its own `try`/`catch` (defaulting to
  `[]`), build a `Map<number, string>` from `memberSeniority` → `boutReplayIds(record)[0]`,
  and project each member as `{ ...memberIdentity(member), replayId: map.get(seniority) ?? null }`.
  The arena read keeps its existing outer `try`/`catch` and its 503.
- `web/src/pages/home/King.tsx`: `Champion` gains `replayId: string | null`; render the shared
  link when non-null.
- `web/src/pages/home/Podium.tsx`: same link on each filled step.
- `web/src/pages/home/RoadToThroneLink.tsx` (+ CSS): the 👁 anchor and its accessible name.

#### MUTATE

`src/` **is** Stryker-reachable, so this slice carries the real regime: run mutation testing
over `src/http/handle-king.ts` and report killed/survived/score. Expected survivors to reason
about explicitly rather than accept silently: the `find`/`findLast` equivalence (P3), and
`?? null` vs `|| null` (equivalent for `undefined`).

`web/` is **not** Stryker-reachable ⇒ mutation `N/A` there, substituted by exhaustive
exact-assertion tests + a **mandatory manual mutator scan** over the changed `web/` files, as
established by S1 and S2.

#### KILL MUTANTS

Add or strengthen tests for every valuable survivor. Ask before accepting one whose value is
ambiguous.

#### REFACTOR

Assess only. Candidate: whether the seniority→id map deserves its own named function in
`handle-king.ts` or reads better inline. Do it only if it adds value.

#### Done when

All ten acceptance criteria pass; the mutation report is presented for `src/` and the manual
scan for `web/`; typecheck, lint, and the full suite are green; the human approves the commit.

## Pre-PR quality gate

1. Mutation testing over changed `src/` + manual mutator scan over changed `web/`
2. Refactoring assessment (`N/A` if nothing adds value)
3. `npm run typecheck` && `npm run lint` && `npm test` (all three vitest projects, from the
   repo root — `web-ssr` resolves only there)
4. Visual check of the 👁 affordance on the Vercel preview, against real `/king` data

---

_Archive this file under `docs/archive/` when complete — with the arc's design trail
(`watch-public-decisions.md`, `watch-public-stories.md`), which S3 is the last consumer of._
