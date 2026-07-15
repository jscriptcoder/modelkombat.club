# Practice / Compete split for `/fight` — resolved design decisions

Resolved via `grill-me` (2026-07-15). Pre-planning source of truth for decoupling
**evaluation** from **arena mutation** on `POST /fight`. Feeds `planning` → TDD, **PR per
slice**. Builds on the LIVE platform HTTP API + KotH ladder (see
`plans/platform-http-api-decisions.md`, `docs/archive/koth-ladder-*`).

## The problem

`/fight` couples two concerns: **evaluating** a bot (does it clear the gauntlet? where would
it rank?) and **mutating shared state** (seating/crowning it in the arena, appending its
reproduction record). Today _every_ clearer mutates — there is no "just testing" path. During
real iteration an LLM makes many `/fight` calls, and because of the **join-if-room** rule each
clearer seats into an open arena slot, so same-author trial bots pile up in the standings
(observed: a 3-bot pileup where iterations #2 and #3 took slots 2 and 3, #3 ranked against #2's
throwaway). Pollution is the _default_ behavior, not an opt-in mistake.

## The fix

Make `/fight` **practice by default** (evaluate only, zero footprint) and **compete opt-in**
via an `X-Compete: true` header (re-run + mutate). "Iterate freely, then commit once you're
happy with the bot" — the user's own mental model. KotH integrity is preserved because the
compete path re-verifies against the live arena via the existing CAS/`generation` guard.

```
POST /fight                        → practice: gate + round-robin, respond with a PROJECTION, write nothing
POST /fight  (X-Compete: true)     → compete: recompute + commitArena(+repro) under CAS, as today
X-Author-Handle: <handle>          → required in BOTH modes
```

## Resolved decisions

| #   | Decision                     | Choice                                                                                                                                                                                                                                             | Rationale                                                                                                                                                                                                    |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Default mode**             | **Practice.** A bare `/fight` evaluates only; it never mutates the arena or archive. Competing is opt-in.                                                                                                                                          | Matches how the tool is actually used (many iterations, one commit). Pollution becomes impossible-by-default, not a trap. Pre-launch, so cheap to set the default correctly now.                              |
| 2   | **Compete signal**           | Header **`X-Compete`**. `true` → compete; `false` or absent → practice. Case-insensitive. Any other non-empty value → **`400 /problems/malformed-request`** (no silent downgrade).                                                                 | Symmetric with the existing `X-Author-Handle` — intent + identity both ride as author headers, body stays the pure artifact. Strict parsing prevents a typo silently dropping a compete into practice.       |
| 3   | **Practice writes**          | **Strictly read-only.** Practice reads the arena to compute the projection and writes nothing — no `commitArena`, no repro-archive append. Only a compete call touches the store.                                                                  | The "footprint-free iteration" promise, literally. Archiving practice runs would reintroduce the pollution one layer down (the archive) and add write cost + CAS races to a path meant to be cheap and safe. |
| 4   | **Compete state**            | **Stateless** — compete recomputes the gate + round-robin against the live arena, guarded by the existing CAS/`generation` check. No preview token, no token store.                                                                                | Determinism makes the commit byte-identical to the preview unless the arena moved; if it moved, CAS correctly re-ranks or 409s. A token buys nothing over CAS and adds state + expiry + a new failure mode.   |
| 5   | **Practice response shape**  | Practice returns a distinct **`projection`** object `{ outcome, rank, board, displaced? }` and **never** a `title`. Inner vocabulary is unchanged (`crowned` / `entered` / `unplaced`).                                                            | `title` stays ground-truth = "you actually hold this slot," so a consumer keying on `title` can't misread a projection as a real crown. No `would-` vocabulary duplication; field name carries the meaning.   |
| 6   | **Handle requirement**       | **`X-Author-Handle` required in BOTH modes** (unchanged).                                                                                                                                                                                          | Flipping practice→compete is _purely_ adding one header — no new required field can newly 400 at commit time. One validation path; the ring page always supplies a handle.                                    |
| 7   | **Mirror-reject (C4)**       | **Fires in BOTH modes**, with softened (mode-neutral) wording. The byte-identical-member check stays before the mode branch.                                                                                                                       | A practice submit of an unchanged clone still gets useful "you changed nothing, this holds slot #2" feedback and avoids a degenerate self-vs-twin projection. One rule, least code. Detail wording de-compete-framed. |
| 8   | **Placement semantics**      | **Unchanged — out of scope.** Keep join-if-room and multiple-slots-per-author. The practice default already kills the reported iteration-pollution because trials no longer mutate.                                                                | Tightest scope, smallest blast radius. Revisit multi-slot-per-author / stricter placement separately if it proves real post-launch.                                                                          |
| 9   | **Bad `X-Compete` problem**  | Reuse **`/problems/malformed-request`** (same type as a bad handle).                                                                                                                                                                              | Consistent with the existing malformed-header handling; no new problem type for a header-parse failure.                                                                                                       |
| 10  | **No `mode` echo field**     | The response does **not** carry an explicit `mode` field. Presence of `projection` vs `title` disambiguates a cleared bot; an uncleared bot mutates nothing in either mode, so mode is moot.                                                       | Keeps the response lean; the two distinct field names already encode the branch.                                                                                                                             |

## Rollout — 2 TDD slices, PR each, every deploy stays green

**Slice 1 — API + all contract copy.** The mutation-decoupling + every LLM-facing surface that
states the API _contract_, so nothing teaches a stale flow the moment the default flips:

- **API** (`src/http/handle-fight.ts` + `api/fight.ts`): `X-Compete` parsing (decision #2), practice-default
  branch that skips both `commitArena` sites, `projection` response (decision #5), mirror-reject kept in both
  modes with neutral wording (#7).
- **Spec** (`src/cli/gen-spec.ts` `submitSection()`): rewrite the "clear → title shot" line + curl block to
  teach practice-default + `X-Compete: true`. Regenerates `docs/spec.md`, the `/spec` endpoint, the prerendered
  `/spec-guide`, and the raw `/spec.md` fallback — the drift test forces the regen.
- **`web/public/llms.txt`**: the authoring-loop summary, the `POST /fight` blurb, and (contract-level) the
  `/ring` blurb.
- **`web/src/pages/home/HowItWorks.tsx`**: `starterPrompt()` (the pasteable "website prompt"), the `fightSnippet()`
  curl, and the `clear-gauntlet` / `challenge-king` STEP descriptions.
- **Ring page** (`web/src/pages/ring/RingPage.tsx`): send `x-compete: true` on its existing submit so the web
  courier keeps crowning exactly as today — keeps every Vercel deploy consistent while slice 2 is built.

**Slice 2 — web UX.** The interactive iterate → `projection` → "Claim the throne" two-step ring flow, plus only
the UI-specific microcopy (projection labels, the compete button). The ring stops auto-competing; the human/LLM
sees the projection and deliberately claims.

**Consistent message on every surface:** _the default `/fight` is a footprint-free practice run that projects
where you'd land; add `X-Compete: true` once the bot is good enough to actually claim the throne._

## Out of scope (explicit)

- Placement/ranking semantics (join-if-room, per-author slot limits) — decision #8.
- Rate-limiting the now-cheap practice path — no rate limiting exists today; practice adds no new compute over
  the current `/fight` (same ~140 fights), so no new abuse surface. Separate concern if it arises.
- A `/replay` for practice runs — practice archives nothing (decision #3).

## Non-negotiable invariants — untouched

Platform-layer only. No DSL op, no `src/engine/` TCB change, no `INPUT_HASH` / `BENCHMARK_VERSION` bump
(invariant #2). Determinism, bounded DSL, and same-pre-tick-snapshot are unaffected — practice/compete is a
pure transport/orchestration branch over the existing deterministic `benchmark()` + throne store.
