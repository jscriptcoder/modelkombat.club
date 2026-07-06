# Platform HTTP API — resolved design decisions

Resolved via `grill-me` (2026-07-05). This is the pre-planning source of truth for
the LLM bot-authoring HTTP API — the first piece of the **platform layer** (the
deep-karate combat tree is complete; see `docs/STATUS.md`). Feeds `story-splitting`
→ `planning` → TDD.

## The loop (what we're building)

One URL you hand an LLM. It reads a **self-describing spec** (what the game is, the
bot DSL, and where to submit), authors a JSON bot, and POSTs it. Every submission runs
the **frozen gauntlet as a qualifier**; clearing it earns a **title shot** against the
reigning **King of the Hill**. The response is **visible-only** ("like a real fight"),
enough for the LLM to learn and try again.

```
POST bot ─► validate ─► gauntlet gate ─┬─ fail ─► visible per-member results (retry fuel)
                                        └─ pass ─► title fight vs reigning KotH
                                                    ├─ win  >50% ─► take the throne
                                                    ├─ lose       ─► visible title-fight result
                                                    └─ empty throne ─► crowned immediately
```

## Resolved decisions

| #   | Decision               | Choice                                                                                                                                                                                                                                                                                                                            | Rationale                                                                                                                                                                                                                                                                                             |
| --- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Opponent model**     | Frozen gauntlet as a **gate**, KotH as the **apex**. Clear the gauntlet → title shot; empty throne → clearing crowns you.                                                                                                                                                                                                         | Unifies generalize-vs-adapt: you must _generalize_ (beat a diverse field) to earn the right to _adapt_ (challenge one king). Natural difficulty curve for the LLM.                                                                                                                                    |
| 2   | **Gate threshold**     | Win-rate **> 50% vs each** of the 6 gauntlet members (head-to-head over its ~20 fights = seeds × both sides).                                                                                                                                                                                                                     | Honors "beats all of them" — no member it can't handle — without demanding a flawless 120-0. Strict `>` also resolves the exact-tie edge. Computable directly from `perOpponent[]`.                                                                                                                   |
| 3   | **Title-fight format** | Mirror the gauntlet protocol (~20 bouts); challenger must win **> 50%** to dethrone.                                                                                                                                                                                                                                              | Robust (not decided by one PRNG draw); consistent bar with the gate; **king retains on a tie** falls out for free (10-10 → incumbent keeps it).                                                                                                                                                       |
| 4   | **Seed policy**        | **Fixed, disclosed** seeds for the gauntlet; **fresh, hidden** seeds for the title fight (returned post-hoc for replay).                                                                                                                                                                                                          | Practice is reproducible & A/B-testable (clean learning signal); the throne can't be pre-tuned. Anti-overfit sits exactly where it matters. Fresh seeds do **not** break determinism — seed selection is API-layer entropy _outside_ the pure sim; given the seed the fight replays byte-identically. |
| 5   | **Feedback richness**  | **Compact egocentric report**: gate/title verdict + per-member pass/fail + per-matchup visible outcomes (scores, `endReason`, foul counts) + aggregated S8 degrade diagnostics ("your kicks were locked 40% — gassed").                                                                                                           | High signal, leak-free, reuses `BenchmarkResult` + `FighterFrame.degrade`. Full per-tick tape deferred to a later opt-in `/replay`.                                                                                                                                                                   |
| 6   | **State model**        | **Stateless authoring** (each POST is a complete fresh bot) + **one global throne** (champion document held server-side, undisclosed). No accounts/sessions in v1.                                                                                                                                                                | Simplest; matches the offline benchmark; the LLM's "learning" lives in its own context. The throne is the only persistent state.                                                                                                                                                                      |
| 7   | **Sync vs async**      | **Synchronous.**                                                                                                                                                                                                                                                                                                                  | Measured: ~82ms for the 120-fight gauntlet warm (~0.68ms/fight); a full submission (gate 120 + title ~20 = ~140 fights) ≈ **96ms** — far under any serverless budget. Async job/poll is unjustifiable at this scale.                                                                                  |
| 8   | **Throne versioning**  | **Version-scoped throne**, keyed by the benchmark/ruleset version. A version bump (new move, rebalance, `INPUT_HASH` flip) starts a **fresh empty throne**.                                                                                                                                                                       | Honest (no title under defunct physics); reuses existing versioning; storage keys by version from day one → no migration debt.                                                                                                                                                                        |
| 9   | **Spec composition**   | **Layered envelope.** `GET /spec` = canonical `generateSpec()` output + a short **version-neutral** "what this game is" narrative in the _core_ spec (helps offline authors too, like D2's senshu prose) + an **API envelope layered at serve time** (submit URL + POST request/response contract) kept _out_ of the hashed spec. | Self-describing _and_ byte-stable — the deployment URL never enters the drift-tested / `INPUT_HASH`-folded artifact.                                                                                                                                                                                  |
| 10  | **Endpoint surface**   | `GET /spec` · `POST /validate` · `POST /fight`.                                                                                                                                                                                                                                                                                   | Matches the original roadmap. `/validate` (validator gate → ok / structured `ValidationError[]`, no fight) lets the LLM iterate on structural validity cheaply; validation is a clean distinct concern and reuses the built validator.                                                                |

## Visibility principle (the "nothing internal" rule, made precise)

Three distinct visibility concepts — do not conflate:

1. **In-fight perception** (the bot's DSL reads during the sim): already modeled —
   delayed snapshot, `opponent.*` on the `L_act`/`L_pos` layers, invariant #4. Solved.
2. **Post-fight feedback** (what the LLM _trainer_ sees to improve): a spectator sees
   _behavior_ (positions, actions, scores) — which is legitimately **more** than the
   bot perceives — but never the opponent's **bot document** (their playbook), the
   **title-fight seeds**, or engine internals a spectator couldn't infer.
3. **Never disclosed:** the reigning champion's / gauntlet bots' documents, and the
   fresh title-fight seeds (until returned post-hoc, and only for _that_ fight).

Scouting is legitimate; handing over the enemy's source is not.

## Engineering requirements (defaults — recorded, to confirm at planning)

- **Atomic throne swap.** Version-keyed throne record updated via compare-and-swap:
  read current king → evaluate title fight against it → CAS crown _iff the throne is
  still that king_; if it moved under us, reject with "throne changed, resubmit" (or
  re-evaluate). Serializes simultaneous dethronements. Low-traffic-simple, correct.
- **Throne record schema (decided):** key = ruleset/benchmark version; value =
  champion bot document + crowning metadata (title-fight seeds used, result, and the
  optional **unverified author handle**). Storage _tech_ (Vercel KV / Blob / Edge Config
  / Postgres) deferred to planning.
- **Bot `model` field (author provenance, in the document).** Optional `model?: string`
  on `BotDoc`, a **sibling of `name`**: _what authored the fighter_ (e.g. `"Claude Opus
4.8"`, `"ChatGPT 5.5"`, `"human"` by convention). Free-form, length-capped,
  **unverified** (self-declared). **Inert** — the validator checks shape/length only, the
  interpreter never reads it (determinism-safe, invariant #1) and it adds **no DSL op** (the
  TCB ops allowlist is untouched, invariant #2). Optional ⇒ absent ⇒ byte-identical. The 6
  frozen gauntlet files stay **without** it so `INPUT_HASH` / `BENCHMARK_VERSION` are
  unchanged (adding it to a frozen file would flip the hash → throne reset, decision 8 —
  avoid); documenting it in `docs/spec.md` is a version-neutral regen (the spec is **not**
  in `INPUT_HASH`) + a drift-test update. **Distinct from the envelope `handle` (below):**
  `model` = who _built_ the fighter (travels with the archived / replayed / hall-of-fame
  doc); `handle` = who _submitted_ this entry. A verified-provenance mechanism (enabling a
  trustworthy per-`model` leaderboard) is deferred — v1's `model` is descriptive only.
- **Author handle (optional, unverified).** A submission may carry an optional author
  handle, shown alongside the crown + the bot's `name`; **unverified** (no auth) and
  labeled as such. It is envelope metadata, NOT part of the validated bot document
  (keeps the DSL doc pure) — exact transport (header vs request envelope) deferred to
  planning. Impersonation remains possible in v1 (low-stakes); real anti-impersonation
  is deferred with accounts (decision 6). Old-version thrones (below) keep their handle.
- **Retention — hall of fame (keep all).** Every version's final champion persists as a
  historical record ("King of v15, v16, …"); the active throne is always the current
  version's. Records are tiny ⇒ no cleanup/expiry logic and no clock dependency. A future
  read surface could expose the champions history; not required for v1.
- **Abuse hygiene:** per-IP rate limit + HTTP body-size cap (Vercel WAF/firewall
  available). The bot document's _internal_ worst-case cost is already bounded by
  `LIMITS` at validation (invariant #3).
- **Title-fight variance-farming — ACCEPTED for v1 (known limitation).** Fresh title
  seeds + stateless/anonymous unlimited retries mean a ~50/50-vs-the-King bot can
  eventually win a 20-bout title fight by resubmitting. Not enforced against in v1: no
  per-attempt budget is possible without the identity model we deferred (decision 6),
  and bot-hash keying is trivially dodged. The 20-bout aggregate filters genuinely weak
  bots; rate-limiting is the soft brake. Mitigation lever if it bites: more title bouts
  (tighter win-rate) — does not reopen decision 3's >50% bar.
- **TCB unchanged.** No DSL op touches host/network/fs/time/randomness. The API is a
  transport + orchestration layer over the canonical `validate` / `runFight` /
  `benchmark` (invariant #2).
- **Mirror rule at the gate.** To clear, a bot must win **>50% vs each of the 6**; a
  member it did _not_ beat — including one it is byte-identical to (`benchmark()`'s
  `sameDoc` no-mirror skip) — counts as **not-passed**. So copying a gauntlet fighter
  can never clear the gate. Implementation choice deferred to planning: either disable
  the skip for the API (the self-clone fights to ~50% and naturally fails) or treat a
  skipped member as not-passed — identical gate result.
- **The gauntlet IS the frozen benchmark.** The API's gauntlet run reuses the frozen
  `benchmark-config.ts` manifest at the current `BENCHMARK_VERSION` — same roster
  (jabber/rekka/zoner/grappler/sweeper/vulture), same seeds (1..10), `maxTicks 600`, and
  `MATCH` config. That version string is the throne's version key (decision 8) and the
  `version` field in the `/fight` response. One source of truth; no parallel gauntlet
  definition.
- **Observability (v1):** each request logs `{ endpoint, version, cleared?, title
outcome, latency, status }`; every crowning / dethroning emits a structured log line —
  on Vercel's built-in function logs. No dashboards/alerts/metrics backend in v1.
- **Testing strategy:** handler _logic_ is TDD'd as pure functions — invoke the handler
  with a constructed request, assert the response envelope (success + each problem+json
  branch) — no running server needed, consistent with the engine's pure-function bent
  and strict RED-GREEN-MUTATE. Deployment is verified by a post-deploy **smoke test**
  (GET /spec 200 + shape) — an integration check, not a unit test. State (S4 throne) is
  tested against an in-memory/faked store; the real store binding is a thin adapter.
- **Dependency posture.** `@vercel/node` (if used) is a **devDependency only** — types +
  local `vercel dev`; the runtime is platform-provided, so the "no runtime deps" invariant
  holds and the `src/engine` import path stays dep-free. Prefer **Web-standard
  `Request`/`Response` handlers** (`(req: Request) => Response | Promise<Response>`) — typed
  by `@types/node` globals (no Vercel-specific import), and ideal for the pure-function
  handler tests above (construct a `Request`, assert the `Response`). Whether `@vercel/node`
  is needed at all is confirmed at S1 planning against current Vercel docs.

## API response contract (cross-cutting — all endpoints)

Every error response is **RFC 9457** `application/problem+json`:
`{ type, title, status, detail }` plus an extension member **`errors`** carrying the
validator's structured `ValidationError[]` when a bot was rejected. `type` is a
relative URI ref (e.g. `/problems/invalid-bot`). Machine-parseable so an LLM caller can
reason about _why_ its bot was rejected. Status mapping:

| Condition                                                 | Status                | `type`                               |
| --------------------------------------------------------- | --------------------- | ------------------------------------ |
| Body is not parseable JSON / wrong `Content-Type`         | 400                   | `/problems/malformed-request`        |
| Unsupported `Content-Type`                                | 415                   | `/problems/unsupported-media-type`   |
| Well-formed JSON but the bot fails the validator gate     | 422                   | `/problems/invalid-bot` (+ `errors`) |
| Request body exceeds the size cap                         | 413                   | `/problems/payload-too-large`        |
| Rate limit exceeded                                       | 429 (+ `Retry-After`) | `/problems/rate-limited`             |
| Wrong HTTP method for the route                           | 405                   | `/problems/method-not-allowed`       |
| Throne changed under a challenger mid-crown (S4 CAS loss) | 409                   | `/problems/throne-moved`             |
| Unexpected server fault                                   | 500                   | `/problems/internal`                 |

Success responses are ordinary `application/json`. This contract is referenced by every
story's acceptance examples.

**`POST /fight` success (200)** — the compact egocentric report, \*\*per-opponent aggregate

- overall diagnostics\*\*:

```jsonc
{
  "version": "v19", // ruleset/benchmark version scored on (throne anchor)
  "cleared": true, // won >50% vs EACH of the 6 gauntlet members
  "gauntlet": {
    "seeds": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // fixed, disclosed
    "perOpponent": [
      {
        "name": "zoner",
        "winRate": 0.35,
        "wins": 7,
        "losses": 13,
        "draws": 0,
        "net": -54,
        "passed": false,
        "endReasons": { "gap": 4, "time": 15, "senshu": 0, "overtime": 1 },
      },
      // …6 entries
    ],
  },
  "diagnostics": {
    // egocentric, aggregated over ALL the submitted bot's frames
    "degrade": {
      "unaffordable": 12,
      "out-of-band": 3,
      "locked": 40,
      "inert": 0,
    },
  },
  "title": {
    // PRESENT ONLY when cleared (S4); absent in S3
    "outcome": "crowned", // "crowned" | "king-retained" | "throne-empty-crowned"
    "winRate": 0.55,
    "seeds": [
      /* fresh, hidden during the fight, returned post-hoc for replay */
    ],
    // …visible title-fight summary, same egocentric shape, opponent doc NEVER included
  },
}
```

Never includes any opponent's bot document or internal state (visibility principle). The
`title` block is omitted entirely in S3 (no throne yet); it appears in S4 only when
`cleared` is true.

## Proposed vertical slices (sketch — refine in `story-splitting`)

1. **`GET /spec`** — layered envelope; version-neutral game narrative into the core
   spec; serve-time API envelope. Stateless, no fights.
2. **`POST /validate`** — expose the validator gate → ok / structured errors.
3. **`POST /fight` (gauntlet gate only, stateless)** — validate → `benchmark()`
   gauntlet → gate predicate (>50% per member) → compact egocentric report. The thin
   seam; reuses `BenchmarkResult` + S8 aggregation. **No throne yet.**
4. **The throne (stateful)** — version-keyed throne store + title fight (fresh hidden
   seeds, returned for replay) + dethrone-on->50% + empty-throne bootstrap + atomic CAS.
5. **(Later) `/replay` + full visible tape** — deferred opt-in.
6. **(Cross-cutting)** rate-limit + payload cap config.

## Deferred / out of scope for v1

- Per-author sessions, accounts, leaderboards, throne lineage (decision 6).
- Full per-tick replay tape in `/fight` (decision 5 → later `/replay`).
- Trainer _strategy_ prompting — that's the caller's prompt wrapped around the neutral
  spec, not an API feature. No strategy presets in v1.
- Async job/poll (decision 7 — revisit only if fight counts balloon).
