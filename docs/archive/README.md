# Archived plans & design records

Completed vertical-slice **plans** and their resolved-decisions / acceptance-criteria
records. Per the planning workflow each plan file was deleted from `plans/` when its
feature shipped; they are recovered here (verbatim from git history, then run through
the current Prettier) as the design trail behind the engine. The live status + roadmap
are in **`docs/STATUS.md`**; the design rationale is in `docs/DESIGN.md` + `docs/spec.md`.

> **Naming caveat.** Roadmap capabilities are **C1–C8** (walking skeleton → sweeps).
> The §7 tie-resolution **stories** are _also_ numbered C1/C2/C3 (senshu / overtime /
> senshu-perception). So `c3-height-bands.md` is roadmap **C3**, but `c2-overtime.md`
> and `c3-senshu-perception.md` are §7 tie-resolution **stories**, not roadmap C2/C3.
> `*-split.md` / `*-story-split` files are story-splitting docs; `*-decisions.md` are
> find-gaps records.

## Core combat tree (roadmap C1–C8)

- **C1 — walking skeleton** (PRs #1–#5): [walking-skeleton.md](walking-skeleton.md)
- **C2 — perception-latency keystone** (PRs #7–#11): [perception-latency.md](perception-latency.md)
- **C3 — height bands** (PRs #15–#16): [c3-height-bands.md](c3-height-bands.md)
- **C4 — vertical axis + occupancy** (PRs #17–#21): [c4-vertical-axis-occupancy.md](c4-vertical-axis-occupancy.md)
- **C5 — parry windows** (PRs #23–#25): [c5-parry-windows.md](c5-parry-windows.md)
- **C6 — on-contact cancel combos** (PRs #26–#28): [c6-cancel-combos.md](c6-cancel-combos.md)
- **C7 — throw triangle + knockdown** (PRs #29–#33): [throw-triangle.md](throw-triangle.md)
- **C8 — sweeps + limited okizeme** (PRs #35–#38): [c8-sweeps-okizeme.md](c8-sweeps-okizeme.md)

## Canonical frame table (PRs #44–#49)

- [canonical-frame-table.md](canonical-frame-table.md) — the plan
- [canonical-frame-table-decisions.md](canonical-frame-table-decisions.md) — find-gaps decisions

## C10 — stamina economy (PRs #51–#65)

- [c10-stamina.md](c10-stamina.md) — Story 1 (self meter)
- [c10-stamina-split.md](c10-stamina-split.md) — the story split (Stories 2–4)
- [c10-stamina-story2.md](c10-stamina-story2.md) — guard contact-chip
- [c10-stamina-story3.md](c10-stamina-story3.md) — gassing penalty
- [c10-stamina-story4.md](c10-stamina-story4.md) — opponent stamina read
- [c10-canonical-stamina.md](c10-canonical-stamina.md) — canonical wiring

## C9 — multi-move "real karate" arsenal (PRs #67–#76)

- [c9-arsenal-foundation.md](c9-arsenal-foundation.md) — band-legality gate + jab
- [c9-arsenal-split.md](c9-arsenal-split.md) — the story split
- [c9-gyaku-zuki.md](c9-gyaku-zuki.md) — reverse punch
- [c9-mae-geri.md](c9-mae-geri.md) — front kick
- [c9-mawashi-geri.md](c9-mawashi-geri.md) — roundhouse + `scoreByBand`
- [c9-cross-move-cancels.md](c9-cross-move-cancels.md) — the rekka cancel web
- [c9-canonical-arsenal.md](c9-canonical-arsenal.md) — canonical wiring + `strike` retirement

## LLM benchmark + match structure

- **LLM one-shot bot-authoring benchmark v1** (PRs #79–#86, #95): [llm-benchmark-v1.md](llm-benchmark-v1.md)
- **Benchmark WKF match structure** — yame + win condition (PRs #87–#93): [benchmark-match-structure.md](benchmark-match-structure.md)

## §7 match officiating

- **Story-split tracker** (§7 remainder, PRs #97–#114): [s7-match-structure.md](s7-match-structure.md)
- **Capability A — jogai** (ring-out, PRs #97–#99): [jogai-out-zone-reset.md](jogai-out-zone-reset.md) · [jogai-warning-ladder.md](jogai-warning-ladder.md) · [penalty-perception.md](penalty-perception.md)
- **Capability B — passivity** (non-engagement, PRs #100–#103): [passivity-clock.md](passivity-clock.md) · [passivity-penalty.md](passivity-penalty.md) · [passivity-self-read.md](passivity-self-read.md) · [passivity-opponent-read.md](passivity-opponent-read.md)
- **Capability C — tie resolution** (PRs #104–#110): [senshu-tiebreak.md](senshu-tiebreak.md) (C1) · [c2-overtime.md](c2-overtime.md) (C2) · [c3-senshu-perception.md](c3-senshu-perception.md) (C3)
- **Capability D — benchmark + spec senshu adoption** (PRs #113–#114): [d-benchmark-spec-adoption.md](d-benchmark-spec-adoption.md)
- **Item 3 — jogai benchmark + spec adoption** (v15, PRs #147–#149): [jogai-benchmark-adoption.md](jogai-benchmark-adoption.md) — the jogai slice of the deferred officiating adoption (ring-aware zoner + naive-victim sweeper)
- **Item 3 — passivity benchmark + spec adoption** (v16, PRs #151–#153): [passivity-benchmark-adoption.md](passivity-benchmark-adoption.md) — the passivity slice (non-engagement clock scored + taught + CI-locked "exercised" on the frozen roster; jabber field-read carrier + vulture standoff victim; limit 240)
- **Item 3 — overtime benchmark + spec adoption** (v17, PR #154, **CLOSES item 3**): [overtime-benchmark-adoption.md](overtime-benchmark-adoption.md) — the overtime slice (sudden-death _encho-sen_ scored + taught + CI-locked "fires" on the frozen roster; jabber multi-reads `clock.overtime`; ticks 300; 7 natural fires, no victim shaping — inherently decisive)
- **Item 3 — officiating adoption decisions** (shared jogai/passivity/overtime grill record): [item3-officiating-adoption-decisions.md](item3-officiating-adoption-decisions.md) — the resolved carriers / params / decisions feeding all three adoption PRs

## Batch-1 arsenal expansion (real-karate move roster)

Design source of truth (living): [../move-roster.md](../move-roster.md) — balance law + the 6 resolved Batch-1 frame blocks.

- **`uraken` — backfist** (move #1/6; Slice 1 wiring #117, Slice 2 `rule()` readers #118): [uraken-backfist.md](uraken-backfist.md)
- **`shuto` — knife-hand** (move #2/6; Slice 1 wiring #120, Slice 2 `rule()` readers #121): [shuto-knife-hand.md](shuto-knife-hand.md)
- **`yoko-geri` — side kick** (move #3/6; Slice 1 wiring #123 → benchmark v7, Slice 2 `rule()` readers #124): [yoko-geri-side-kick.md](yoko-geri-side-kick.md)
- **`ushiro-geri` — back kick** (move #4/6; Slice 1 wiring #126 → benchmark v8, Slice 2 `rule()` readers #127): [ushiro-geri-back-kick.md](ushiro-geri-back-kick.md)
- **`empi` — elbow** (move #5/6; Slice 1 wiring #129 → benchmark v9, Slice 2 `rule()` readers #130): [empi-elbow.md](empi-elbow.md)
- **`hiza-geri` — knee** (move #6/6, completes Batch 1; Slice 1 wiring #132 → benchmark v10, Slice 2 `rule()` readers #133): [hiza-geri-knee.md](hiza-geri-knee.md)

## Gauntlet modernization + rebalance ✅ COMPLETE

Re-authored the frozen benchmark gauntlet one bot per PR until all 6 members land in the
`[25%, 75%]` round-robin band **and** the roster collectively exercises the full arsenal.
Both conditions met + CI-locked at `v14`. Final board + coverage map:
[../benchmark-gauntlet-v14.md](../benchmark-gauntlet-v14.md). Parent split (the design
trail): [gauntlet-modernization-stories.md](gauntlet-modernization-stories.md).

- **S1 — `vulture` parry→counter** (PR #135 → benchmark v11): [gauntlet-s1-vulture-parry-counter.md](gauntlet-s1-vulture-parry-counter.md)
- **S-jabber — `jabber` block+counter** (PR #137 → benchmark v12; the `shuto` range-poke pivoted to a reactive block + counter): [gauntlet-s-jabber.md](gauntlet-s-jabber.md)
- **S2 — `zoner` beyond-neutral long kicks** (PR #139 → benchmark v13; `yoko-geri` + `ushiro-geri` narrow-gated to preserve calibration — the "no healthy niche" finding): [gauntlet-s2-zoner.md](gauntlet-s2-zoner.md)
- **S3 — `grappler` close-range knee + elbow** (PR #141 → benchmark v14; `empi` + `hiza-geri` knockdown→okizeme woven into the close game — **completes 11/11 coverage**; full real integration, the parry→counter-coupling finding): [gauntlet-s3-grappler.md](gauntlet-s3-grappler.md)
- **S4 — calibration lock + close-out** (PR #143; `v14` unchanged — CI lock asserting all 6 ∈ band + 11/11 coverage, plus the LF line-ending pin for a byte-stable `INPUT_HASH`): [gauntlet-s4-calibration-lock.md](gauntlet-s4-calibration-lock.md)

## Roster-wide balance-law property (PRs #145–#146) ✅ COMPLETE

A pure-data guard in `rules.test.ts` asserting no move in the full 12-move roster (the 10 named
attack moves plus `sweep` and `throw`, enumerated dynamically) Pareto-dominates another (rule 2) or
duplicates another (rule 4) across the 7 strategic axes — the long-standing "Verification hook" of
the move-roster balance law, closing out the Batch-1 arsenal. Detector/adapter are test-local
(Stryker excludes `*.test.ts`), pinned by directional fixtures. Design source:
[../move-roster.md](../move-roster.md) §Balance law.

- [no-pareto-dominance.md](no-pareto-dominance.md) — the plan + grill-me/find-gaps design trail

## Air-actions — the last combat capability (PRs #158–#167) ✅ COMPLETE

The fighter leaves the ground: horizontal jump displacement, the `air-attacking` strike
mechanic + air defense, the canonical `tobi-geri` jump-in, the `self.y` / `self.vy` /
`self.posture` air-perception surface, and the gauntlet weaponization that makes the frozen
board actually **exercise** aerial combat (v19 — rekka's jump-in connects 100/100 for a jodan
ippon, all 6 ∈ `[25%, 75%]`). See the build-log entry in `docs/STATUS.md`; final board:
[../benchmark-gauntlet-v19.md](../benchmark-gauntlet-v19.md).

- **Story split** (story-splitting tracker): [air-actions-stories.md](air-actions-stories.md)
- **Resolved decisions** (grill-me / find-gaps record): [air-actions-decisions.md](air-actions-decisions.md)
- **Story 1 — aerial mobility** (horizontal jump displacement, `jumpXSpeed` + `vx`, PR #158): [aerial-mobility.md](aerial-mobility.md)
- **Story 2 — air strikes** (the `air-attacking` mechanic + air defense + canonical `tobi-geri`, 5 slices, PRs #159/#161/#162/#163 → benchmark v18/#164): [air-strikes.md](air-strikes.md)
- **Story 3 — precise air timing** (`self.y` / `self.vy` air-perception reads, PR #165): [precise-air-timing.md](precise-air-timing.md)
- **Story 4 — gauntlet exercises aerial combat** (passivity × jump characterization + rekka `tobi-geri` weaponization + the tobi-geri adoption lock, 3 slices, PRs #166/#167 → benchmark v19): [gauntlet-aerial-rebalance.md](gauntlet-aerial-rebalance.md)

## Platform HTTP API — the LLM bot-authoring loop (first platform-layer feature)

The online loop's front door. The **overall** design source of truth (spanning S1–S4) stays
live in `plans/platform-http-api-{decisions,stories}.md`; the completed **S1–S4 plans** are
archived here.

- **S1 — `GET /spec`** (the deployment walking skeleton + self-describing layered spec + the inert `model?` `BotDoc` field; 4 slices, PRs #171–#174 → live at `https://modelkombat.club/spec`): [platform-http-api-s1-spec.md](platform-http-api-s1-spec.md)
- **S2 — `POST /validate`** (the validator gate — `200 {ok:true}` or RFC 9457 `problem+json` issues; 2 slices, PRs #176–#177; parse-first, `413` oversize, no content-type gate): [platform-http-api-s2-validate.md](platform-http-api-s2-validate.md)
- **S3 — `POST /fight`** (the stateless gauntlet gate — `cleared` verdict vs the frozen `v19` gauntlet + a compact leak-free per-member report with `endReasons` + `diagnostics.degrade`; 4 slices, PRs #178–#181; shared `src/http/` RFC 9457 envelope, advertised + rate-limited at 20 req/min via Vercel WAF): [platform-http-api-s3-fight.md](platform-http-api-s3-fight.md)
- **S4 — the version-scoped KotH throne** (the **first stateful** platform piece — a gauntlet-clearer earns a title shot; bootstrap crown → fresh-seeded title fight → dethrone on `> 0.5` else king-retained, atomic-CAS `409 /problems/throne-moved`, incumbent identity + `X-Author-Handle`, durably persisted on Upstash Redis behind a `ThroneStore` port with an in-memory fake; 5 slices, PRs #184–#188; code-complete, live-durability pending the Upstash Marketplace provisioning): [platform-http-api-s4-throne.md](platform-http-api-s4-throne.md)

## `/fight` King-challenge telemetry parity ✅ COMPLETE

A follow-up to the S4 throne surfaced by a live dogfood (a bot cleared v19 6/6 blind then took the
empty throne): the King-challenge `title` block returned only `winRate` + `bouts` + identity, even
though the title fight is a full benchmark that already computes `net` / win-loss-draw / `endReasons`
/ `degrade` — the rich data was **computed then discarded**. That made the King fight strictly less
debuggable than the gauntlet gate and set up a clear-then-dethrone **oscillation** (tuning against a
lone win-rate scalar blindly regresses a clean 6/6). Fixed at gauntlet fidelity via a new pure
`toTitleFightReport(BenchmarkResult)` shaper (sibling of `toReportOpponent`), sourcing every field
from always-defined aggregates so the no-mirror skip yields clean all-zero telemetry with no
empty-guard. Purely additive; TCB untouched. Extracting the derivation to a pure fn was **required**
to kill the `losses = bouts − wins − draws` mutant (draws are unrealizable through a real title fight,
so it's only reachable via a synthetic-`draws` unit test — the repo's established shaper-test pattern).
PR #250, 2026-07-10; TDD + 100% mutation on both changed regions:
[king-telemetry-parity.md](king-telemetry-parity.md)

## Public page — the newcomer front door (first web-UI feature) ✅ COMPLETE

The public single-page site: a Vite + SolidJS app that Vercel builds and serves at `/`,
replacing the static placeholder, while `/spec` · `/validate` · `/fight` keep resolving. The
feature spans 5 slices (1 skeleton → 2 King data → 3 podium → 4 SVG hero → 5 fights teaser),
all shipped + **live at `https://modelkombat.club/`**. With the whole feature landed, the
spanning design/roadmap docs are archived here alongside the slice plans.

- **Design decisions** (grill-me / find-gaps record): [public-page-decisions.md](public-page-decisions.md)
- **Story split** (story-splitting tracker): [public-page-stories.md](public-page-stories.md)

- **Slice 1 — the walking skeleton** (1a `web/` deploy skeleton, PR #195; 1b how-it-works explainer + spec/fight CTA, PR #196; 1c sticky nav + footer + CSS-native reduced-motion scroll, PR #197 → live at `https://modelkombat.club/`): [public-page-s1-skeleton.md](public-page-s1-skeleton.md)
- **Slice 2 — who rules the ring** (2a `GET /king`, PR #200 — a version-scoped, **identity-only** reigning-King read reusing `ThroneStore.read` as-is via a `handleKing` seam + thin `api/king.ts`, advertised in the serve-time `/spec` envelope with **no `INPUT_HASH`/`BENCHMARK_VERSION` bump**, `503 /problems/throne-unavailable` when the store rejects; 2b King section, PR #201 — a Solid `createResource` with an injectable `fetchKing` prop rendering loading/error+Retry/empty-throne-CTA/populated states + a `#king` nav anchor): [public-page-s2-king.md](public-page-s2-king.md)
- **Slice 3 — the Hall of Kings podium** (3a `GET /king` recent lineage, PR #204 — a bounded, identity-only `recent(version, limit)` **`ThroneStore` port** read (fake `slice(-limit)` + Upstash `LRANGE champions:{v} -limit -1`, `interpretRecentReply` throws on error), pinned by the shared `runThroneStoreContract`; `handleKing` reads pointer + lineage under one try → `{ current, recent }` newest-first, `503` on either; `championIdentity` now strips C0/DEL control chars for `/king` **and** `/fight`; **no `INPUT_HASH`/`BENCHMARK_VERSION` bump**; 3b podium, PR #205 — a Solid `<Podium>` `createResource` with an injectable `fetchRecent` prop, three gold/silver/bronze medal slots filling `recent[0..2]` with **dimmed placeholders** for sparse 1/2 states + an anchored honest-empty for 0, a `#champions` nav anchor + labelled landmark region, CSS truncation + single-column ≤480px): [public-page-s3-podium.md](public-page-s3-podium.md)
- **Slice 4 — the SVG logo-headed hero + logo system** (4a brand marks on the cards, PR #208 — a web-layer `modelToBrand` classifier (lowercase + fixed-priority substring match, first-match-wins, `claude` → `gpt`|`openai` → `gemini`|`google`|`bard`, else a neutral "mystery challenger") + four in-house nominative inline SVG marks rendered as an accessible `<svg role="img" aria-label="authored by X">`, retrofitting the King/podium `🥷` heads (absent model → generic mark, no "null" leak), covered by an **exhaustive exact-assertion fixture table** since web logic is outside the Node/Stryker scope; 4b the face-off hero, PR #209 — a static SVG of three logo-headed stickmen (Claude · OpenAI · Gemini) in karate stances squaring off, exposed as one labelled scene with decorative heads, replacing the placeholder text hero + keeping the `<h1>` + tagline, `clamp()`-sized for ≤360px no-scroll (AC-R1), extracting the shared `<BrandMark brand label?>` primitive both consumers use; **no `INPUT_HASH`/`BENCHMARK_VERSION` bump**): [public-page-s4-hero.md](public-page-s4-hero.md)
- **Slice 5 — the fights "coming soon" teaser + nav finalize** (PR #212 — the last slice: an honest `#fights` "⏳ Fight replays — in development" section after the Hall of Kings with a keyboard-reachable `aria-disabled` (not native `disabled`) replay control carrying a visible "Replays — in development" label + a `title` tooltip enhancement, **no fabricated fight rows** (invariant #1 — fights are never persisted), plus the sticky nav's final `#fights` link between Champions and Spec; pure web/presentation, **no `INPUT_HASH`/`BENCHMARK_VERSION` bump**, verified by exact-assertion browser tests + a manual mutator scan since web logic is outside the Node/Stryker scope — the `aria-hidden` name-leak and empty-description survivors applied-then-restored): [public-page-s5-fights.md](public-page-s5-fights.md)

## Public-page content sections — Arsenal + Gauntlet (web) ✅ COMPLETE

Two static orientation sections woven into the public page — **both shipped**. The spanning
design trail (the story split `arsenal-gauntlet-stories.md` carrying the S2 Gauntlet ACs
AC-G1…AC-G9, and the S1 grill-me record `arsenal-section-decisions.md`) stayed live in `plans/`
until S2 landed, then all three archived together here.

- **S1 — The Arsenal** (PR #218 — the technique showcase: all 13 karate techniques grouped into 5
  families with romaji id + gloss + one-line descriptor + a `role="img"` score badge, an "Arsenal"
  nav anchor after "How it works", and a single end-of-section `/spec` frame-table hand-off; a
  hand-curated `readonly` roster, **presentation-only — no `INPUT_HASH` / `BENCHMARK_VERSION`
  ("v19") / TCB change**; 5 ordered TDD increments, browser-mode exact-assertion + a manual mutator
  scan since web logic is outside the Node/Stryker scope): [arsenal-section.md](arsenal-section.md)
- **S2 — The Gauntlet** (PR #220 — the fighter bios: the 6 frozen gauntlet fighters
  (`jabber/rekka/zoner/grappler/sweeper/vulture`) in canonical `GAUNTLET_NAMES` order as a
  responsive card grid, each with a tinted `aria-hidden` monogram tile, a `move-id`-style mono name
  chip, an authored style bio, and a mono non-link signature-technique token; plus a "Gauntlet" nav
  anchor after "Arsenal", a gate-framing lede, and **no stats** (positive-absence assertion — the
  roster is balanced ~50%); **presentation-only**, roster a hand-curated `readonly` array decoupled
  from `src/engine`; 4 ordered TDD increments, browser-mode exact-assertion + manual mutator scan):
  [gauntlet-section.md](gauntlet-section.md)
- **Spanning design trail** (both sections): the story split
  [arsenal-gauntlet-stories.md](arsenal-gauntlet-stories.md) (AC-G1…AC-G9 for S2) and the S1
  grill-me record [arsenal-section-decisions.md](arsenal-section-decisions.md).

## Public-page rendered spec page — /spec-guide (web) ✅ COMPLETE

The raw `/spec` markdown (built for LLMs) gets a **human-readable rendered page** at `/spec-guide`,
plus a generic per-section deep-link mechanism — **both shipped**.

- **Rendered spec page** (PR #223 — the Nav "Spec" link opens `/spec-guide`, a Solid page that
  fetches the live `/spec` markdown and renders it to HTML with `marked` (the only web markdown dep,
  injected via `innerHTML` — a trusted same-origin source, so no sanitiser), with loading /
  error+Retry / success states mirroring the King card; a **no-router** second page via a shared
  `SPEC_PATH` constant feeding both the Nav `href` and a `main.tsx` `window.location.pathname` switch
  (Vercel's SPA catch-all already serves it — no `vercel.json` change); a slim brand header + tab
  title + `.spec-doc` styling with the main page's 2px section separators and self-scrolling tables;
  `/spec` stays raw for LLMs and the `Cta`/`King` links are untouched; **web-only plus the `marked`
  dep, no `INPUT_HASH` / `BENCHMARK_VERSION` / TCB change**; 2 ordered TDD increments, browser-mode
  exact-assertion + a manual mutator scan since web logic is outside the Node/Stryker scope):
  [web-spec-page.md](web-spec-page.md)
- **Arsenal frame-table deep link** (PR #224 — the Arsenal "…see the full frame table" hand-off now
  targets `/spec-guide#frame-table`, built **generically**: every rendered heading gets a deduped
  URL-safe slug id via a dep-free custom `marked` renderer, and a `createEffect` scrolls the URL's
  `#hash` section into view after the async content renders, so **any** section is `/spec-guide#slug`;
  headings carry `scroll-margin-top` to clear the sticky header. Gotcha fixed under TDD: reading a
  Solid `createResource` accessor inside an effect **re-throws** in the error state → gate on
  `spec.state === "ready"`. **web-only, no new dependency**):
  [web-arsenal-frametable-deeplink.md](web-arsenal-frametable-deeplink.md)

## Web SSG / prerender — LLM- & crawler-readable pages (web) ✅ COMPLETE

Build-time **prerendering (SSG)** makes the `web/` home page **and** `/spec-guide` server-visible to
LLMs and crawlers — a no-JS fetch now returns real HTML, not an empty `<div id="root">` shell — while
**Current King** + **Hall of Kings** stay client-side. Not a SolidStart/SSR-server migration: a
hand-rolled post-build `tsx` script over a Vite **SSR build** of `entry-server.tsx` + a **hydratable**
client build. **Three slices, PR per slice**; the plan + resolved grill-me decisions:
[web-prerender-ssg.md](web-prerender-ssg.md).

- **Slice 1 — canonical absolute spec/fight URLs** (PR #231 — a single `CANONICAL_ORIGIN`
  (`https://modelkombat.club`) feeds the shown/copied spec + fight URLs so they are pasteable into an
  LLM from any environment and stable at build time; the `href`s stay the relative `/spec`. This
  **reverses** the prior "follow the serving origin, never a baked-in host" design — SSG has no runtime
  origin and the starter-prompt affordance needs an absolute URL).
- **Slice 2 — prerender + hydrate the home page** (PR #232 — `vite-plugin-solid({ hydratable })` client
  build + a Vite SSR build of `entry-server.tsx`'s `renderApp` (sync `renderToString`) + a post-build
  `scripts/prerender.ts` injecting the rendered body into `#root`; King/Podium fetches deferred to the
  client via a `createClientResource` source-signal gate so the prerender shows their empty fallback and
  the first hydrated frame agrees; `App`'s head side-effects moved into `onMount`. **KEY GOTCHA:**
  `renderToString` alone doesn't hydrate — the HTML must also carry Solid's `generateHydrationScript()`
  (`window._$HY`) in `<head>`, else `hydrate()` silently no-ops and a **prod** build emits **no** warning
  (Solid strips dev warnings); verify in a dev-mode build. A `toContain("_$HY")` unit test guards it).
- **Slice 3 — `/spec-guide` as fully static HTML, no client JS** (PR #233 — `SpecPage` becomes a pure
  presentational component (`spec` prop → semantic HTML; drops the `/spec` fetch, loading/error/Retry,
  the custom hash-scroll effect, and the SSR-unsafe `document.title`); `renderSpecGuidePage` renders
  `generateSpec()` (**envelope omitted**, called **unbundled** in the prerender for correct `bots/*.json`
  fs paths) into `dist/spec-guide.html` with a distinct `<head>` (title + canonical from
  `CANONICAL_ORIGIN` + `SPEC_PATH`), the reused hashed CSS, and **every `<script>` stripped** (module
  bundle + JSON-LD) — zero client JS, native `#section` deep-links via slug-id headings; `main.tsx` only
  ever hydrates the home `App`, so the now-dead `isSpecRoute` (+ its test) are removed and `marked` +
  `SpecPage` leave the client bundle. **web-only, no `INPUT_HASH` / `BENCHMARK_VERSION` ("v19") / TCB
  change**; node-vitest render tests + a manual smoke on the built `dist/`).

## Web `/ring` — the browser bot-submit loop (web) ✅ COMPLETE

The submit + iterate loop closed in the browser: a human holding LLM-authored JSON opens **`/ring`**,
pastes the bot document + an author handle, POSTs it to the live `POST /fight` (LLM platforms can't
POST — the human is the courier), and reads the full fight card **and** the raw `/fight` JSON to hand
back to the LLM. A single-page `ring.html` + `ring.tsx` client-render (no prerender/hydration — the
fetch is button-triggered). **Four slices, one PR each**, all live + smoke-verified 2026-07-09; the
whole feature — plan + `grill-me` decisions + `find-gaps` record — is one file:
[web-ring-submit.md](web-ring-submit.md).

- **Slice 1 — walking skeleton** (PR #237 — paste + `POST /fight` + an outcome headline for each of the
  four outcomes + the raw pretty-printed response in a scrollable `<pre>` with a reused `<CopyButton>`;
  a `postFight?` prop seam resolving `{ status, body }` for **any** HTTP response (problem+json bodies
  are content the human must see/copy), rejecting only on a true network failure or the 30s
  `AbortController` timeout; one generic error state; `vite` multi-page input + a `vercel.json` `/ring`
  rewrite before the SPA fallback, verified not to regress the prerender pipeline).
- **Slice 2 — the full fight card** (PR #238 — the result expands from a headline into a card: one row
  per `gauntlet.perOpponent` entry in frozen `GAUNTLET_NAMES` order (win-rate percentage + a **text**
  pass/fail marker, never colour alone), the `title` block by outcome (first-King / dethrone / held-throne
  celebration), the scouted `incumbent` (name + `<ModelLogo>` + non-null handle + win-rate + bouts, never
  the King's DSL), all above the persistent raw-copy block; local `web/src` view-model types mirroring the
  contract, **no `src/engine` import**).
- **Slice 3 — every failure state + handle polish** (PR #239 — precise human-readable states replacing the
  generic banner: the **422 `/problems/invalid-bot`** validator issues as a readable `path: reason` list,
  inline handle validation mirroring `readHandle` + trim (empty/`>64`/control-char, 63/64/65 boundary), the
  409 throne-moved resubmit prompt, 413/405/network transport errors, submit disabled in-flight, and a
  `localStorage`-remembered handle degrading silently when storage is blocked; pure logic in flat
  `web/src/ring-handle.ts` + `web/src/ring-fight-error.ts` sibling modules).
- **Slice 4 — discoverability** (PR #240 — the finale, placed last so we never drove traffic to a
  half-built page: a same-tab Nav "Ring" link + a filled-accent Hero CTA ("Send your bot into the ring →"),
  both to `/ring`; a `sitemap.xml` `<url>` (priority 0.9) + an `llms.txt` "Send a bot into the ring" entry
  framed for the reading LLM; both surfaces verified by a browser-mode `ring-discovery.test.tsx` that
  `fetch`es the served files and parses the sitemap with a real `DOMParser`). **Presentation + two static
  files only — no `INPUT_HASH` / `BENCHMARK_VERSION` ("v19") / TCB change** across the whole feature. Like
  the other web work, `web/src` logic is outside the Node/Stryker scope ⇒ exhaustive exact-assertion
  browser-mode tests + a manual mutator scan, each slice preview-smoked on Vercel before merge.

## Web King sections — single `/king` fetch + no-JS endpoint link (web) ✅ COMPLETE

Two small follow-ups tightening the King / Hall-of-Kings sections on the home page (2026-07-09).
Presentation-only, **no `INPUT_HASH` / `BENCHMARK_VERSION` ("v19") / TCB change**; `web/src` logic is
outside the Node/Stryker scope ⇒ exact-assertion browser tests (+ SSR render tests) and a manual mutator
scan. Only the endpoint-link slice needed a written plan; it is archived here.

- **Single `/king` fetch** (PR #245 — `King` and `Podium` each fetched `/king` independently, so the
  home page fired two identical requests for a payload the endpoint returns whole (`{ current, recent }`).
  Lifted ONE `createClientResource` into `App`, which now owns the fetch and feeds **presentational**
  `King` (`current`) and `Podium` (`recent`) plus shared `loading` / `error` / `onRetry`; one request
  feeds both, a Retry from either re-runs it. Props optional + default to the empty state, so the
  prerender/hydration contract is unchanged). No plan doc (a direct refactor).
- **No-JS `/king` endpoint link** (PR #247, superseding auto-closed #246 —
  because the fetch is client-side, the prerender bakes only the **empty-state fallback** into the static
  HTML, so LLM/crawler visitors saw the empty copy with no pointer to the live data. Added a followable
  `<a href="/king">https://modelkombat.club/king</a>` inside each empty `<Show>` fallback (mirrors the
  `/spec` link: relative href, absolute text). Empty-fallback ONLY (a populated card/podium replaces it;
  loading/error never render it); **no SSR data fetch**. GOTCHA: hydratable SSR splits the
  `{CANONICAL_ORIGIN}` text with `<!--$-->…<!--/-->` hydration markers, so tests assert `href` at the SSR
  level and the exact absolute link text at the browser accessible-name level):
  [king-fallback-endpoint-link.md](king-fallback-endpoint-link.md)

## KotH ladder — S1 arena skeleton (N=1, behavior-preserving) ✅ COMPLETE

The first slice of the version-scoped King-of-the-Hill **ladder** (the roadmap item after the S4 single
throne): re-architect the single-champion throne into a top-N **ranked arena record** with a
generation-guarded atomic commit + a per-version seniority counter, configured at **N=1** so `/fight`
and `/king` stay **byte-for-byte identical**. Platform-layer (`src/http`) only — **TCB untouched**, no
DSL op, no engine change, **no `INPUT_HASH` / `BENCHMARK_VERSION` bump**. Design trail (still live for
S2–S5): `plans/koth-ladder-{decisions,stories}.md`. Both implementation slices were TDD'd at 100%
mutation on the changed files.

- **Slice 1 — the arena store record** (PR #251 — `readArena` / `commitArena` on the `ThroneStore` port,
  implemented across the in-memory fake **and** the Upstash Lua adapter together and pinned by the shared
  `runThroneStoreContract`; `commitArena` is one atomic unit that swaps the arena record **and** appends
  arena #1 to the crowning lineage via the shared `lineageEntryOf`, so `read()`/`recent()` — and the
  "Gen N" display — stay byte-identical; no consumer wired ⇒ zero observable change).
- **Slice 2 — `/fight` crowns through the arena** (PR #252 — `handleFight` reworked to `readArena` → pure
  `rankArena({arena, challenger, winRates})` → `commitArena`, byte-identical `/fight` responses; the
  entrant is stamped with the next seniority; the incumbent scouts arena #1 via
  `incumbentOf(lineageEntryOf(arena))`; the local `crown` helper became `commit`. `rank-arena.ts` is the
  N=1 seam S2 widens to win→net→seniority. GOTCHA: the two 409 tests were rewired to model an **arena**
  race — the failing test that demanded the migration off `read()`/`compareAndSwap`).
- **Refinement:** the old single-throne crown path (`compareAndSwap`, `CROWN_SCRIPT`, `buildCrownRequest`,
  `interpretCrownReply`) is **kept prod-unused** and retired in **S3** with the lineage — `handle-fight`
  simply stopped calling it, avoiding a double-churn of `handle-king`'s tests. `/king` + podium unchanged.

[koth-ladder-s1-arena-skeleton.md](koth-ladder-s1-arena-skeleton.md)

## KotH ladder — S2 the ranked arena becomes real (N=3, first multi-champion behavior) ✅ COMPLETE

The second story of the KotH **ladder**: flip the arena cap from N=1 to **N=3** and make it a true top-3
that churns. A gauntlet-clearer now runs a **deterministic round-robin** against the current arena on the
frozen version seeds (D-A), is ranked by **win → net-points → seniority** (D2), and **crowns (#1)**, **enters
as a defender (#2–#3)**, or is **unplaced** — a full arena **relegates its weakest**, and byte-identical
resubmits / relegated re-entries behave per **C4 / D3**. `/fight` speaks the C7 vocab (`crowned` / `entered` /
`unplaced` + `rank`), through to `web/src/RingPage.tsx`. Platform-layer (`src/http` + its `web/` consumer)
only — **TCB untouched**, no DSL op, no engine change, **no `INPUT_HASH` / `BENCHMARK_VERSION` bump**. Design
trail (still live for S3–S5): `plans/koth-ladder-{decisions,stories}.md`. Each slice TDD'd at **100%
mutation** on the changed files (web presentation manual-scanned — outside the node-only Stryker scope).

- **S2.1 — rank + crown/enter while filling** (PR #253, `feat/arena-ranked-fill-n3`) — N→3 for the
  **non-full** case: a round-robin (`arena-standings.ts`: challenger-vs-defenders + defender-vs-defender) on
  the frozen seeds, ranked win→net→seniority by the widened pure `rankArena`, **joins if there's room** (C2 — a
  loser to the King now ENTERS as a defender, not "king-retained"). Outcome vocab migrated to C7 `crowned` /
  `entered` / `unplaced` + `rank` (D-B; first-King vs dethrone told apart by incumbent **presence**, not a
  distinct string), through `RingPage`. `commitArena` is now **King-succession-aware** (D-E `sameKing`, keyed
  on the unique seniority stamp) — it appends to the lineage only when `arena[0]` changes, else a non-crowning
  placement would duplicate the sitting King in `/king recent`. Full-arena → `unplaced` **placeholder** (D-D).
  Prod cap `ARENA_N = 3` in `api/fight.ts`.
- **S2.2 — relegation once full + full-parity unplaced** (PR #254, `feat/arena-relegation`) — removed the
  S2.1 D-D short-circuit: a full arena runs the **same** round-robin, `rankArena` gained `n` and cuts to the
  top N (`slice(0,n)` survivors, `slice(n)` = the single relegated defender), widening `ArenaPlacement` with
  `displaced` (identity-only, via the shared `championIdentity` / `memberIdentity` extracted into
  `champion-identity.ts`). An `unplaced` clearer reads **full parity** — it genuinely fought the #1 King, so it
  carries the same King-fight telemetry + `incumbent` scout as a placement; it commits **nothing** (the arena
  keeps its own top N).
- **S2.3 — mirror-reject (C4) + re-entry (D3), closes S2** (PR #255, `feat/arena-mirror-reentry`) — a
  submission byte-identical to a current member (`sameDoc`, now **exported** from `benchmark.ts` — shared with
  the gauntlet's no-mirror rule) is rejected as a no-op with **`409 /problems/arena-mirror`** naming the held
  1-based slot, read **before** the gauntlet gate (one arena snapshot feeds both the mirror guard and the
  placement) — honoring C4 "no benchmark run". A **relegated** veteran is no longer in `members`, so the guard
  doesn't fire — it re-competes as a fresh entrant (D3); a deterministic committed re-entry is impossible
  without a matchup cycle, so the D3 test characterizes "relegated ≠ mirror → **200 unplaced, not 409**". WEB:
  `ring-fight-error.ts`'s `typeOf` splits the two 409s → a new `mirror` `FightError` kind → a `RingPage` alert
  with **no retry button** (resubmitting the same bot just 409s again); throne-moved keeps its Resubmit button.

[koth-ladder-s2-ranked-arena.md](koth-ladder-s2-ranked-arena.md)

## KotH ladder — S3 the podium + `/king` show the ranked arena ✅ COMPLETE

The third story of the KotH **ladder**: move the **read side** off the append-only crowning lineage and onto
the ranked arena record S2 made real, then retire the lineage "bridge" and the prod-unused single-throne crown
path — leaving the arena record as the single source of truth for both the write side (`/fight`) and the read
side (`/king` + podium). Platform-layer (`src/http` + its `web/` consumer) only — **TCB untouched**, no DSL op,
no engine change, **no `INPUT_HASH` / `BENCHMARK_VERSION` bump**. Design trail (still live for S4–S5):
`plans/koth-ladder-{decisions,stories}.md`. Each slice TDD'd at **100% mutation** on the changed files (web
presentation manual-scanned — outside the node-only Stryker scope).

- **S3.1 — `/king` + podium read the ranked arena** (PR #257, `feat/king-arena-podium`) — `GET /king` now reads
  `readArena`: `current` = arena[0], `recent` = arena[1..] **by rank** (identity-only via `memberIdentity`, **no
  `generation`**). The web podium (`Podium.tsx`) renamed **"Hall of Kings" → "The Arena"**, composing
  `[current, ...recent]` into gold/silver/bronze with the **gold step badged "King"**; `App` still owns ONE
  `/king` fetch, feeding both the hero and the arena. Confirmed product decisions: podium = "The Arena" (King as
  gold, hero spotlights #1 separately); **drop `generation`** from the `/king` entry contract AND the web
  `Champion` type (the throne CAS token was never meant public; medal rank is the standing). GOTCHA: the King now
  appears in BOTH the hero AND as gold in The Arena → App tests scope name lookups by region
  (`within(king)`/`within(arena)`), never bare `findByText` counts.
- **S3.2 — retire the single-throne lineage + crown path, closes S3** (PR #258, `refactor/retire-single-throne-lineage`)
  — a pure refactor/removal (`+153 / −946`): the `ThroneStore` port shrank to **`readArena` + `commitArena`**,
  dropping `read` / `recent` / `compareAndSwap` (port + fake + Upstash + shared contract), `lineage()`, the
  `commitArena` lineage append + `sameKing` gate, and the dead `ThroneRecord` / `CasResult` / `lineageEntryOf` /
  `InMemoryThroneStore` exports. Upstash: deleted `CROWN_SCRIPT` + the read/recent/crown builders & interpreters;
  `COMMIT_ARENA_SCRIPT` simplifies to `GET → compare → SET → ok` (one key, no conditional `RPUSH`).
  `champion-identity.ts` retired `championIdentity` + `ChampionIdentity.generation`; `handle-fight`'s incumbent
  scout became `memberIdentity(arena.members[0])` (byte-identical). Characterization guard (the existing `/fight`
  incumbent + S3.1 `/king` tests) + an empty-grep proof; the simplification even retired the old Lua-string
  smoke-verified survivors → clean **100% mutation, 0 survived**.

[koth-ladder-s3-podium-arena.md](koth-ladder-s3-podium-arena.md)

## KotH ladder — S4 placement telemetry (the per-defender board) ✅ COMPLETE

The fourth story of the KotH **ladder**: generalize PR #250's single-King title telemetry from **1 King → N
defenders** — every gauntlet-clearer (crowned, entered, OR unplaced) reads back a rank-ordered per-defender
**board** of `{ defender identity } + { winRate / W-L-D / net / endReasons / degrade }` (board[0] = the King),
at the same fidelity a gauntlet row carries. Non-placers get the full board too (the #250 parity ethos:
diagnose _why_, don't guess from a lone win-rate); defender **documents are never exposed** — identity only
(`memberIdentity`), the standings are already public via `/king` + podium (C5). Platform-layer (`src/http` +
its `web/` consumer) only — **TCB untouched**, no DSL op, no engine change, **no `INPUT_HASH` /
`BENCHMARK_VERSION` bump**, no spec change. Design trail (still live for S5): `plans/koth-ladder-{decisions,stories}.md`
(D1–D7, C1–C7 — **C7** governs the response contract, **D-C** the King-fight-doubles-as-scout). Each slice TDD'd
at **100% mutation** on the changed `src/http` files (web presentation manual-scanned — outside the node-only
Stryker scope). The planned "render + retire" was split at the S4.1 CONFIRM gate into S4.2 (web render) + S4.3
(retire the flat scout), mirroring the S3.1/S3.2 add-then-retire precedent.

- **S4.1 — `/fight` returns the per-defender board (additive)** (PR #260, `feat/arena-placement-telemetry`) —
  `roundRobin` now threads out **all** `challengerFights` (was only `kingFight`); the board is built inline as
  `arena.members.map((m, i) => ({ defender: memberIdentity(m), ...toTitleFightReport(challengerFights[i]) }))`
  and added to the three title returns (`board: []` on the empty-arena bootstrap crown). **Additive** — the flat
  King scout (`winRate` / `incumbent` / …) stayed so the web `/ring` consumer kept working. 100% mutation (112
  killed); the board reuses `toTitleFightReport`, whose `losses = bouts − wins − draws` derive was already killed.
- **S4.2 — `/ring` renders the per-defender board (additive read)** (PR #261, `feat/ring-placement-board`) — the
  fight card swaps the single King scout block for a rank-ordered defender list (name + model mark + handle
  by-line + win-rate + beat/lost text, board[0] tagged **King** — text markers, never colour alone); `titleView`
  reshapes to read `title.board`, `outcomeHeadline` decides first-King vs dethrone by **board emptiness**.
  `readBoard` (sibling of `readIncumbent`) + `beatLabel` + `.ring-defender-*` CSS. After this slice the web reads
  **only** `board`. Verified by exhaustive exact-assertion browser tests + a manual mutator scan (web is outside
  Stryker's node scope); the defensive malformed-entry filter is pinned by its own test.
- **S4.3 — retire the redundant flat King scout, closes S4** (PR #262, `refactor/retire-fight-flat-scout`) — a
  pure `src/http` cleanup (`+102 / −61`): dropped the `scout` local + both `...scout` spreads, so `/fight`'s
  `title` simplifies to `{ outcome, rank?, board, displaced? }` — `board[0]` is now the SOLE King-fight source
  (identity in `board[0].defender`, telemetry inline). Web-invisible (it read `board` since S4.2). The node tests
  migrated the flat-scout reads to `board[0]` + added two "flat scout absent" guards (the RED driver);
  `champion-identity.ts` doc comments refreshed (`incumbent` → `board[].defender`). Clean **100% mutation** (111
  killed, one fewer than S4.1 — the retired scout expression).

[koth-ladder-s4-placement-telemetry.md](koth-ladder-s4-placement-telemetry.md)

## KotH ladder — S5 reproduction archive (last-K + pinned) ✅ COMPLETE — closes the ladder

The **fifth and final** story of the KotH **ladder**: every gauntlet-clearing fight becomes replayable raw
material. Each clearer's **reproduction record** — `{ challenger doc, defender docs, seeds, version,
memberSeniority }`, **docs + seeds, never a tape** (invariant #1 — fights regenerate via `runFight`) — is
archived **atomically with the arena commit** (C3's one gen-guarded `{swap arena if placed} + {append + evict}`
unit), **count-bounded to the newest K** with current arena members' records **pinned** so everything _live_ is
always replayable, un-pinning the instant a member relegates (D6). **No HTTP read surface ships** — that's the
parked `/replay` + Pixi viewer; this slice only guarantees the docs+seeds exist. Platform-layer (`src/http`)
only — **TCB untouched**, no DSL op, no engine change, **no `INPUT_HASH` / `BENCHMARK_VERSION` bump**. Both
slices TDD'd; `handle-fight.ts` + `throne-store.ts` at **100% mutation**; the Upstash adapter's atomic-commit
Lua is verified by the env-gated **live smoke test** (the documented "Lua-string survivors = smoke-verified
exception" — every real Redis op is keyword-pinned).

- **S5.1 — archive every clearer's record atomically (walking skeleton, unbounded)** (PR #264,
  `feat/reproduction-archive`) — the `ThroneStore` port grows `readArchive` + an optional `record` arg on
  `commitArena` (append INSIDE the gen-guard, so a lost CAS race writes nothing — arena OR archive). The
  in-memory fake, the Upstash adapter (2-key EVAL: `SET` arena + guarded `RPUSH` record; `LRANGE` read), and the
  shared `runThroneStoreContract` (inherited by the live smoke test — cleanup DELs the `archive:` key too) all
  extend together. `handle-fight` builds the record via one `reproRecord` closure and commits it at all three
  sites — bootstrap (defenders `[]`, seniority 1), placement (defenders fought, its seniority), and the
  **non-placer, which now commits** (arena byte-identical, `memberSeniority` null; the S2.2 `commits 0→1` flip
  drove this). 100% mutation (223 killed / 0 survived).
- **S5.2 — bound to newest-K with pinned members, closes S5** (PR #265, `feat/archive-eviction-pinning`) — a pure
  `retainArchive(records, pinnedSeniorities, limit)` ("newest K + up to N pinned") + `DEFAULT_ARCHIVE_LIMIT` (50,
  tunable) in `throne-store.ts`; the fake applies it (pin set from the committed `next.members`); the adapter's
  EVAL grew a Lua eviction (`LRANGE → filter → DEL → RPUSH survivors`; pin table from the decoded next arena; K as
  `ARGV[4]`). **`handle-fight` untouched** — the store owns the pin set, so relegation un-pins with no handler
  change. The REFACTOR widened the pin-set param to `ReadonlySet<number | null>`, dropping a redundant TS-only
  null guard → eliminated the sole equivalent mutant (`throne-store.ts` 100%).

[koth-ladder-s5-reproduction-archive.md](koth-ladder-s5-reproduction-archive.md)

**Ladder complete (S1–S5).** The KotH ladder design trail — `koth-ladder-decisions.md` (D1–D7, C1–C7) +
`koth-ladder-stories.md` (the story split) — was kept live in `plans/` across S1–S5 and is now archived here
alongside the slice plans. Remaining ladder-adjacent roadmap items (`/replay` endpoint + Pixi viewer, real
seasons) are separate, out of the ladder feature's scope.

## Variety telemetry — S1a (pooled move-usage histogram) ✅ COMPLETE

The first shipped capability of the **variety-telemetry harness** — the instrument `DESIGN §P7`
calls for, to tune move balance ("no move > ~35% usage") from measurement instead of guesswork.
`npm run telemetry` runs the frozen 6-bot gauntlet as a both-sides, all-seeds round-robin and prints
a pooled **honoured-commitment** histogram over the **13 techniques** (11 attack moves + `throw` +
`sweep`): dominant moves (raw share > 35%) flagged `⚠`, dead moves visible as explicit `0.0%`. A
**pure read-only reduction** over existing `runFight` output — `FightResult.events[].{a,b}` already
carry `action` + `degrade`, so there is **no** engine/TCB change, **no** `INPUT_HASH` /
`BENCHMARK_VERSION` bump, and `npm run fight` stays byte-identical. Mirrors the benchmark trio:
`src/engine/telemetry.ts` (pure core) + `src/cli/run-telemetry.ts` (pure CLI) + `src/cli/telemetry.ts`
(thin fs shell). Both slices TDD'd at **100% mutation**.

- **Slice 1 — pooled usage histogram + dominance flag** (PR #270, `feat/variety-telemetry-s1a`) —
  `reduceUsage(fights)` pools every honoured commitment (`action.type ∈ {attack,throw,sweep}` AND
  `degrade === null`) over both fighters into a per-technique count/share, flagging
  `share > USAGE_FLAG_THRESHOLD` (0.35); `runVariety` drives the `i ≠ j` round-robin keeping `events`.
  Rows sort share-desc with the canonical frame-table order as a **stable-sort** tie-break — the
  `indexOf` arithmetic was dropped, its `-`→`+` mutant being unkillable because rows are built
  already-canonical. CLI presentation mutants are killed by exact-`toBe` render tests (space runs
  spelled `" ".repeat(n)`).
- **Slice 2 — provenance header + small-sample caveat** (PR #271,
  `feat/variety-telemetry-header-caveat`) — the report opens with a header (mirroring
  `run-benchmark.ts`'s block): version / population roster / `N bots · S seeds · round-robin = F
fights · C honoured commitments`, plus a caveat line when `population.length < SMALL_POPULATION`
  (30) so low-N reference-roster figures aren't misread as discovered LLM behavior. Added `totalFights`
  to `VarietyReport` (the drift-proof fight denominator) + a pure `renderHeader`. The
  `SMALL_POPULATION` literal + comparison-operator mutants need a **hardcoded-29/30** boundary test —
  deriving the sizes from the imported constant leaves the value mutant alive.

[variety-telemetry-s1a.md](variety-telemetry-s1a.md)

## Variety telemetry — S1b (enrichment: diversity · adoption · `--json` · override) ✅ COMPLETE

The enrichment story that turns the S1a pooled histogram into the full first-class variety
instrument: a diversity headline, a tempo-neutral per-bot adoption column, machine-readable
`--json`, and a population override so the same command profiles any supplied bot set. **Four
PR-slices**, each still a **pure read-only reduction** over `runFight` (no engine/TCB change, no
`INPUT_HASH` / `BENCHMARK_VERSION` bump, `npm run fight` byte-identical), extending the same trio
(`src/engine/telemetry.ts` + `src/cli/run-telemetry.ts` + `src/cli/telemetry.ts`). Each slice TDD'd
at **100% mutation** on the two changed pure-logic files (the thin fs shell is smoke-verified glue,
outside the node Stryker scope).

- **Slice 1 — diversity headline (effective-move-count + live/dead)** (PR #273,
  `feat/variety-telemetry-diversity`) — the report closes with `effective moves 7.2 of 13 · live 13 /
dead 0`: `effectiveMoves` = `exp(Shannon entropy)` of the pooled shares (Hill q=1, "how many of the
  13 are effectively in rotation"), added to `VarietyReport` and computed in `reduceUsage` (a
  `share > 0` guard skips `0·ln0`; `totalCommitments === 0` ⇒ `null`, rendered `n/a`, never `NaN`),
  plus the live/dead split with the dead-move list in canonical frame-table order. REFACTOR split the
  `⚠` legend out of `renderReport` (table-only) into `renderLegend` + added `renderDiversity`, composed
  **table → diversity → legend**. GOTCHA: the `legend ? … : ""` else-branch StringLiteral survivor needs
  a `stdout.endsWith(renderDiversity + "\n")` no-legend-tail assertion (containment misses appended junk).
- **Slice 2 — per-bot adoption (k/N) + mean per-bot share** (PR #274, `feat/variety-telemetry-adoption`) —
  the one **structural** slice: each row gains **adoption** `k/N` (distinct bots that honour the move
  ≥once, counted once, honoured-only) + a tempo-neutral **mean per-bot share** (mean over participating
  bots of each bot's own share; `n/a`/`null` when nobody committed). Since `reduceUsage(FightResult[])`
  carries no bot identity, `runVariety` now builds bot-indexed **matchups** `{a, b, fight}` + a pure
  `reducePerBot(matchups, botCount)` closure. **TYPE SPLIT** to stay honest: `PooledRow`/`PooledReport`
  (what `reduceUsage` returns) vs `UsageRow`(+`adoptingBots`,`meanShare`)/`VarietyReport`(+`botCount`)
  (enriched, from `runVariety`). GOTCHA: a null-branch **conditional-spread** left an equivalent-by-
  accident survivor → refactored to a null-**filter** type-predicate so every mutant is observable;
  the mean divides by PARTICIPATING bots, not `botCount`.
- **Slice 3 — `--json` versioned envelope** (PR #275, `feat/telemetry-json-envelope`) — `npm run telemetry
-- --json` emits the report AS DATA: a **versioned envelope** `{version, population, report}` (refines
  locked decision #7 "raw `VarietyReport`" — `--json` drops the human header, the only place version +
  roster appear, so the envelope preserves that provenance for run-to-run diffs; `report` IS the raw
  enriched report). `runTelemetryCli` gained an `argv` **first** param (mirrors `runBenchmarkCli(argv,
deps)`); the thin shell passes `process.argv.slice(2)`. Test round-trips the full report via
  `expect(JSON.parse(stdout).report).toEqual(runVariety(…))` — one assertion kills every field-drop mutant.
- **Slice 4 — population override + fail-fast load + mirror-skip** (PR #276,
  `feat/telemetry-population-override`) — closes S1b: `npm run telemetry -- <path…>` profiles a supplied
  bot set (no args ⇒ the frozen gauntlet, unchanged); a bad bot fails loudly (structured stderr + exit 1,
  **never a partial population**); a byte-identical dup never fights its clone. Deps `loadPopulation()` →
  `loadBot(path)` + `loadGauntlet()`; positional argv = the override paths (`--` flags filtered, so
  `--json` is order-independent); path input = **shell-expansion** (dep-free — no glob library). Two
  survivor-kills via the "refactor to make mutants observable" pattern: the pairing guard `a === b ||
sameDoc` had an equivalent `false || sameDoc` (self-pairs are byte-identical too) → simplified to just
  **`sameDoc(botA, botB)`**; the `flatMap(… : [])` else-branch was unreachable → rewritten as a fail-fast
  **`reduce`** loader + a bad-first test proving the short-circuit is load-bearing.

[variety-telemetry-s1b.md](variety-telemetry-s1b.md)

**S1a + S1b complete; harness ongoing.** The sibling scoping + story-split docs —
`variety-telemetry-harness.md` (grill-me: 8 resolved decisions) + `variety-telemetry-stories.md` (story
split S1a–S5c) — stay live in `plans/` as the trail for the remaining stories **S2–S5** (opener win-rate,
degrade-rate + spacing, scoring attribution, committed board / web surface).
