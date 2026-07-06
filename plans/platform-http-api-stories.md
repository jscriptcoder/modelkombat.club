# Platform HTTP API — story split

Output of `story-splitting` (2026-07-05). Decisions source: `plans/platform-http-api-decisions.md`.
Feeds `planning` (one child story → PR-sized slices). Actors use the domain vocabulary:
**LLM author** (the competitor's model), **human trainer** (hands it the URL + strategy prompt),
**challenger** / **King of the Hill**, **operator**.

## Parent

An **LLM author**, handed **one URL**, can learn the game, author a fighter, submit it, get a
**visible** fight result, iterate, and ultimately climb to become the **King of the Hill** — the
platform's online bot-authoring loop. Too large for one PR and it bundles a *stateless* "score my
bot" capability with a *stateful* "climb the ladder" capability, on a **greenfield** platform (no
serverless scaffolding exists yet).

**Success metric (loop quality):** an LLM given only the `/spec` URL authors a
validator-passing bot on the first try, and across ≤N retries measurably raises its
gauntlet win-rate; at least one test LLM clears the gate. Demonstrable via dogfood /
test-LLM without external traffic.

## Recommended First Slice

**Story 1 — Author from the spec (`GET /spec`).** An LLM author can fetch the self-describing spec
from the deployed API and author a valid bot from it.

**Why this first:** it's the **deployment walking skeleton**. The platform is greenfield (no
`vercel.json`, no `api/`, no runtime deps), so the biggest unknown is *integration* — can a Vercel
serverless function import the engine directly from `src/` (all-TS, NodeNext ESM) and deploy? A
read-only `GET /spec` retires that risk at the lowest feature cost, while delivering the
authoring/onboarding half of the loop and the user's self-describing centerpiece. Demonstrable
(curl it; hand the URL to an LLM and watch it author a valid bot — the offline dogfood already
proved this catches real spec defects). Fights, state, and abuse-hardening are all deferred.

## Cross-cutting (applies to every story)

- **Error contract:** every error response is RFC 9457 `application/problem+json` per the
  status-mapping table in `platform-http-api-decisions.md` (§ API response contract). Each
  story's negative-path examples resolve to that contract — e.g. "invalid bot → 422
  `/problems/invalid-bot` with the validator `errors` array".

## Split Candidates

| Slice | Value | Includes | Defers | Acceptance Examples | Release Constraint |
|---|---|---|---|---|---|
| **S1 · Author from the spec** (`GET /spec`) | LLM author + trainer: one URL yields everything to author a valid bot; proves the deployment path works | First Vercel serverless fn; import `generateSpec` from `src/`; serve canonical spec + a short **version-neutral** "what this game is" intro in the **core** spec (drift test updated) + a **serve-time API envelope** kept OUT of the hashed spec that **lists only live endpoints** (at S1: `/spec` only, no submit target), grown per slice from a small live-endpoints config; **small engine precursor** — add optional inert `model?: string` to `BotDoc` (validator length-cap + documented in the spec's bot schema), sibling of `name`; deploy pipeline | All submission/validation/fight/throne; rich narrative; advertising unbuilt endpoints; verified provenance | GET /spec returns DSL + JSON Schema + win condition + intro · envelope lists only deployed endpoints (S1: no submit target) — **no dead URLs advertised** · core-spec regen keeps the drift test green and `INPUT_HASH` unchanged · a bot declaring `model` ("Claude Opus 4.8" / "human") validates; the field is optional (absent ⇒ byte-identical) and never affects the fight · an LLM given only the URL authors a validator-passing bot | Shippable, public (read-only, safe) |
| **S2 · Pre-check a bot** (`POST /validate`) | LLM author: confirm a bot is well-formed + get structured errors without spending a fight | POST /validate → validator gate → ok or structured `ValidationError[]` (reuses built validator) | Fights, scoring | valid bot → ok · malformed bot → the exact validator issues, HTTP-appropriate status | Shippable, public — **small; candidate to fold as S3's opening PR** |
| **S3 · Score my bot against the field** (`POST /fight`, gauntlet gate, **stateless**) | LLM author: submit a bot, learn how it fares vs the frozen gauntlet with visible per-member feedback — the practice range + core learning loop | validate → run gauntlet (**fixed disclosed seeds**) → gate predicate (**>50% vs each** of 6) → **compact egocentric report** (verdict, per-member pass/fail + W/L, per-matchup visible scores/`endReason`/fouls, aggregated S8 degrade diagnostics); **synchronous** | Title fight + throne (S4); full replay tape; rate-limit/payload cap | valid bot → 200 with the pinned report shape (`gauntlet.perOpponent[]` incl. `passed`, `cleared`, `diagnostics.degrade`; decisions §API response contract) in one sync response · loser vs zoner → zoner `passed:false` w/ visible scores + `diagnostics.degrade` reasons · invalid bot never fights → 422 `/problems/invalid-bot` + `errors` · **no opponent documents / internal state** in the response · `title` block absent in S3 | Shippable **internal-only first**; add rate-limit + payload cap before fully public |
| **S4 · Climb to the throne** (title fight + version-scoped KotH, **stateful**) | Challenger: clearing the gauntlet earns a title shot; winning crowns you the King others must beat — the competitive apex + persistent state | Version-scoped throne store (key = ruleset version; value = champion doc + crowning metadata); **empty-throne bootstrap**; title fight vs incumbent (**fresh hidden seeds**, returned for replay); dethrone on **>50%** (king retains on tie); **atomic CAS** crown; **optional unverified author handle** stored + shown; **hall-of-fame retention** (every version's champion kept); report extends with title-fight visible outcome | Verified identity/anti-impersonation; leaderboards/lineage/accounts; /replay | empty throne + cleared gauntlet → crowned · reigning King + challenger wins >50% → dethroned; ≤50% → King retains · two near-simultaneous dethrones → 409 `/problems/throne-moved`, exactly one wins · version bump → fresh empty throne; the old version's champion persists as a historical record (active throne is the current version's) · challenger never receives the King's document; title-fight seeds returned only post-hoc · crown shows the bot `name` + `model` (provenance, travels in the doc) + optional unverified handle | Shippable; requires concurrency + versioning correctness before public |

## Parking Lot

- **`/replay` + full visible tape** — deferred opt-in richer feedback (decision 5). Reconstructable server-side from the returned seed since fights are reproducible.
- **Rate-limit + payload-size cap** — protective quality/ops slice; attach to the first *public* compute endpoint (S3's public-release gate). Vercel WAF/firewall available; DSL internal cost already bounded by `LIMITS`.
- **Storage tech choice** (Vercel KV / Blob / Edge Config / Postgres) — a **planning** decision for S4; the *schema* (version-keyed) is already decided.
- **Per-author accounts / leaderboards / throne lineage** — deferred (decision 6).
- **Preview-vs-prod URL handling** for the layered spec envelope — an S1 planning detail (the URL is environment-specific, never in the hashed core spec).
- **Per-slice rollback** (parked, disposition set): each slice is a Vercel deploy → rollback = instant redeploy of the previous deployment; any S4 store change is additive, so no app-level rollback logic needed.

## Warnings

- The proposed spine (`/spec → /validate → /fight → throne`) was **endpoint-shaped**; reframed here
  into **capabilities** (author-from-spec, pre-check, score-vs-field, climb-throne) so each is
  user-visible and independently valuable. Watch that `planning` doesn't collapse **S3** back into
  pure "wire an endpoint" tasks — keep the **compact-report value in the first PR**, not deferred to
  an "enrich later" PR that never lands.
- **S2** risks being too tiny to stand alone — fold it as S3's opening PR or keep it visibly small.
- **Greenfield:** S1 carries one-time deployment setup (first serverless fn, engine-from-`src/`
  bundling under NodeNext ESM, deploy pipeline). Keep the *feature* thin — the setup is the point;
  don't let it balloon.
- Rate-limit/payload cap has **no positive user outcome** (protective) — don't promote it to a
  standalone capability story, but don't expose a public compute endpoint (S3+) without it.

## Gaps closed — find-gaps session, 2026-07-06

Resolved (11):
```
[Blocker → decisions §API response contract]  Error envelope = RFC 9457 problem+json + status table
[Blocker → decisions §contract + S3 AC]        /fight success shape = per-opponent aggregate + diagnostics
[Should  → S1]                                 Spec envelope lists only live endpoints (no dead URLs)
[Should  → decisions eng-reqs]                 Title-fight variance-farming ACCEPTED for v1 (rate-limit brake)
[Should  → decisions eng-reqs]                 Mirror bot (== gauntlet member) = not-cleared at the gate
[Should  → decisions eng-reqs]                 Observability = structured logs + throne-change events
[Should  → decisions eng-reqs]                 Gauntlet IS the frozen benchmark manifest at current version
[Should  → decisions eng-reqs]                 Testing = pure-fn handler unit tests + post-deploy smoke test
[Nice    → parent]                             Success metric = loop quality (author + improve + clear)
[Nice    → decisions eng-reqs + S4]            Throne identity = optional unverified author handle
[Nice    → decisions eng-reqs + S4]            Retention = hall of fame (keep every version's champion)
```

Parked (1):
```
[Nice] Per-slice rollback — disposition set: Vercel instant redeploy; store changes additive.
```

## Next Step

The split is hardened — all Blockers + Should-addresses closed. Load **`planning`** for
**S1 (`GET /spec`)** — the walking skeleton that stands up the deployment — to turn it into
PR-sized TDD slices. Every implementation slice must run the full
RED-GREEN-MUTATE-KILL-MUTANTS-REFACTOR cycle: load `tdd`, `testing`, `mutation-testing`,
`refactoring` before code.
