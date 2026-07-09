# Plan: Send a bot into the ring (`/ring` submit page)

**Branch**: umbrella `feat/web-ring-submit` — **one PR (branch) per slice**:
`feat/web-ring-skeleton` → `feat/web-ring-card` → `feat/web-ring-errors` → `feat/web-ring-discovery`.
**Status**: Active — **Slices 1–2 ✅ shipped** (PR #237 skeleton · PR #238 full fight card;
2026-07-09, live + smoke-verified); Slice 3 (every failure state + handle polish) next. Planned
2026-07-09 after a `grill-me` pass (decisions table below).

## Goal

Close the authoring loop in the browser: a human holding LLM-generated JSON opens **`/ring`**,
pastes the bot document + their author handle, clicks **"Send into the ring"**, and the browser
POSTs it to the live `/fight` — rendering the full fight card (gauntlet breakdown + title
outcome) **and the raw `/fight` JSON response with a one-click Copy**, so the human can hand the
machine-readable result straight back to the LLM to diagnose and improve the bot. LLM platforms
can't POST; the human is the courier, and `/ring` closes both the **submit** loop and the
**iterate** loop.

## Resolved decisions (from `grill-me`, 2026-07-09)

| #   | Decision                      | Choice                                                                                                                                                                                                                                                                                |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | v1 scope                      | **Full fight-and-crown** — the loop, not a validate-only stub                                                                                                                                                                                                                         |
| 2   | Placement                     | **Dedicated route** `/ring`                                                                                                                                                                                                                                                           |
| 3   | Render mode                   | **Client-rendered multi-page** — `ring.html` + `ring.tsx` `render()` a `RingPage`; **no prerender, no hydration** (the page has no server data)                                                                                                                                       |
| 4   | Flow shape                    | **One action** — a single button → `POST /fight`; rely on `/fight`'s built-in validation (it shares `readValidatedBot` with `/validate`)                                                                                                                                              |
| 5   | Result detail                 | **Full fight card** — outcome headline + 6-row gauntlet breakdown + title/scouting block + crown celebration                                                                                                                                                                          |
| 6   | Abuse control                 | **Deferred** — `/fight` is already public/`curl`-able, so `/ring` doesn't widen the API surface (see Non-goals)                                                                                                                                                                       |
| 7   | Discoverability               | **Nav link + new Hero CTA** + `sitemap.xml` + `llms.txt`                                                                                                                                                                                                                              |
| 8   | Raw result (added 2026-07-09) | **Always display the raw `/fight` JSON** (pretty-printed) with a **Copy button** (reuse `web/src/CopyButton.tsx`) — the LLM-handoff artifact for iterating; **also** for error responses (validator issues / throne-moved), since those are exactly what the LLM needs to fix the bot |

## Non-goals / deferred

- **Rate-limiting / BotID.** Out of scope — the API surface is unchanged. Fast-follow: a **Vercel
  WAF per-IP rate-limit rule** (platform config, deterministic handler untouched) once `/ring`
  drives real traffic. Not a code change in this feature.
- **Content moderation of handles / bot names.** Out of scope as an _enforcement_ control — the
  handle + `name` are already publicly submittable via `curl /fight` today, so `/ring` doesn't
  create the exposure. Real moderation joins the **same deferred hardening bucket** as
  rate-limiting. This feature ships only a **public-handle notice** (Slice 1 AC) to set the
  submitter's expectations — deliberately _not_ a client-side profanity filter (bypassable, false
  security).
- **Persisting / sharing a fight result.** The fight is a stateless gate — only the throne is
  stored. The result card is **ephemeral** (client-only, gone on reload). Shareable replays are
  the separate `/replay` roadmap item.
- **A `model` field on the form.** The bot's `model` rides _inside_ the JSON doc (it's what
  `GET /king` surfaces). The **handle** is the submitter's credit and is the one extra field,
  sent as the `X-Author-Handle` header.
- **Any `src/engine` / TCB / `INPUT_HASH` / `BENCHMARK_VERSION` change.** Presentation +
  transport only; the engine stays decoupled from the web.

## Observability & success signal

No app-level analytics is added — the site is deliberately analytics-free (no telemetry dep in
`web/`), and this feature keeps that. Observability comes from what already exists: **Vercel's
built-in `/fight` function metrics** (invocation count + error rate in the dashboard) tell us
`/ring` traffic and failures, and a **changed King / new Podium entry** is the organic signal that
a real submission cleared and crowned. Per-slice prod verification is the **`agent-browser`
preview smoke** in each Done-when. If usage/error _attribution to `/ring` specifically_ ever
becomes a question, a privacy-friendly counter is a fast-follow — out of scope here.

## `/fight` response contract (implementer reference — from `src/http/handle-fight.ts` + `fight-report.ts`)

All non-error responses are HTTP 200 and carry the **base report**:

```jsonc
{
  "version": "v19",
  "cleared": false, // won > 50% vs EACH of the 6 frozen gauntlet members
  "gauntlet": {
    "seeds": [
      /* fixed + disclosed */
    ],
    "perOpponent": [
      // 6 rows, one per GAUNTLET_NAMES member
      {
        "name": "jabber",
        "winRate": 0.4,
        "wins": 8,
        "losses": 12,
        "draws": 0,
        "net": -37,
        "passed": false,
        "endReasons": {
          /* tally */
        },
      },
    ],
  },
  "diagnostics": {
    "degrade": {
      /* why the bot's actions failed, aggregated */
    },
  },
}
```

A **cleared** bot additionally carries a `title` block (three shapes):

- Empty throne → `"title": { "outcome": "throne-empty-crowned" }`
- Occupied + won → `"title": { "outcome": "crowned",       "winRate": 0.6, "seeds": [...], "bouts": 20, "incumbent": { "name", "model": string|null, "handle": string|null } }`
- Occupied + lost/level → `"title": { "outcome": "king-retained", "winRate": 0.45, "seeds": [...], "bouts": 20, "incumbent": {...} }`

**Error responses** (RFC 9457 `application/problem+json`). NOTE (corrected 2026-07-09 from source
`src/http/envelope.ts` — the plan originally mislabelled the validator failure as 400):

- **422** `/problems/invalid-bot` — the validator's structured issues, carried in an
  `errors: { path, reason }[]` extension member (BOTH the forbidden-key and the schema-validate
  failures return 422; from `readValidatedBot`)
- **400** `/problems/malformed-request` — EITHER missing/empty/over-64/control-char
  `X-Author-Handle` (from `readHandle`) OR an unparseable JSON body. The human string is the
  problem's **`title`** (this envelope has no `detail` field), so handle-vs-bad-JSON is told apart
  by whether `title` names `X-Author-Handle`
- **409** `/problems/throne-moved` — a lost crowning CAS race; the `title` says "resubmit"
- **413** `/problems/payload-too-large` / **405** `/problems/method-not-allowed` — body too large /
  wrong method (envelope guards)

Request: `POST /fight`, body = the JSON doc, header `X-Author-Handle: <handle>`,
`content-type: application/json`. Same-origin — no CORS.

**Contract-type sourcing — RESOLVED 2026-07-09 (Slice 2 tee-up):** declare **local `web/src`
types** mirroring the `/fight` contract, **not** an import from `src/http/`. Rationale: the web
layer is deliberately decoupled from `src/` (no `web/` file imports `src/`; `web/tsconfig` doesn't
include it), and **King.tsx already set this precedent** — it declares a local `Champion` type
rather than importing `ChampionIdentity`. So Slice 2 makes **zero `src/` changes** (no exported
`title` type, no first-ever web→src import). Drift risk is accepted (the contract is v19-frozen),
same as King's `Champion`; a small contract-guard test is a fast-follow if drift ever bites. The
shapes to model locally: `FightReportOpponent` (`src/http/fight-report.ts`), the `title` union
(inline in `handleFight` — three arms: `throne-empty-crowned` | `crowned` | `king-retained`), and
the `incumbent` identity (`{ name, model: string|null, handle: string|null }`).

## Testing note (web-project reality — READ BEFORE CODING)

`web` runs Vitest **node + browser-mode** projects; **Stryker's `mutate` glob is `src/**`+`api/**`only — it never reaches`web/src/**`** (`stryker.config.mjs`). So none of this feature's
logic is Stryker-covered. Unlike the static Arsenal/Gauntlet sections, `/ring` has **genuinely
branchy pure logic** (outcome→headline mapping, handle validation, response→card view-model,
HTTP-status→error-kind classification), so the manual discipline matters _more_:

- **All `web/` logic is tested through browser-mode component behavior — there are NO standalone
  pure-function test files here.** The `node` vitest project runs only `src/**` + `api/**`; the
  `web` project runs only **`src/**/\*.test.tsx`** in a real browser (Playwright). A `.ts`test
under`web/src`has **no runner**. So the branchy logic (outcome→headline, later card-shaping,
handle validation, error classification) lives as local or co-located helpers **for
readability**, but is **covered exhaustively through`RingPage.test.tsx`behavior** — every
outcome variant, every handle-rejection reason, the **63/64/65** length boundary, every error
status — asserted on what the user sees. This also honors the`testing` skill (don't extract
  for testability; no 1:1 test↔impl mapping).
- Because **Stryker can't reach `web/src`** either, those exhaustive component assertions **+ a
  mandatory manual mutator scan** (equality/boundary/return-value/string mutants, per the
  `mutation-testing` skill's `resources/mutator-rules.md`) are what stand in for automated
  mutation coverage.
- Test with **`@solidjs/testing-library`** (`render` / `fireEvent` / `findBy*` / `queryBy*`) and
  **prop-injected seams** — exactly like `King.test.tsx` (`fetchKing`) and `CopyButton.test.tsx`
  (`copy`). Inject the network via a **`postFight?` prop seam** (default = real
  `fetch('/fight', …)`); tests drive every state without the network. **But unlike `King` (which
  throws on non-2xx), `postFight` resolves `{ status: number, body: unknown }`
  for _any_ HTTP response** — including 400/409 — because those problem+json bodies are meaningful
  content the human must see and copy back to the LLM. It rejects **only** on a true network
  failure **or the 30s `AbortController` timeout** (both surface as a Retry-able error, the timeout
  with its own copy). The raw copy text = `JSON.stringify(body, null, 2)`. No `createClientResource` (that's
  for on-mount fetches over a prerendered fallback; `/ring` is client-rendered and the fetch is
  **button-triggered**). Use plain loading/result/error signals.
- EXPECTED data is **hardcoded in the tests**, never imported from the component under test.

## Slices

Every slice follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR (no production code without a failing
test). Before code in any slice, load `tdd`, `testing`, `mutation-testing`, `refactoring`, and
`front-end-testing`. Each slice is one PR and leaves the suite green + the site deployable.

---

### Slice 1: Walking skeleton — paste + fight + outcome headline (the route goes live) ✅ SHIPPED (PR #237, 2026-07-09)

**Value**: An author can, for the first time, send an LLM-authored bot into the ring from the
browser, learn the top-line outcome, **and copy the raw result back to their LLM to iterate** —
both loops the whole project builds toward.
**Actor / Trigger / Outcome**: A human with bot JSON opens `/ring` → pastes the doc + a handle →
clicks "Send into the ring" → sees an **outcome headline** (didn't-clear / first-King / dethroned
/ king-retained) **and the raw `/fight` JSON response in a `<pre>` with a Copy button**, from a
**live `POST /fight`**.
**Path**: new `web/ring.html` (own `<head>`: title, description, canonical `…/ring`, theme-color,
icons, `<noscript>` fallback; `#root`; `<script type="module" src="/src/ring.tsx">`) →
`web/src/ring.tsx` (`render(() => <RingPage />, root)` — **render, not hydrate**) →
`web/src/RingPage.tsx` (textarea + handle input + button + `postFight` seam that resolves
`{ status, body }`, its default fetch **aborting via `AbortController` at 30s** + loading/result/
error signals + a raw-result `<pre>` + `<CopyButton>` reused from `web/src/CopyButton.tsx` + a
local `outcomeHeadline` helper — inline or co-located, tested via the component) → `vite.config.ts`
multi-page `rollupOptions.input: { main: 'index.html', ring: 'ring.html' }` → `vercel.json`
rewrite `{ "source": "/ring", "destination": "/ring.html" }` **before** the SPA fallback → deploy.
Client `JSON.parse` guard before POST. **Intentionally skipped** (later slices): per-opponent
card, title/incumbent detail, the specific error taxonomy (Slice 1 ships **one generic** error
state, mirroring King's error+retry idiom, so it's safe/deployable), localStorage, Nav/Hero CTA,
sitemap/llms.txt.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`,
`front-end-testing`.
**Acceptance criteria** (present + confirm before code):

- [x] Visiting `/ring` serves `ring.html` (not the SPA `index.html`) with its own `<title>`
      ("ModelKombat — Send your bot into the ring"), canonical `https://modelkombat.club/ring`, and
      a `<noscript>` telling no-JS visitors to `POST /fight` with an `X-Author-Handle` header (see
      `/spec`). Verified by an SSR/static assertion on the built/authored HTML (no JS needed).
- [x] `RingPage` renders a labelled JSON `<textarea>`, a labelled handle `<input>`, and a
      "Send into the ring" `<button type="submit">`.
- [x] A plain notice near the handle field reads _"Your handle and bot name are public if you
      win."_ (expectation-setting; not an enforced filter — see Non-goals).
- [x] Clicking with **valid JSON + a handle** calls the injected `postFight` with the parsed doc
      and the handle; a stubbed 200 response renders the correct headline for each of the four
      outcomes: `!cleared` → "Didn't clear the gauntlet"; `throne-empty-crowned` → first-King 👑;
      `crowned` → dethroned/new-champion 👑; `king-retained` → cleared-but-held.
      (`outcomeHeadline(response)` is a pure function, branch-exhaustively tested.)
- [x] After a stubbed 200, the page renders the **raw response** as **pretty-printed JSON**
      (`JSON.stringify(body, null, 2)`) in a labelled `<pre>` region, with a **Copy button**
      (reused `CopyButton`, injected `copy` in tests) whose clipboard `value` equals that exact
      pretty-printed text and whose label names the LLM-handoff intent (e.g. "Copy result for your
      LLM").
- [x] Clicking with **non-JSON text** shows an inline "That's not valid JSON" message and makes
      **no** `postFight` call (client `JSON.parse` guard — no round-trip).
- [x] The raw-result `<pre>` is **horizontally scrollable** (`overflow-x: auto`) so long JSON
      lines never force the page body to scroll sideways on mobile.
- [x] While a request is in flight, a `role="status"` region shows expectation-setting copy —
      _"Running the gauntlet — this can take a few seconds."_ (a `/fight` runs ~140 bounded fights + a possible cold start).
- [x] The default `postFight` **aborts via `AbortController` at 30s**; an abort renders a
      timeout error — _"The ring is taking too long — try again."_ — with a **Retry**. (Verified by
      an injected `postFight` that rejects with an abort-shaped error; the 30s value lives in the
      default fetch, tested structurally.)
- [x] A `postFight` that **rejects** (stubbed network failure) renders a single generic error
      state with a **Retry** that re-invokes `postFight` (King's idiom).
- [x] A **non-2xx response** (e.g. a stubbed 400) is **not** a rejection — the page renders the
      raw copyable body **plus a neutral banner** _"The ring returned an error (HTTP {status}) —
      copy the result below for your LLM."_ and **no** outcome headline. This keeps the iterate
      loop working from Slice 1 for the common validation-failure case; the **human-readable**
      parsing of those issues is Slice 3.
- [x] `RingPage` accepts a `postFight?` prop; the default posts to `/fight` with body = JSON and
      header `X-Author-Handle`, resolving `{ status, body }` from the real fetch. (Default asserted
      structurally; behavior via the stub.)
      **RED**: browser-mode `RingPage.test.tsx` **only** (no standalone pure-fn test — see Testing
      note): render fields + public-handle notice; valid submit → stubbed headline for **each of the
      four outcomes** (exact strings) + raw `<pre>` present + `CopyButton` value === the pretty JSON;
      invalid JSON → no call + message; in-flight status copy; 30s-abort → timeout error + Retry;
      network reject → generic error + Retry; non-2xx → raw body + neutral banner. Likely mutants killed
      by these behaviors: the outcome `switch`/equality arms, the "no call on parse failure" guard, the
      `JSON.stringify(…, null, 2)` copy value, the header/body construction.
      **GREEN**: minimum `ring.html` + `ring.tsx` + `RingPage` + `outcomeHeadline` + config/rewrite.
      **MUTATE**: manual scan of `outcomeHeadline` + the submit handler (Stryker can't reach `web/src`).
      **KILL MUTANTS**: exact-string + no-call assertions to kill equality/return-value/guard mutants.
      **REFACTOR**: only if valuable (e.g. hoist the field markup) — keep the seam + pure fn clean.
      **Done when**: ACs met, manual scan clean, `npm run typecheck && lint && format:check` pass,
      **`npm run build:web` still emits `dist/index.html` (home, hydration script present),
      `dist/spec-guide.html`, and `dist/spec.md` unchanged — plus the new `dist/ring.html` with its
      hashed `ring` entry — proving the multi-page input didn't regress the prerender pipeline**, an
      `agent-browser` preview smoke against a preview deploy confirms a real POST renders a headline,
      human approves commit.

---

### Slice 2: The full fight card — gauntlet breakdown + title block + crown celebration ✅ SHIPPED (PR #238, 2026-07-09, live + smoke-verified)

**Value**: The payoff — an author sees _how_ the bot did against each of the six house fighters,
the title fight vs the King, and a crown moment, in the site's existing visual language.
**Actor / Trigger / Outcome**: Same submit → the result expands from a headline into a **card**:
6 per-opponent rows (win rate + pass/fail), the `title` block (win rate vs the King, the scouted
`incumbent`), a crown celebration linking to `#king`, and deep diagnostics behind a disclosure.
**Path**: pure card-shaping helpers (`scoreRows` → an ordered row list, `formatRate`, `resultLabel`,
`titleView`/`readIncumbent` → a title view-model) with **local `web/src` types** mirroring the
contract — **co-located in `RingPage.tsx`** (the King.tsx precedent; a separate module was assessed
at REFACTOR and deferred — the shared `isRecord` guard makes a clean split not yet net-positive,
and Slice 3 introduces flat `web/src/ring-*.ts` sibling modules as the natural home) → `RingPage`
renders the card **above the persistent raw-result `<pre>` + Copy block from Slice 1** (reusing
Gauntlet card idioms + `ModelLogo` for the incumbent) → `ring.css`. **Skipped**: error taxonomy
(Slice 3).
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`,
`front-end-testing`.
**Acceptance criteria** (present + confirm before code):

- [x] **AC-1 — Per-opponent rows.** A 200 report renders **one row per `gauntlet.perOpponent`
      entry, in array order** (the frozen `GAUNTLET_NAMES` order jabber→rekka→zoner→grappler→
      sweeper→vulture — pinned by `benchmark-config.ts`); a non-mirror bot yields **6**. Rendering
      the array as-is (not a hard-coded 6) stays correct for a **mirror** submission, where a
      skipped member leaves **5** rows + `cleared:false`. Each row shows the fighter **name**, its
      **win rate**, and a **passed/failed** indicator reflecting `passed` — carrying a **text**
      marker (e.g. "beat" ✓ / "lost" ✗), **never colour alone**.
- [x] **AC-2 — Win-rate formatting.** Each row's `winRate` (a 0–1 float) renders as a human
      **percentage** (`0.4` → "40%"); the `0.5` boundary (`→ "50%"`) is asserted.
- [x] **AC-3 — Title celebration by outcome** (pure `fight-card-view` mapping, branch-exhaustive):
      `throne-empty-crowned` → a **first-King** celebration linking to `#king`; `crowned` → a
      **dethrone** celebration linking to `#king`; `king-retained` → a **held-throne** state (no
      crown); a `cleared:false` report (**no `title`**) → the gauntlet breakdown only, **no
      celebration**.
- [x] **AC-4 — Scouted incumbent.** For `crowned`/`king-retained` (which carry an `incumbent`), the
      card shows the King's **name**, **model** via `<ModelLogo>`, and **handle** (rendered only
      when non-null, per King.tsx), plus the title-fight **win rate** + **bouts** — and **never**
      the King's DSL/rules. `throne-empty-crowned` (no incumbent) shows **no** scout block.
- [x] **AC-5 — Raw block stays the source of truth.** The Slice 1 raw `<pre>` + Copy block
      **persists below the card** and still carries the **complete verbatim payload** (`endReasons`,
      `net`, `degrade` all live there for the LLM). The card surfaces the human-readable subset and
      does **not** duplicate a separate diagnostics view. (`net` may appear on a row if it aids the
      human read; the machine detail is the raw block.)
- [x] **AC-6 — Presentation.** The card is **responsive + theme-aware**, reusing the Gauntlet/King
      card CSS idioms. _(Structure/behavior pinned by tests; visual polish verified by the preview smoke.)_
      **RED**: browser-mode `RingPage.test.tsx` behavior **only** (no standalone shaper test — see
      Testing note): one row per `perOpponent` entry in array order (6 for a non-mirror body) with exact
      names + win-rate **percentages** (incl. the `0.5`→"50%" boundary) + pass/fail text markers; each
      `title.outcome` → its celebration/held copy (+ `cleared:false` → no celebration); incumbent present
      (name/model/handle + win rate + bouts) vs absent; the raw block still carries the complete payload.
      Likely mutants killed: the row `.map`/order, the `winRate` `*100`/rounding, the `passed` boolean,
      the four outcome arms, the incumbent/`handle` null guards.
      **GREEN**: the shaper + card markup + styles.
      **MUTATE**: manual scan of `fight-card-view` (order, boolean flags, outcome arms, null guards).
      **KILL MUTANTS**: exact per-row + per-outcome + incumbent-present/absent assertions.
      **REFACTOR**: extract a `<FighterRow>`/`<TitleBlock>` sub-component only if it earns its keep.
      **Done when**: ACs met, manual scan clean, static analysis passes, an `agent-browser` smoke shows
      the card for a real cleared **and** a real uncleared bot, human approves commit.

---

### Slice 3: Every failure state + handle polish

**Value**: An author who pastes a malformed bot, a bad handle, or hits a throne race / bad
network gets a precise, actionable **human-readable** message instead of the generic fallback
(the complete problem+json already displays + copies via the Slice 1 raw block, so the LLM gets
the structured issues regardless) — and returning authors don't retype their handle.
**Actor / Trigger / Outcome**: Same page, unhappy paths → specific states: rendered validator
issues, inline handle errors, a throne-moved resubmit prompt, and network/oversize/method errors;
the button disables in-flight; the last handle is remembered.
**Path**: pure `web/src/ring-handle.ts` (validate: non-empty, ≤64, no control chars, trim) + pure
`web/src/ring-fight-error.ts` (HTTP status/problem+json → an error kind + message) — **flat sibling
modules** (matching `inject-body.ts`, not a one-off subfolder) → `RingPage` renders each + a
`localStorage` prefill. **Skipped**: nothing further — this completes the interaction.
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`,
`front-end-testing`.

**Tee-up decisions (2026-07-09, confirmed before RED):**

1. **Validator failure is 422, not 400** (source-corrected above). AC-1 keys on
   `422 /problems/invalid-bot` + its `errors: { path, reason }[]`.
2. **Handle persists on any client-valid submit** — at POST-fire time, regardless of the fight
   outcome or a transport error (the handle was valid; maximizes "never retype"). Not gated on 2xx.
3. **A recognized status' specific message REPLACES the Slice 1 generic banner**; the generic
   "The ring returned an error (HTTP {status})…" banner survives only as the fallback for an
   **unrecognized** non-2xx. The raw copy block persists below in every case.
4. **Client mirrors `readHandle` + trims** — deliberately STRICTER than the server on one point: a
   whitespace-only handle is rejected client-side (empty after trim) though the server would accept
   it (`0x20` is not a control char). Length is measured on the TRIMMED handle.

**Acceptance criteria** (present + confirm before code):

- [ ] **AC-1 — Validator issues (422).** A **`422 /problems/invalid-bot`** response renders its
      `errors: { path, reason }[]` as a **readable list** (each `path: reason`), keeping the pasted
      doc so the author can fix it. The Slice 1 raw copy block still carries the full problem+json;
      the specific list **replaces** the generic banner for this status.
- [ ] **AC-2 — Empty / whitespace-only textarea** shows a distinct _"Paste your bot JSON to
      continue."_ message (not the "That's not valid JSON" copy) and makes **no** `postFight` call —
      refining the Slice 1 parse guard for the no-input case.
- [ ] **AC-3 — Client handle validation** (mirrors `readHandle` + trims): the handle is **trimmed**,
      then **empty** (incl. whitespace-only) / **trimmed length > 64** / **control char**
      (code `< 0x20 || === 0x7f`) each show an **inline field error** and make **no** `postFight`
      call; a valid handle is sent **trimmed**. Boundary tested at **63 (ok) / 64 (ok) / 65
      (rejected)**. A server **400 malformed-request** whose `title` names `X-Author-Handle`
      (belt-and-braces) also surfaces on the handle field.
- [ ] **AC-4 — `fightError(status, body)` taxonomy** (pure, exhaustive): **409 throne-moved** →
      "the throne advanced — resubmit to challenge the current King" + a resubmit affordance;
      **413 / 405 / network / abort** → a distinct generic transport error with Retry; an
      **unrecognized non-2xx** → Slice 1's generic banner (the fallback). Each recognized status'
      specific message replaces the generic banner.
- [ ] **AC-5 — Submit disabled in-flight** (no double throne contest). _(The in-flight loading
      status copy is already Slice 1's — "Running the gauntlet — this can take a few seconds";
      Slice 3 adds only the disable.)_
- [ ] **AC-6 — Handle localStorage.** The handle input **prefills from `localStorage`** and
      **persists on every client-valid submit** (at POST-fire time); absent/blocked storage (private
      mode, disabled) degrades silently to an empty field (access wrapped in try/catch).
      **RED**: browser-mode `RingPage.test.tsx` behavior **only** (no standalone pure-fn tests — see
      Testing note): validator-issues list rendered; empty-textarea distinct message; inline handle
      error + no call at the **63/64/65** boundary and for control chars; trimmed handle; each error
      status (422-validator / 400-handle / 409 / 413 / 405 / network) → its distinct message; in-flight
      disable; localStorage prefill/persist with a stubbed storage. Likely mutants killed: the `<= 64`
      boundary, the control-char predicate, the trim, each status arm, the disabled guard.
      **GREEN**: the two pure modules + rendering + storage prefill.
      **MUTATE**: manual scan — boundary (`<=`/`<`), each error arm, the disabled/guard conditionals.
      **KILL MUTANTS**: boundary-triplet + per-status + no-call-on-invalid assertions.
      **REFACTOR**: only if it adds value.
      **Done when**: ACs met, manual scan clean, static analysis passes, an `agent-browser` smoke walks
      an invalid-JSON, a bad-handle, and a valid submit, human approves commit.

---

### Slice 4: Discoverability — Nav link, Hero CTA, sitemap + llms.txt

**Value**: Visitors and LLMs can find `/ring`; the landing page finally has the call-to-action
the whole page builds toward, and an LLM reading `llms.txt` can tell its human where to paste.
**Actor / Trigger / Outcome**: A home-page visitor sees a Hero **"Send your bot into the ring →"**
button and a Nav **"Ring"** link → both route to `/ring`; `sitemap.xml` lists `/ring`; `llms.txt`
documents it. (Placed **last** so we don't drive traffic to a half-built page.)
**Path**: `web/src/Nav.tsx` (a `/ring` link, real route like the Spec link) + `web/src/Hero.tsx`
(a new CTA anchor → `/ring`) + `web/public/sitemap.xml` (+`/ring` `<url>`) + `web/public/llms.txt`
(a "Send a bot" entry pointing at `/ring`, blurb synced to the live behavior).
**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`,
`front-end-testing`.
**Acceptance criteria** (present + confirm before code):

- [ ] The Nav renders a link with an accessible name for the ring whose `href` is `/ring`,
      positioned consistently with the other nav entries.
- [ ] The Hero renders a prominent CTA (`<a>` with a clear accessible name, e.g. "Send your bot
      into the ring") whose `href` is `/ring`; the existing face-off/title/tagline are unchanged.
- [ ] `sitemap.xml` contains a `<url>` for `https://modelkombat.club/ring`; the XML stays
      well-formed (parse assertion).
- [ ] `llms.txt` documents `/ring` (what it's for + that the human pastes JSON there), consistent
      with the existing entries' voice.
      **RED**: browser-mode `Nav.test.tsx` (ring link href `/ring`) + `Hero.test.tsx` (CTA name + href)

* node tests parsing `sitemap.xml` (contains the `/ring` loc, well-formed) and asserting
  `llms.txt` mentions `/ring`. Likely mutants: the `href` string, the CTA copy.
  **GREEN**: the link + CTA + two static-file edits.
  **MUTATE**: manual scan (exact href/copy) — presentation, per the web precedent.
  **KILL MUTANTS**: exact-href + exact-name assertions.
  **REFACTOR**: none expected.
  **Done when**: ACs met, static analysis passes, an `agent-browser` smoke clicks Nav + Hero → lands
  on `/ring`, human approves commit.

## Pre-PR Quality Gate (each slice)

1. **Manual mutator scan** per the Testing note — Stryker can't reach `web/src`, so confirm every
   branch/boundary of the slice's pure functions is pinned by an exact-assertion test.
2. **Refactoring assessment** (`refactoring` skill) — only if it adds value.
3. `npm run typecheck` (incl. `web/tsconfig.json`) + `npm run lint` + `npm run format:check` pass.
4. **`agent-browser` preview smoke** against the Vercel preview deploy (the web-section precedent)
   — drive the real path for the slice's behavior.

## Gaps closed — find-gaps session, 2026-07-09

Resolved (7):

- `[Blocker → Slice 1 ACs + testing note]` Slow/hung `/fight` → **30s `AbortController` timeout** +
  expectation-setting loading copy + Retry-able timeout error.
- `[Should  → Slice 1 Done-when]` Vite multi-page input must not regress the prerender pipeline →
  **build-output verification** (`index.html`/`spec-guide.html`/`spec.md` unchanged + new `ring.html`).
- `[Should  → Slice 1 ACs]` Non-2xx (400/409) rendering in Slice 1 → **raw copyable body + neutral
  banner, no headline**; human-readable parsing deferred to Slice 3.
- `[Should  → Non-goals + Slice 1 AC]` Public unverified handle/name → **accept as pre-existing +
  public-handle notice**; enforcement moderation joins the deferred hardening bucket.
- `[Should  → Observability section]` No app analytics by design → **Vercel `/fight` metrics +
  throne/Podium change** are the signal; `agent-browser` smoke per slice.
- `[Nice    → Slice 3 AC]` Empty/whitespace textarea → **distinct "Paste your bot JSON" message**.
- `[Nice    → Slice 1 AC]` Raw `<pre>` → **`overflow-x: auto`** so long JSON never scrolls the body.

Subsumed (1):

- `[Nice]` Prod success signal — covered by the new **Observability & success signal** section.

Parked (0). Also reconciled a contradiction: the in-flight loading copy is owned by **Slice 1**;
Slice 3 adds only the button **disable**.

---

_Per the plans-archive rule ([[archive-plans-not-delete]]): on feature close, **archive** this
file to `docs/archive/` with a `README.md` entry — do **not** delete it._
