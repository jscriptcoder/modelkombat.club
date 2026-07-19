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

## Variety telemetry — S2 (opener win-rate + sample-gated §P7 flag) ✅ COMPLETE

The second child story: the opener win-rate readout — `DESIGN §P7`'s **second** balance dial ("no
opener > ~60% win") — beneath the S1 usage histogram. Each fighter's **opener** (its first honoured
commitment) is joined to that fighter's `FightResult.winner` outcome; `winRate = wins/opens` with **draws
in the denominator** (matching `benchmark.ts`'s `wins/bouts`), and over-winning openers are flagged `⚠`
**gated by a sample floor** so a small hand-authored population doesn't false-alarm. **Two PR-slices**,
each a **pure read-only reduction** over `runFight` (no engine/TCB change, no `INPUT_HASH` /
`BENCHMARK_VERSION` bump, `npm run fight` byte-identical), extending the same trio. Each slice TDD'd at
**100% mutation** on the two changed pure-logic files. Design hardened via find-gaps (S2-1…S2-8).

- **Slice 1 — opener win-rate table** (PR #279, `feat/variety-telemetry-s2-openers`) — a pure
  `reduceOpeners(matchups)` (sibling of `reduceUsage` / `reducePerBot`, reusing the S1b `Matchup{a,b,fight}`
  - `honouredTechnique`): `openerOf` = each side's FIRST honoured commitment, joined via `outcomeFor` to
    `FightResult.winner` (win/loss/draw); `winRate = wins/opens` with a ÷0 guard; rows sorted **win% desc →
    opens desc → canonical**, never-opened (`—`) techniques last. `VarietyReport` gains `openers` +
    `nullOpeners`; `renderOpeners` prints the 2nd section (+ the null-opener line); `--json` carries it for
    free. Two survivor-kills via the "refactor to make mutants observable" pattern: a redundant `opened`
    pre-filter (the per-technique filter already excludes nulls) deleted, and the branchy null-comparator
    (V8's insertion sort can't decisively exercise it) replaced with a **two-list sort** (live openers
    sorted, then dead appended) so row count + order are load-bearing → 100%, 0 survivors.
- **Slice 2 — sample-gated §P7 flag** (PR #280, `feat/variety-telemetry-s2-flag`) — `OPENER_FLAG_THRESHOLD`
  (0.60) + `MIN_OPENER_SAMPLE` (10) exported named constants; `OpenerRow` gains `dominant = opens >=
MIN_OPENER_SAMPLE AND wins/opens > OPENER_FLAG_THRESHOLD` (the sample floor short-circuits the divide —
  no ÷0, no null test). An opener above 60% but below the floor shows its N + win% but earns **no** flag
  (kills the 1-open-100% noise). `renderOpeners` gains a `⚠` column; `renderOpenerLegend` prints the
  footnote iff ≥1 opener is dominant. GOTCHA: the natural `winRate !== null && …` guard is a **runtime
  equivalent** (opens≥10 ⇒ non-null) — computing `dominant` from `wins / opens` directly (short-circuit-
  guarded) removes it → 100%, 0 survivors. Hardcoded boundary tests (opens = 10 vs 9, exactly-60%) pin
  the literals.

[variety-telemetry-s2.md](variety-telemetry-s2.md)

## Variety telemetry — S3a (per-move start-failure rate) ✅ COMPLETE

The third child story: a per-technique **start-failure rate** — `DESIGN §P7` Metric 5 ("which moves are
chosen but keep failing to execute, and via which gate?") — beneath the S1 usage histogram + S2 opener
table. For each technique, a **start attempt** is a frame that chose it and was NOT `locked`; a non-null
degrade is a gate **failure**. `rate = failedStarts / attempts`, with **`locked` excluded from both
numerator and denominator** (a busy fighter's ignored input while committed to an already-honoured move,
not a failed pick — else every slow-but-fine move reads ~100%). `honoured(X)` equals `reduceUsage`'s usage
count, so the sections reconcile as `attempts = usage + failedStarts`. A **single PR-slice** (no flag to
isolate + integration proven by S1a/S1b/S2), a **pure read-only reduction** over `runFight` (reads only
`.action` + `.degrade`; no engine/TCB change, no `INPUT_HASH` / `BENCHMARK_VERSION` bump, `npm run fight`
byte-identical). Design hardened via find-gaps (S3a-1…S3a-8).

- **Slice 1 — the start-failure section** (PR #283, `feat/variety-telemetry-s3a-degrade`) — a pure
  `reduceDegrades(fights)` (sibling of `reduceUsage`) with `FAILURE_REASONS = {out-of-band, unaffordable,
wrong-context, inert}` (a `satisfies DegradeReason[]` tuple, `locked` deliberately absent); per-technique
  frame filtering (`techniqueOf === X && degrade !== "locked"`) so both guards stay load-bearing on the
  counts. `VarietyReport` gains `degrades`; `renderDegrades` prints the 3rd section (cols
  `move·N·fail·rate·<4 reasons>`, the reason counts summing to `fail`), rows sorted **rate desc → attempts
  desc → canonical** via the S2 **two-list** split (`—` for 0-attempt), **no ⚠ flag** (diagnostic only),
  - a note cross-referencing the usage histogram; `--json` carries `degrades` additively (round-trip test
    covers it). Two survivor-kills via "refactor to make mutants observable": the `technique === null` skip
    guard was equivalent-by-construction (leaked nulls match no technique row) → **folded into the
    per-technique `=== X` equality** so `!== "locked"` moves `attempts` directly (the locked tests pin it);
    plus an all-four-reasons distinct-count test made the `wrong-context` / `inert` buckets load-bearing →
    **100% mutation** on both `telemetry.ts` (273) + `run-telemetry.ts` (204), 0 survivors. Real-gauntlet
    finding: start-failures are almost entirely `unaffordable` (moves picked but not affordable under the
    stamina gate), plus `tobi-geri`'s aerial `wrong-context`.

[variety-telemetry-s3a.md](variety-telemetry-s3a.md)

## Variety telemetry — S3b (reach-zone occupancy histogram) ✅ COMPLETE

The fourth child story: a **reach-zone occupancy histogram** — `DESIGN §P7` Metric 6 ("which reach zones do
fights actually happen in?") — beneath the S1 usage / S2 opener / S3a degrade sections. Each **tick**
contributes ONE inter-fighter distance `|a.x − b.x|` (symmetric ⇒ denominator = total ticks, NOT 2×),
partitioned into **5 coarse reach tiers** at the reach-ladder cut points (throw 120k / reverse 240k /
roundhouse+startGap 300k / ushiro 330k): `clinch · hand · kick · poke · out`. All frames counted, no
exclusions (a yame-reset re-approach or okizeme clinch is genuine spacing). A **single PR-slice** (no flag,
integration proven by S1a/S1b/S2/S3a), a **pure read-only reduction** over `runFight` (reads only `.x`; no
engine/TCB change, no `INPUT_HASH` / `BENCHMARK_VERSION` bump, `npm run fight` byte-identical). Design
resolved via a grill-me pass (S3b-1…S3b-9) — the bucketing being the roadmap's named pre-plan blocker.

- **Slice 1 — the reach-zone section** (PR #286, `feat/variety-telemetry-s3b-occupancy`) — a pure
  `reduceOccupancy(fights)` (sibling of `reduceDegrades`, but ONE sample **per tick** not per fighter) that
  buckets via `ZONE_UPPER = [120k, 240k, 300k, 330k]` + `findIndex(d < upper)` with `i === -1 ? "out"` — a
  design that keeps **every cut point AND the catch-all branch load-bearing** (no equivalent-mutant redundant
  `hi` field). `VarietyReport` gains `occupancy: OccupancyRow[]`; `renderOccupancy` prints the 4th section
  (cols `zone·distance·frames·share%`) in **fixed near→far order** — NOT share-desc, because the distance
  axis is intrinsically ordered (the S3b divergence from S1a/S2/S3a) — with an `n/a` ÷0 guard and **no ⚠
  flag** (diagnostic only); `--json` carries `occupancy` additively (round-trip test covers it). **100%
  mutation on the FIRST run** — 533 killed (`telemetry.ts` 299 + `run-telemetry.ts` 234), 0 survivors, 0
  no-coverage. Real-gauntlet finding: fights concentrate in **hand range 64.4%** + kick 16.6%, and the >300k
  **poke zone is occupied 9.4%** (NOT spacing-dead); only 0.3% sits beyond all reach.

[variety-telemetry-s3b.md](variety-telemetry-s3b.md)

## Variety telemetry — S4 (scoring attribution) ✅ COMPLETE

The fifth child story: a **scoring-attribution** section — "which moves actually SCORE vs whiff?"
(effectiveness, not just choice) — beneath the S1 usage / S2 opener / S3a degrade / S3b occupancy
sections. Each honoured-start of a technique caught the points its `[startup, startup+active−1]` window
gained, via a **telescoping** window sum `pointsAt(hi) − pointsAt(lo−1)` (points are monotonic, so this
sums the per-tick deltas without iterating them; the whole gain ⇒ counter bonuses included). `starts`
equals `reduceUsage`'s usage count (same honoured predicate), so it reconciles with the degrade section
(`starts = N − fail`). Penalty points (jogai/passivity +1 to the opponent — the only non-move point) are
the **residual** `Σ final scores − Σ attributed`, surfaced as `excludedPenaltyPts` and reconciled in tests
to `Σ max(0, foulCount − 1)` from `FightResult.fouls` (an independent source the reducer never reads). A
**single PR-slice** (no flag, integration proven by S1a/S1b/S2/S3a/S3b), a **pure read-only reduction**
over `runFight` (reads only `.action` / `.degrade` / `.points` + per-technique `startup`/`active` from the
run's `Rules`; no engine/TCB change, no `INPUT_HASH` / `BENCHMARK_VERSION` bump, `npm run fight`
byte-identical). Design resolved via a grill-me pass (S4-1…S4-11); the plan landed in its own `docs(plan)`
PR (#288) merged before the slice.

- **Slice 1 — the scoring-attribution section** (PR #289, `feat/variety-telemetry-s4-attribution`) — a pure
  `reduceScoring(fights, rules)` — the ONE reducer that also takes `rules` (it needs each technique's
  `startup`/`active`) — structured like `reduceDegrades` (per-technique iteration, `honouredTechnique(e[side])
=== technique` folding the null-drop into the load-bearing equality — no inert null-guard). `knockdownClass`
  (sweep, hiza-geri render land/rates as `—`, they score via the okizeme finisher) is a **named set**
  `["sweep", "hiza-geri"]`, not derived from the spec. `VarietyReport` gains `scoring: ScoringRow[]` +
  `excludedPenaltyPts`; `renderScoring` prints the 5th section (cols `move·starts·land·land%·pts·pts/start`,
  sorted **pts desc → starts desc → canonical**, `—` for knockdown-class + null rates, **no ⚠ flag**, a
  trailing `excluded penalty points` line + note); `--json` carries both additively. **100% mutation** on both
  files (637 mutants, 0 survived, 0 no-coverage). KEY LESSON: the first-draft explicit per-tick-delta iteration
  had ~23 survivors (an inert null-guard, an unreachable `windowSpec === undefined` branch, redundant
  `j >= 0` / `delta > 0` guards, an excluded `starts.some(…)` predicate); **restructuring to the
  `reduceDegrades` shape + telescoping + residual penalty + a named knockdown set** killed all of them (0
  equivalents), with a defensive "honoured-but-unconfigured" test making the last engine-invariant branch
  reachable AND enforcing `starts == usage`, a both-bounds window-delta fixture pinning startup AND active, and
  startup-0 / OOB / empty-events edge tests. Real-gauntlet finding: `gyaku-zuki` 2322 starts / 86.1% land /
  3723 pts (the workhorse), and `uraken` 269 starts / 0 land / 0 pts — chosen a lot but never scores, the exact
  "chosen but bounces" signal the readout exists for.

[variety-telemetry-s4.md](variety-telemetry-s4.md)

## Variety telemetry — S5b (committed drift-guarded board) ✅ COMPLETE

The last child story with any build: a committed, always-current snapshot at `docs/variety.md` that can
never silently lie. A grill-me pass (decision #11) resolved that the S5b story text named **two
incompatible precedents** — "like `docs/benchmark-gauntlet-v19.md`" (hand-written, no generator, no drift
test) and "regenerates deterministically" (the `docs/spec.md` property) — and picked the **`docs/spec.md`
trio**: a pure `generateVariety()` → `write-variety.ts` (`gen:variety` script) → a byte-match drift test →
`.prettierignore` + `.gitattributes eol=lf` pins. A **pure read-only reduction** over the shipped harness
(no engine/TCB change, no `INPUT_HASH` / `BENCHMARK_VERSION` bump, `npm run fight` byte-identical). The
plan landed in its own `docs(plan)` PR (#291) merged before the slice.

- **Slice 1 — the committed board + drift guard** (PR #292, `feat/variety-board`) — `generateVariety()`
  (`gen-variety.ts`) is a thin markdown scaffold (H1 with `BENCHMARK_VERSION`, a manifest-sourced
  provenance line, a static §P7 orientation note) wrapping the **exact** `runTelemetryCli([], deps).stdout`
  (all five readouts) verbatim in a fenced block — so the board can never diverge from what
  `npm run telemetry` prints; the fenced inline `⚠` flags stay the single source of §P7 pass/fail.
  `docs/variety.md` is committed (evergreen — version embedded inside, history in git) and pinned by a
  drift test (`committed toBe generateVariety()`), mirroring `gen-spec.test.ts`. The shared frozen-gauntlet
  loader was extracted into `telemetry-deps.ts` (`gauntletDeps()`), now used by both the telemetry runner
  and the board generator (`telemetry.ts` deduped to its wiring). **`gen-variety.ts` 100% mutation** (7/7);
  `telemetry-deps.ts` 90.91% (1 documented equivalent — the `readFileSync` encoding arg, inert under
  `JSON.parse`'s utf8 coercion; shell I/O moved verbatim from the previously-uncovered `telemetry.ts`),
  with a loader fail-fast test killing the error-path mutants. Full suite 1760 green. Real-gauntlet board:
  `gyaku-zuki` 86.1% land / 3723 pts (the workhorse), `uraken` 269 starts / 0 land (the "chosen but
  bounces" signal), `sweep`/`hiza-geri` `—` (okizeme), `excluded penalty points: 282`.

[variety-telemetry-s5b.md](variety-telemetry-s5b.md)

## Variety telemetry — S5c (the public `/variety` page) ✅ COMPLETE

The last variety-telemetry story with a build: a **public web surface** for the move-variety board. A
newcomer opens `https://modelkombat.club/variety` and reads the frozen gauntlet's move-usage meta as a
static, prerendered, **no-JS** page — a `/spec-guide` clone, **byte-derived at build from
`generateVariety()`** (the same source as `docs/variety.md`), so it can never drift. A grill-me pass
(decision #12) resolved the design tree against the existing `web/` precedents: shape → a prerendered
`/spec-guide`-clone page (not a bespoke designed presentation); content → regenerate at build via
`generateVariety()` unbundled in `scripts/prerender.ts` (pipeline-consistency with the spec, not
`readFileSync`); discoverability → sitemap + llms.txt + one Arsenal link, **not** top-nav. A **serve-time
presentation** change only — the `web/` layer stays decoupled from `src/engine` (the only `src/` reach is
`scripts/prerender.ts` importing the already-pure `generateVariety()`); no engine/TCB change, no
`INPUT_HASH` / `BENCHMARK_VERSION` bump, `docs/variety.md` unchanged. `web/**` + `scripts/**` are outside
Stryker's node scope ⇒ exhaustive exact-assertion tests + a manual mutator scan (the `public-page-web-ui`
precedent). Two slices, PR per slice.

- **Slice 1 — the `/variety` page end-to-end** (PR #295, `feat/variety-page`) — the shared markdown
  renderer is extracted from `SpecPage` into `web/src/shared/lib/render-markdown.ts` (slug-anchored,
  trusted first-party; `SpecPage` reuses it, behavior-preserving) and drives a presentational `VarietyPage`
  (reusing the `.spec-doc` typography). `renderVarietyPage(shell, board)` mirrors `renderSpecGuidePage`
  (`injectBody → setTitle → setCanonical → stripScripts`: own `<title>` + canonical
  `${CANONICAL_ORIGIN}/variety`, zero `<script>`). `scripts/prerender.ts` calls `generateVariety()`
  unbundled → writes `dist/variety.html`; `VARIETY_PATH` + a `/variety → /variety.html` vercel rewrite (the
  page is emitted by the post-build prerender, so the client Vite build is unaffected).
- **Slice 2 — discoverability** (PR #296, `feat/variety-discoverable`) — `/variety` is added to
  `web/public/sitemap.xml` (priority 0.7) + `web/public/llms.txt` (a caveated usage/effectiveness
  meta-report under `## Optional`), and the Arsenal section gains a "how often each move actually gets used"
  hand-off link to `VARIETY_PATH` (a second peer to the `/spec-guide#frame-table` hand-off). It is
  **deliberately kept out of the primary `Nav`** — a reference-population diagnostic, not first-class site
  IA — pinned by a Nav-absence guard; the sitemap/llms surfaces are verified by a browser-mode
  `variety-discovery.test.tsx` (real `DOMParser` on the served sitemap + an `llms.txt` fetch).

[variety-telemetry-s5c.md](variety-telemetry-s5c.md)

**S1a–S5c complete; the variety-telemetry arc is done bar the no-build S5a.** The sibling scoping +
story-split docs — `variety-telemetry-harness.md` (grill-me: 12 resolved decisions) +
`variety-telemetry-stories.md` (story split S1a–S5c) — stay live in `plans/` as the trail for the one
remaining post-launch story **S5a** (an external submission corpus — no build, just the S1b `-- <path…>`
override on a submissions dir).

## `/fight` practice-by-default, compete opt-in ✅ COMPLETE

Decoupled **evaluating** a bot from **mutating the arena** on `POST /fight`. Surfaced by the live
competition: an LLM iterating against `/fight` had every gauntlet-clear seat a trial fighter into the
ladder (the **join-if-room** rule filling empty slots with same-author noise), so experimentation
polluted the standings. Now a bare `/fight` is a **footprint-free practice run** — it clears the gate,
ranks the round-robin, and returns a `projection` of where the bot would land, writing **nothing** (no
arena commit, no repro archive). Only `X-Compete: true` takes the compete-and-commit path and can claim
the throne, so a bot competes exactly when the author decides it is ready. KotH integrity is preserved:
the compete path re-verifies against the live arena under the existing CAS/`generation` guard.
Platform-layer only — **TCB untouched**, no DSL op, no engine change, **no `INPUT_HASH` /
`BENCHMARK_VERSION` bump**. Design trail: grill-me decisions [practice-compete-decisions.md](practice-compete-decisions.md)
(#1–#10, incl. practice-default, the `X-Compete` header + strict true/false parse, the distinct
`projection` response vs ground-truth `title`, read-only practice, mode-neutral mirror-reject). Both
slices TDD'd at **100% mutation** on `handle-fight.ts`.

- **Slice 1 — the opt-in practice machinery** (PR #300, `feat/fight-practice-compete`) — `readCompete`
  parses `X-Compete` (`true`→compete, `false`→practice, absent→default, else `400`); a shared `settle`
  helper unifies the three clearer outcomes (bootstrap / placement / unplaced): compete commits + returns
  `title`, practice returns the same payload as `projection` with zero writes. **Default stayed compete** —
  a pure, backward-compatible addition, so existing callers/ring/spec were untouched and the risky
  projection logic landed in isolation. Mirror-reject fires in both modes with mode-neutral wording
  (softened from the compete-framed "can't displace itself"). 100% mutation (148 killed; a merged
  true/false return kills the equivalent-object survivor).
- **Slice 2 — flip the default + align every contract surface** (PR #301, `feat/fight-practice-default`) —
  one atomic PR so no LLM-facing text ever teaches a stale flow: `readCompete` defaults absent/empty →
  **practice**; the `gen-spec.ts` `submitSection()` teaches practice-default + a practice/compete curl pair
  (regenerated `docs/spec.md`, feeding `/spec` · `/spec-guide` · raw `/spec.md`, all covered by the
  byte-match drift test); `llms.txt` (authoring-loop + `/fight` + `/ring` blurbs); `HowItWorks.tsx` (starter
  prompt, curl pair, step copy); and `RingPage.tsx` sends `x-compete: true` so the browser courier keeps
  crowning as before. Existing compete-mechanics tests kept green by making their intent explicit
  (`X-Compete: true` in the `fightRequest` test helper). 100% mutation on the flipped `readCompete`.

[fight-practice-compete.md](fight-practice-compete.md) — the plan · [practice-compete-decisions.md](practice-compete-decisions.md) — the grill-me decisions

**The interactive `/ring` two-step UX** (show the `projection` first, then a deliberate "Claim the
throne" compete button, so the browser flow stops auto-competing and mirrors the API model) shipped
as its own plan — see the next section.

## Web `/ring` — the two-step practice → claim UX (web) ✅ COMPLETE

The interactive follow-through to the practice/compete split: the `/ring` page stops auto-competing.
A bare submit is a footprint-free **practice** run whose body carries a `projection` — the ring
renders it hypothetically ("you'd dethrone the reigning King", a "defenders you'd face" board, and
crucially **no** "See the throne" link — a preview is not a crown) and offers a deliberate,
outcome-aware claim button. Clicking it fires a second POST with `X-Compete: true`; the committed
`title` (throne link) replaces the projection. So a human couriering an iterating LLM previews every
revision for free and crowns only on purpose. **web-only** — the practice/compete API was already
live — so no `INPUT_HASH` / `BENCHMARK_VERSION` ("v19") / TCB change; `web/**` is outside Stryker, so
both slices used exact-assertion browser tests + a manual mutator scan. Grill-me UX decisions (R1–R6:
claim gating to crowned/entered, any-edit-clears staleness, throne-moved retry re-previews via
practice, outcome-aware label) are captured inline in the plan.

- **Slice 1 — preview then claim** (PR #303, `feat/ring-practice-compete-ux`) — the `PostFight` seam +
  `postFightToApi` gain `compete`; `runFight(compete)` — the submit and every retry practice, only the
  claim competes. A `readPlacement()` reads committed `title` **or** preview `projection` into one
  view-model (single source for the headline + title view); `committedHeadline` / `projectionHeadline`
  frame reality vs hypothetical; `titleView` carries the defenders label, the throne link (committed
  crown only), and the outcome-aware claim label ("Take the throne" / "Claim your place"; unplaced →
  none). Deployable on its own — the happy path still crowns end-to-end, so no deploy loses crowning.
- **Slice 2 — edit invalidates a pending claim** (PR #304, `feat/ring-claim-staleness`) — a shared
  `editField(set, value)` helper applies the field update **and** resets `result`; both `onInput`
  handlers (doc + handle) route through it, so editing either after a projection clears the result +
  claim button. A claim can only ever compete the exact artifact that was previewed.

[ring-practice-compete-ux.md](ring-practice-compete-ux.md) — the plan (with the grill-me UX decisions inline).

## `/watch` fight replay viewer — S1 walking skeleton ✅ COMPLETE

The **tracer bullet** for the last platform-layer roadmap item: a spectator opens `/watch` and the
King's most-recent title fight **auto-plays as two stickmen** with a live score/tick HUD and
play/pause + restart controls. It pulls the whole production path — engine `renderTape` export →
`GET /replay` (resolve newest) + `GET /replay/{id}` (the reconstructed motion tape) → a Pixi page that
animates it — through end-to-end thin, retiring the biggest unknown (does archive→reconstruct→tape→Pixi
animate a real bout, byte-faithfully?) at the lowest feature cost. **Invariant #1 held throughout:** the
server reconstructs the tape on demand from the KotH repro archive (docs + seeds, never a persisted
tape) and returns motion + `name`/`model` identities only — **bot documents never cross the wire**
(KotH integrity + the `/fight` no-docs contract). **TCB / `INPUT_HASH` / `BENCHMARK_VERSION` untouched**;
`web/src` imports nothing from `src/`. Design trail (live in `plans/`): grill-me
[replay-viewer-decisions.md](replay-viewer-decisions.md) (13 decisions) → story-split
[replay-viewer-stories.md](replay-viewer-stories.md) (S1–S4). `web/**` is outside Stryker's
node scope ⇒ the pure `scene`/`figures`/`transport` units got exhaustive exact-assertion browser tests +
a manual mutator scan (the `public-page-web-ui` precedent).

- **Slice 1 — `renderTape` engine export** (PR #306, `feat/engine-render-tape`) — `runFight` +
  `renderTape` share a private `simulate(cfg, collectRender)` core so `FightResult` stays byte-identical
  and the benchmark hot path builds no render frames. `RenderFrame` = `{x,y,facing,posture,attacking,
attackBand,throwing,knockdown,points,stamina}` per tick per fighter, projected post-tick (posture via
  `postureOf(f, action, rules)` at the render site — never the stale pre-intake stored field). 94.29%
  scoped mutation (2 documented-equivalent survivors).
- **Slice 2 — `GET /replay` + `/replay/{id}`** (PR #307, `feat/replay-api`) — injectable
  `src/http/handle-replay.ts` (the `handle-king` GET pattern) + thin `api/replay.ts`, wired with
  `selectThroneStore` + the arena-frozen `CANONICAL_RULES`/`MATCH`/`MAX_TICKS`/`BENCHMARK_VERSION`. List
  = newest-first (reversed append) + bootstrap-filtered + identities-only; item reconstructs the headline
  bout via `renderTape` (challenger vs `defenders[0]` at `seeds[0]`), `Cache-Control: immutable`. Any
  non-resolving id → `404 replay-not-found` with **no fight run**; store-throw → `503`. `id` = exported
  `replayId` = sha256 of the record's **canonical** (recursively key-sorted) JSON. No doc leakage
  (body-scan test). Mutation: handle-replay 92.75% / api/replay 100%.
- **Slice 3a — the Pixi `/watch` autoplay page** (PR #308, `feat/replay-viewer-page`) — a new multi-page
  entry (`web/replay.html` + `replay.tsx`, client-rendered like `/ring`; `vercel.json` rewrites `/watch`
  → `/replay.html`). On load a pure two-step loader (`GET /replay` → `[0]` → `GET /replay/{id}`, local
  view-model types mirroring the wire) → a pure `scene(tape, playhead, viewport)` (world→screen via a
  mirrored `WORLD_WIDTH=600000`) → a `figures`/`createStage` Pixi draw layer → a `ReplayPlayer` that
  mounts a real Pixi `Application` (headless-capable) with an autoplay ticker. `ReplayPage` is a `<Switch>`
  state machine: loading / fetch-error (retry) / empty-list (→ `/ring`) / ready. Pixi v8 mounts headless
  under Playwright — assert scene-graph `x`/`scale.x`/`Text`, not pixels.
- **Slice 3b — playback controls** (PR #309, `feat/replay-viewer-controls`) — the tick logic is extracted
  from `ReplayPlayer`'s inline ticker into a **pure `transport.ts`** (`{playhead, playing}`;
  `startTransport()` = `{0, true}` and the restart target, `advance` clamps while playing / same-ref when
  paused, `togglePlaying` flips playing + keeps the playhead). `ReplayPlayer` holds a Solid signal seeded
  with it; the ticker dispatches `advance` each frame and two native `<button>`s (a Pause/Play toggle +
  Restart) drive it — observed via the toggle's own label since the Pixi HUD is opaque to DOM queries. 6
  exact-assertion `transport` tests (one composed with `scene` for the HUD tick) + 4 browser control tests.

[replay-viewer-s1.md](replay-viewer-s1.md) — the plan.

**S1 (walking skeleton) complete; the viewer feature is 1 of 4 stories done.** The sibling scoping +
story-split docs — [replay-viewer-decisions.md](replay-viewer-decisions.md) (grill-me: 13
decisions) + [replay-viewer-stories.md](replay-viewer-stories.md) (story split S1–S4) — were the
trail in `plans/` (now archived here) for the remaining stories: **S2** postures/poses, **S3** browsable
list + `/watch/{id}` permalinks + nav + dedicated not-found, **S4** transport (scrub/speed/frame-step).
Each started its own `planning` pass; S2-vs-S3 ordering was negotiable (both build only on S1).

## `/watch` fight replay viewer — S2 postures ✅ COMPLETE

"**See the fighters do karate**": the two stickmen now reflect the full pose vocabulary the render
tape carries, and the HUD flashes when a point is scored. One engine-adjacent enabling slice put the
last missing signal on the wire; the other six are pure `web/`. The pose model is **layered** — a base
`stance` (from `posture`) with independent action overrides composed by object spread (strike → front
hand, guard → rear hand, throw → both hands), a full-body `PRONE` **override** for knockdown, and a
HUD score-pop flag from a pure tape scan. Every derivation is written **total** (an odd `posture` →
stand, a band outside 1–3 → no action, `knockdown` still wins), so a stray frame renders a safe neutral
figure instead of crashing. **Invariants held:** `web/src` imports nothing from `src/` (the tape stays a
mirrored view-model); the sole engine touch is the additive `guardBand` projection — **TCB / `INPUT_HASH`
/ `BENCHMARK_VERSION` untouched** (a render projection is not a scoring input). `web/**` is outside
Stryker's node scope ⇒ each pure-`web/` slice used **exhaustive exact-assertion browser tests + a manual
mutator scan + a synthetic-tape visual check** (the live King fight can't guarantee every pose appears).

- **Slice 1 — `renderTape` emits `guardBand`** (PR #313, `feat/replay-guard-field`) — the one missing
  signal: a blocking fighter's `action` resolves inside a tick but leaves `state.kind` `"neutral"`, so
  `RenderFrame` gained `guardBand` (0 none / 1 low / 2 mid / 3 high) via the existing pure
  `guardBandOf(f, action)` helper. `runFight` byte-identical; **100% scoped Stryker (32/32)** — the sole
  engine/`src/` slice, so real mutation, not the web scan.
- **Slice 2 — stance by posture** (PR #314, `feat/replay-postures-stance`) — the fixed S1 stickman becomes
  a 7-joint `Skeleton` in the pure `scene`; `skeletonFor(posture)` branches STAND / CROUCH (upper body
  drops ~18px, feet planted) / AIR (legs tuck over the S1 y-lift). `figures` becomes a thin joint-stroker.
- **Slice 3 — strike extension by band** (PR #315, `feat/replay-postures-strike`) — an `attacking` fighter
  throws its front hand (`handR`) forward to a `bandHeight` ladder (low −24 / mid −46 / high −68, reach
  x 40); an **air-attack** keeps the AIR tucked legs (only `handR` overridden). Factored `bandHeight` for
  Slice 4 reuse.
- **Slice 4 — guard raised to the band** (PR #316, `feat/replay-postures-guard`) — a guarding fighter
  raises its rear hand (`handL`) to the incoming band on the same ladder at a modest reach (x 8); `web/`'s
  `ReplayFrame` gained `guardBand`. `guardBand` (0 = none) is itself the gate; guard composes with any
  stance (crouch-guard test).
- **Slice 5 — throw grab** (PR #317, `feat/replay-postures-grab`) — a `throwing` fighter locks BOTH hands
  forward into a grab (`handL` 28 / `handR` 36), applied **last** so it wins over strike/guard.
- **Slice 6 — knockdown → prone → wake-up** (PR #318, `feat/replay-postures-knockdown`) — the first
  **full-body override**: `knockdown` → an early-return `PRONE` skeleton (spine flat at y −10, head one
  end / feet the other) that supersedes stance + every action layer; the tape flipping `knockdown` false
  the next tick is the wake-up.
- **Slice 7 — score-pop HUD highlight** (PR #319, `feat/replay-score-pop`) — `Hud` gained
  `scoredA`/`scoredB` from a pure `scoredWithin` scan of the last N=30 ticks (≈0.5 s) for a strict points
  increase (low end guarded at index 1, computed from the clamped playhead, no cross-frame state ⇒
  deterministic/scrub-safe); `figures` prefixes the scorer's score with a colourblind-safe `★`.

[replay-viewer-s2.md](replay-viewer-s2.md) — the plan (all 7 slices, the layered pose model, and the
find-gaps decisions inline).

**S2 (postures) complete; the viewer feature is 2 of 4 stories done.** Remaining, still live in `plans/`:
**S3** (browsable list + `/watch/{id}` permalinks + nav + dedicated not-found) and **S4** (transport —
scrub / speed / frame-step). The **S3 route ships dark** (no nav link; the `#fights` teaser stays a
non-link) until it lands. Each starts its own `planning` pass.

## `/watch` fight replay viewer — S3 browse ✅ COMPLETE

"**Browse the King's fights**": the viewer gains a front door. `/watch` lists every watchable title
fight as a newest-first grid of link cards, and `/watch/{id}` is a shareable permalink that plays that
one fight (or reports it's gone). One `replay.html` SPA dispatches on `location.pathname` via a pure
`replayIdFromPath` — plain `<a href>` full-page navigation, **no router**; the `/watch/(.*)` →
`replay.html` rewrite (Vercel-only) is load-bearing. **Web-only** — S1 already shipped the whole
`/replay` API (`GET /replay` identities-only summaries, `GET /replay/{id}` → `{ tape, fighters }` or a
`404 /problems/replay-not-found`), so **no `src/` / `api/` / TCB / `INPUT_HASH` / `BENCHMARK_VERSION`
change**; `web/src` imports nothing from `src/` (the contract is mirrored in `replay-contract.ts`).
`web/**` is outside Stryker's node scope ⇒ each slice used **exhaustive exact-assertion browser tests +
pure-helper unit tests + a manual mutator scan + an out-of-band `agent-browser` preview smoke**. The
route **ships dark** (no primary-Nav link; the `#fights` teaser stays a non-link). Player-first
ordering: the permalink landed before the list so the cards had a live target to click.

- **Slice 1 — the `/watch/{id}` permalink player** (PR #321, `feat/replay-watch-permalink`) — a
  shareable per-fight link: `loadById` maps `200` → found / `404` → not-found / else throw; `ReplayFight`
  is a 4-state shell (loading / retryable error / not-found + "← all fights" back-link / ready →
  `ReplayPlayer`); `ReplayPage` dispatches on `location.pathname` (pure `replayIdFromPath`), rendering
  the by-id player when an id is present. Added the `/watch/(.*)` → `replay.html` rewrite (before the SPA
  catch-all) + `.replay-back` / `.replay-fight` CSS. `/watch` (no id) still autoplayed the newest fight —
  a coherent intermediate retired by Slice 2.
- **Slice 2 — the browsable list at `/watch`** (PR #322, `feat/replay-watch-list`) — the index: a
  newest-first grid of `<a href="/watch/{id}">` cards, identity-only (challenger name/model vs King
  name/model, **name-only** when a model is absent, long names CSS-truncated with the full value in a
  `title`), an honest **empty state** (→ `/ring`), and a retryable error. `loadList` + `ReplayList`. The
  autoplay bridge was **retired** — deleted `ReplayLatest` + the `loadReplay` two-step loader, rewrote
  their tests into list tests, corrected the `replay.html` head copy + the stale "until S4" comment.
- **Slice 3 — repeat-challenge collision disambiguator** (PR #323, `feat/replay-watch-collisions`) — a
  spectator can tell two fights between the same-named challenger and King apart: a pure
  `markCollisions(summaries)` (`collisions.ts`) flags exactly the entries whose challenger-`name` +
  King-`name` pair repeats — keyed by `JSON.stringify([challenger, king])` so distinct pairs never
  concatenate-conflate (`"a"+"bc"` ≠ `"ab"+"c"`) and quotes/specials escape; `> 1` = collides.
  `ReplayList` renders `id.slice(0, 6)` (git-style short hash) as a muted-mono `.replay-card-id` chip
  **after `vs` / before fighter[1]** (preserving fighter[1] as `:last-child` right-alignment) on flagged
  cards only; uniquely-named pairings stay clean.

[replay-viewer-s3.md](replay-viewer-s3.md) — the plan (all 3 slices + the whole-story acceptance
criteria inline; the grill-me decisions were then in `plans/replay-viewer-decisions.md`, now archived here).

## `/watch` fight replay viewer — S4 transport ✅ COMPLETE

**Control playback.** A spectator watching a fight can now scrub to any tick, change speed, and step
frame-by-frame — to rewatch the decisive moment and study a bout in detail. The final replay-viewer
story. **Web-only** — S1 already shipped the whole `/replay` API and the render tape carries every
tick, so **no `src/` / `api/` / TCB / `INPUT_HASH` / `BENCHMARK_VERSION` change**; `web/src` imports
nothing from `src/`. All three slices extend the pure `transport` clock (`{ playhead, playing }`) driven
by the Pixi ticker in `ReplayPlayer`; `web/**` is outside Stryker, so each slice recorded **Mutation:
N/A (Stryker)** and substituted exact-assertion `transport` unit tests + browser control tests +
documented manual mutator scan + a deployed-bundle preview smoke. The route **stays dark** (no Nav link;
the "Fight replays — in development" teaser stays a non-link).

- **Slice 1 — a scrub bar seeks to any tick + end-of-fight auto-pause** (PR #325, `feat/replay-transport-scrub`)
  — the `transport` model gained two behaviors: `advance` now **auto-pauses** at `lastTick` (the toggle
  returns to Play instead of freezing on Pause over the final frame), and a new pure `seek(t, tick,
lastTick)` (clamp into `[0, lastTick]`, always pause). `ReplayPlayer` renders a native
  `<input type=range>` bound to `round(playhead)` (live-tracks during play; `onInput` → `seek` pauses so
  the per-frame write stops fighting the drag), plus a muted-mono **`tick N / M`** readout + `aria-valuetext`
  sourced from the tape exactly like the HUD, so the two always agree.
- **Slice 2 — 0.5× / 1× / 2× speed buttons** (PR #326, `feat/replay-transport-speed`) — a reactive
  `speed` signal (default 1, persists across Restart) multiplied into the ticker delta
  (`advance(t, deltaTime × speed, lastTick)`) — **no model change** (speed is a viewer-layer concern). Three
  buttons form a single-select toggle group (`For` over `RATES = [0.5, 1, 2]`), the active rate carrying
  `aria-pressed="true"`. The `deltaTime × speed` multiply is the one mutant not unit-killed (impure ticker
  edge) — covered by preview smoke.
- **Slice 3 — frame-step ◀ / ▶** (PR #327, `feat/replay-transport-frame-step`) — one new pure
  `step(t, delta, lastTick) = seek(t, round(playhead) + delta, lastTick)` (rounds a fractional mid-play
  playhead to a clean neighbouring tick, reusing Slice 1's clamp + pause). Two `aria-label`led icon buttons
  wired to `step(∓1)`, each `disabled` at its boundary (◀ at tick 0, ▶ at the last tick) — no over/underflow.
  Every behavioral mutant is unit/browser-killed (pure `step` + exact-asserted gates).

[replay-viewer-s4.md](replay-viewer-s4.md) — the plan (all 3 slices + whole-story acceptance criteria
inline). Shared story-split docs — [replay-viewer-decisions.md](replay-viewer-decisions.md) +
[replay-viewer-stories.md](replay-viewer-stories.md) — archived alongside (nothing live remained).

**S4 (transport) complete — the entire replay-viewer roadmap is done (S1 skeleton → S2 postures →
S3 browse → S4 transport, 4 of 4 stories).** The `/watch` viewer now browses the King's fights, plays
any one back as karate-doing stickmen, and gives full transport control. No replay-viewer work remains.

## `/dojo` pose lab — "make it fight" arc, Story 1 ✅ COMPLETE

**Tune the pose model in isolation.** A follow-on arc to the `/watch` viewer above: make the stickmen
actually look like they're fighting (heads · scale · bending limbs · strikes-connect — Stories 2–5).
Story 1 builds the **harness** those later slices are demoed on — a permanent **dark** dev route
`/dojo` that renders two fighters through the **real** `scene()`/`createStage` pipeline (a hand-built
synthetic tape, not a replay), with live controls. **Web-only** — the lab drives the identical
projection `/watch` ships and imports nothing new from `src/` (only `scene.ts` gained a `WORLD_WIDTH`
export in Slice 1); **no `src/` logic / `api/` / TCB / `INPUT_HASH` / `BENCHMARK_VERSION` change**.
`web/**` is outside Stryker → each slice recorded **Mutation: N/A (Stryker)** and substituted
exhaustive exact-assertion tests (pure builder + mapper + preset table through the real projection) +
a manual mutator scan + a `/dojo` visual sign-off. The route stays dark (no Nav link, noindex, off the
sitemap).

- **Slice 1 — two default-posed fighters through the real pipeline** (PR #329, `feat/dojo-pose-lab`) —
  the walking skeleton: `dojo.html` + `dojo.tsx` entry → a pure synthetic-tape builder (default
  `FigureControls` + default gap) → `scene()` → `createStage().apply()` mounts two figure roots
  (challenger mid-strike vs idle king at gyaku reach), asserted via the scene graph like `figures.test`.
  Vite input + Vercel `/dojo` rewrite; `scene.ts` gains a behavior-preserving `WORLD_WIDTH` export the
  builder reuses.
- **Slice 2 — per-figure controls re-pose each fighter (free combos)** (PR #330,
  `feat/dojo-figure-controls`) — each fighter gets a `FigureControlPanel` over its RAW frame pose fields
  (posture · facing · attacking · attack/guard band · throwing · knockdown) — deliberately the raw fields
  (no action enum), so engine-impossible combos are reachable by design (M10) and `poseFor` resolves
  precedence (knockdown + throwing → PRONE). A pure `controlsToFrame` mapper + per-figure reactive signals
  feed the builder; an injectable spy-stage seam asserts the control→tape wiring without a WebGL canvas.
- **Slice 3 — world-gap slider with move-reach snap presets** (PR #331, `feat/dojo-gap-presets`) — a
  shared **Spacing** control sets the distance between the two fighters: a reach-preset dropdown snaps the
  gap to any of the **13** engine move reaches (`reach-presets.ts` — a documented mirror of `rules.ts`,
  like `WORLD_WIDTH`; the plan's earlier 12-list omitted `hiza-geri`, corrected to the full arsenal) + a
  free slider (`0 … 330k`, step 1k) with a live `k`-shorthand read-out. A reactive `gap` signal feeds the
  existing builder (separation math already covered by `dojo-tape.test`). REFACTOR folded the default gap
  onto the preset table (the opening gap IS the gyaku preset). GOTCHA: `<label for>` doesn't associate an
  accessible name for a range `<input>` in this testing stack either (not just `<select>`) →
  `aria-labelledby` from a span.

[replay-viewer-fight-s1-dojo.md](replay-viewer-fight-s1-dojo.md) — the plan (all 3 slices + whole-story
acceptance criteria inline). The spanning **"make it fight" design trail** —
`plans/replay-viewer-fight-decisions.md` + `plans/replay-viewer-fight-stories.md` — stays **live in
`plans/`** (Stories 2–5 remain: model-identity coin heads · big fighters via world-scale · bending limbs
with elbows/knees · strikes-connect via `attackReach` + IK).

**Story 1 (`/dojo` pose lab) complete — the calibration harness is ready.** Stories 2–5 of the "make it
fight" arc (heads · scale · bends · connect) build on it, each demoed in `/dojo`.

## Model-identity brand-glyph heads — "make it fight" arc, Story 2 ✅ COMPLETE

**A spectator can tell at a glance which model authored each fighter.** Each fighter's head renders
as its authoring model's **brand glyph** — the bare logo (Claude / OpenAI / Gemini / Grok / generic)
in the brand hue, no disc, exactly like the home hero's three logo-headed stickmen — while the body
keeps its side colour (challenger-teal / king-amber). (The grilled M11 "coin" — a hued disc + contrast
glyph — was dropped mid-plan: a bare glyph reads bigger/crisper and matches the shipped hero.)
**Web-only** — identity is **off-tape** (it rides `ReplayItem.fighters[*].model`, never the render
frame), so nothing new is imported from `src/`; **no `src/` logic / `api/` / TCB / `INPUT_HASH` /
`BENCHMARK_VERSION` change**. `web/**` is outside Stryker → each slice recorded **Mutation: N/A
(Stryker)** and substituted exhaustive exact-assertion scene-graph / spy-seam tests + a manual mutator
scan + a `/dojo` (and `/watch`) visual sign-off.

- **Slice 1 — shared brand source** (PR #333, `feat/coin-heads`) — a **pure refactor**: extracted
  `web/src/shared/lib/brand.ts` as the single source of the five glyph geometries + `modelToBrand`,
  consumed by the DOM `BrandMark`/`ModelLogo`. The exhaustive `ModelLogo.test` + `Hero.test` (accessible
  name + `data-brand` + no-injection) stayed green **unchanged**, and the prerendered hero emitted
  byte-identical glyph geometry — preservation evidence that no DOM mark drifted. Sets up the Pixi head
  to draw the very same geometry.
- **Slice 2 — glyph head on real replays** (PR #334, `feat/replay-glyph-head`) — the spectator payoff:
  `createStage(viewport, [Brand, Brand])`; each fighter's head is its brand glyph via Pixi v8
  `Graphics.svg()` on the shared geometry (a `label` hook tags the node; it **counter-flips** per-frame
  so the mark never mirrors facing left), the body/limb bones keep the side colour. `brandsFor` resolves
  each `fighters[*].model` → brand (challenger-then-King); `ReplayPlayer` wires it; `DojoStage` passes the
  M10 default pair. GOTCHAS: Pixi's SVG parser **inherits `<g>` fill/stroke** to children (so the
  group-styled Claude/OpenAI marks render — Q2 escape hatch unneeded) but has **no CSS `currentColor`**,
  so Grok's monochrome glyph inks to an explicit near-white `GROK_CANVAS_INK` for the canvas (the DOM
  mark keeps `currentColor`). `Graphics` is opaque to display assertions → a **`getLocalBounds()`
  non-empty** check per brand guards the blank-head failure mode.
- **Slice 3 — `/dojo` brand picker** (PR #335, `feat/dojo-brand-picker`) — each `FigureControlPanel`
  gains a per-figure **Brand** `<select>` (default challenger `claude` / king `generic`, M10; `+BRANDS`
  canonical-order array; `toBrand` narrows the value via `BRANDS.find` — no assertion). Because
  `createStage` **bakes the brand at figure creation** (decision 6), a brand change **remounts** the
  stage via a keyed `<Show>` on a `brandKey` string (Q3 — not a re-brand-in-place), while a pose/gap edit
  keeps the mount. GOTCHA: the reactive spy-stage seam can't see the real Pixi rebuild (its `brands` prop
  updates either way), so a **mount-count** test pins the remount contract directly (brand change
  remounts, pose change doesn't) — proving the keyed-`Show` mechanism automatically rather than by eye.

[replay-viewer-fight-s2-heads.md](replay-viewer-fight-s2-heads.md) — the plan (all 3 slices + whole-story
acceptance criteria + the resolved open questions Q1–Q3 inline). The spanning **"make it fight" design
trail** — `plans/replay-viewer-fight-decisions.md` + `plans/replay-viewer-fight-stories.md` — stays
**live in `plans/`** (Stories 3–5 remain: big fighters via world-scale · bending limbs with elbows/knees
· strikes-connect via `attackReach` + IK).

**Story 2 (model-identity heads) complete — fighters now wear their author's mark on `/watch`.** Stories
3–5 (scale · bends · connect) continue the arc, each demoed in `/dojo`.

## Big fighters via world-scale — "make it fight" arc, Story 3 ✅ COMPLETE

**A spectator sees big fighters at a believable fighting distance.** The stickman body is defined in world
sub-units from **one tunable height knob** (`BODY_HEIGHT_SUB ≈ 240k`) and projected by the SAME
`pxPerSubunit` that positions the fighter, so two fighters at a contact-distance gap fill a large share of
the ring instead of being tiny figures across a void — and the brand head grows with them (0.3× body
height). **Web-only** — the scale lives in the pure `scene()` projection + the Pixi head sizing; **no `src/`
logic / `api/` / TCB / `INPUT_HASH` / `BENCHMARK_VERSION` change** (the `attackReach` engine field belongs to
Story 5). `web/**` is outside Stryker → each slice recorded **Mutation: N/A (Stryker)** and substituted
exhaustive exact-assertion tests (a magnitude literal + a formula-independent recompute from the imported
knob, so a scale mutant is caught) + a manual mutator scan + a `/dojo` visual sign-off.

- **Slice 1 — body world-scale from one knob** (PR #338, `feat/fight-s3-world-scale`) — `scene.ts` gained
  `BODY_HEIGHT_SUB` (~240k sub-units), a `REF_BODY_HEIGHT_PX` derived from `STAND` (76px, can't drift), and a
  uniform `bodyScale = BODY_HEIGHT_SUB × pxPerSubunit / REF_BODY_HEIGHT_PX` applied to every joint inside the
  pure `figure()`. The WHOLE pose (every stance + strike/guard/grab/prone override) scales together, feet stay
  planted at local y 0, and both `/watch` and `/dojo` inherit it — at a 1200-wide viewport a standing body
  renders ~480px tall. Existing exact-coordinate assertions were rewrapped in a `scaled()`/`s()` helper
  recomputed from the imported knob (not the production `bodyScale`), pinning proportions + a scale mutant; a
  span-linearity test (480→960 on a doubled viewport) sidesteps per-joint float rounding.
- **Slice 2 — proportional head glyph, closes Story 3** (PR #339, `feat/fight-s3-head-scale`) — the brand head
  was a fixed `HEAD_GLYPH_PX = 44` dot dwarfed by the big body. `scene.ts` exports
  `bodyHeightPx(viewport) = BODY_HEIGHT_SUB × pxPerSubunit`; `figures.ts` replaces the fixed px with
  `HEAD_HEIGHT_RATIO = 0.3` and sizes each fighter's glyph to `0.3 × bodyHeightPx / 24` in `createStage`, so
  the head grows with the body at any viewport (6× @ 1200px, 12× @ 2400px). Story-2 counter-flip (upright
  glyph) + non-empty-geometry guards preserved. The test carries its own `0.3` / `24` / `600_000` literals
  (independent of production) so ratio / size / viewport-dependence mutants are caught.

[replay-viewer-fight-s3-scale.md](replay-viewer-fight-s3-scale.md) — the plan (both slices + whole-story
acceptance criteria inline). The spanning **"make it fight" design trail** —
`plans/replay-viewer-fight-decisions.md` + `plans/replay-viewer-fight-stories.md` — stays **live in `plans/`**
(Stories 4–5 remain: bending limbs with elbows/knees · strikes-connect via `attackReach` + IK).

**Story 3 (big fighters / world-scale) complete — fighters now read big at fighting distance, head and body
scaling together from one knob.** Stories 4–5 (bends · connect) continue the arc, each demoed in `/dojo`.

## Limbs bend (elbows & knees) — "make it fight" arc, Story 4 ✅ COMPLETE

**A spectator sees jointed limbs, not stick figures.** Each arm renders `shoulder→elbow→hand` and each leg
`hip→knee→foot`, with the elbow bowed **back** and the knee bowed **forward** — on live `/watch` replays and in
`/dojo`. The mid-joints are **derived**, not authored: a pure `deriveBend(from, to, dir, dist)` in `scene.ts`
offsets the midpoint of a bone along its unit-perpendicular by a local-px bow, `dir` orienting it back
(`BEND_BACK`) or forward (`BEND_FORWARD`). Derivation runs on the **final** endpoints (after the
strike/guard/throw overrides), so a thrown hand/foot re-derives its mid-joint for free — no per-action authored
bend. `poseFor` never reads facing (the bow is a fixed local direction; the container flip carries facing), so
a limb reads correctly for both facings. **Web-only** — the derivation lives in the pure `scene()` projection +
the Pixi node/bone wiring; **no `src/` logic / `api/` / TCB / `INPUT_HASH` / `BENCHMARK_VERSION` change** (the
`attackReach` engine field belongs to Story 5). `web/**` is outside Stryker → each slice recorded **Mutation:
N/A (Stryker)** and substituted independent-recompute exact-assertion tests (each test recomputes the mid-joint
from the endpoints + bend constant, independent of production) + a manual mutator scan + a `/dojo` visual
sign-off.

- **Slice 1 — arms bend** (PR #341, `feat/fight-s4-arm-bends`) — split the input `Stance` (7 endpoint joints)
  from the draw `Skeleton` (+`elbowL/R`); a pure `bendBack` + `deriveSkeleton` derives the elbows off the
  straight shoulder→hand line; `PRONE` authors its own elbows (a downed body reshapes everything, early-return
  before derivation); `scalePose`/`figures.ts` extend to the elbow nodes; `BONES` routes `shoulder→elbow→hand`.
  The mutation-killer was a **high-strike** test (hand above the shoulder) exercising the opposite bow-direction
  branch — the resting/mid-strike arms all hang below the shoulder, so without it a flip-constant mutant
  survived.
- **Slice 2 — legs bend, closes Story 4** (PR #342, `feat/fight-s4-legs-bend`) — mirror for the legs: `Skeleton`
  grows 9 → 11 (`+kneeL/R`), a forward-bend derivation puts the knees off the straight hip→foot line, `PRONE`
  authors all 11 joints, `BONES` routes `hip→knee→foot`. The **REFACTOR** collapsed the elbow (`bendBack`) and
  knee (`bendForward`) helpers into one shared `deriveBend(from, to, dir, dist)` — arms + legs now share the
  flip conditional, which _also_ killed the "flip always −1" survivor the leg-only tests left (no natural leg
  has the foot above the hip, so a leg alone never exercises the other branch — but the arms do).

[replay-viewer-fight-s4-limbs.md](replay-viewer-fight-s4-limbs.md) — the plan (both slices + whole-story
acceptance criteria inline). The spanning **"make it fight" design trail** —
`plans/replay-viewer-fight-decisions.md` + `plans/replay-viewer-fight-stories.md` — stays **live in `plans/`**
(Story 5 remains: strikes-connect via the `attackReach` engine field + 2-bone IK).

**Story 4 (limbs bend) complete — fighters now read as jointed figures, arms and legs both.** Story 5
(strikes connect) is the last of the arc and the only one that touches `src/`.

## Strikes & grabs connect (reach-to-target) — "make it fight" arc, Story 5 ✅ COMPLETE (closes the arc 5/5)

**A spectator sees a strike or grab land on the opponent when in range, and stop short when it whiffs** — no
longer hitting the air. The gap between fighters varies every tick, so a fixed-length limb only "touches" at
one distance; instead the striking hand (and both grab hands) **aim at the opponent's real position, clamped to
the committed move's true reach**. This is the **only `src/`-touching story** of the arc — an additive render
field — and everything else stays in `web/`. Each slice was demoed + signed off in `/dojo` (M9).

- **Slice 1 — the render tape carries `attackReach`** (PR #344, `feat/fight-s5-attack-reach`) — an additive
  `RenderFrame.attackReach` (sub-units): a strike frame = the committed move's `spec.reach`, a throw frame =
  `rules.throw.reach`, idle = `0`, read from the **committed state** (like `attackBand`). The **one `src/`/TCB
  touch** of the arc — **byte-identical**: `runFight().events`, `endReason`, `INPUT_HASH`, and every `replayId`
  unchanged (the field lives only on the derived render tape, not the event tape or the `ReproRecord` hash).
  Real Stryker on `renderFrameOf` (engine is reachable); the web contract needs no change (the loader casts the
  wire wholesale, so a viewer ignores the extra field until Slice 2 reads it).
- **Slice 2a — a strike's hand lands on the near edge** (PR #345, `feat/fight-s5-reach-to-target`) — `scene.ts`
  `strikeHandFor` solves the front hand toward the opponent's near body edge
  (`facing·(opp.x − self.x)·SUBUNIT_TO_LOCAL − BODY_HALF_WIDTH`), clamped to `[min(FLOOR, cap), cap]` with
  `cap = attackReach·SUBUNIT_TO_LOCAL` (viewport-**independent** local-px ratio `76/240000`). In range → the
  fist lands ON the surface; beyond → it stops short (a whiff reads as a whiff); degenerate (gap ≈ 0 / opponent
  behind facing) → a forward floor, never backward, never NaN. The web `ReplayFrame` gains `attackReach?` with
  the **M7 defensive gate** (absent / non-numeric / non-positive → stance). Story 4's `deriveSkeleton` re-bends
  the elbow onto the moved hand for free.
- **Slice 2b — the strike leans into its reach + `/dojo` reach slider** (PR #346, `feat/fight-s5-lean-slider`) —
  **M2 lean**: a drawn strike shifts the **upper body** (head + shoulder) forward by `min(CAP 16, handX×0.5)`
  local px — a committed lunge, the arm telescoping for the remainder — while the **root x stays truthful** (the
  lean is a viewer-only cosmetic) and the lower body + rear hand stay planted; the shared shoulder leans, so the
  derived elbows follow it. **M10**: `/dojo`'s `FigureControlPanel` gains a per-figure `attackReach` range slider
  so every move's contact (short jab → long thrust kick) can be dialled and signed off by eye.
- **Slice 3 — a throw's grab lands on the opponent, closes the arc** (PR #347, `feat/fight-s5-throw-reach`) — the
  strike's clamp was extracted to a shared pure **`reachTargetX(self, opponent)`** (near-edge target clamped to
  `[floor, reach cap]`, direction = facing, M7-defensive → `null`); `strikeHandFor` delegates to it
  (behaviour-preserving). A new `throwGrabFor` reaches **both** grab hands to the near edge at chest height using
  the frame's `attackReach` (= `throw.reach`): the front hand leads onto the edge, the rear closes a
  `GRAB_SPREAD` behind, so two arms read as a two-handed grab. **One targeting path for every committed action
  (M8).** An invalid/absent reach on a throwing frame → stance hands (the M7 idle fallback, as the strike; in a
  real fight `throw.reach` is always positive so the grab always draws).

[replay-viewer-fight-s5-connect.md](replay-viewer-fight-s5-connect.md) — the plan (4 slices + whole-story
acceptance criteria inline). With Story 5 shipped, the spanning **"make it fight" design trail** is now archived
alongside the story plans: [replay-viewer-fight-decisions.md](replay-viewer-fight-decisions.md) (the grilled +
gap-tightened design — decision table + M1–M12 + M-purity) and
[replay-viewer-fight-stories.md](replay-viewer-fight-stories.md) (the `story-splitting` child-story split).

**Story 5 (strikes connect) complete — this closes the whole "make it fight" arc 5/5.** Fighters now read as
_actually fighting_: big and engaged at believable distances (S3), with jointed limbs (S4), model-identity
heads (S2), and strikes + grabs that land on contact and whiff short (S5) — every capability demoed and tuned
in the permanent `/dojo` pose lab (S1). The only `src/` change in the entire arc was Story 5's additive
byte-identical `attackReach` render field. **Deferred follow-on** (decided later in `/dojo`): per-move signature
silhouettes + a chamber→snap→recover strike animation — both need a `move` id + move-phase render fields.

## Move showcase & per-move poses — S0 + S1 ✅ COMPLETE (2/8 of the arc)

The first two child stories of the **move-showcase arc**: giving each of the 13 arsenal moves a look of its
own, so a spectator can tell _which_ technique a fighter just threw. Before this, `poseFor` knew only
`attacking` / `attackBand` / `throwing`, so all 12 strikes drew the same picture — a `mawashi-geri` rendered
as a punch.

- **S0 — the render tape carries move identity + phase** (PR #352, `feat/move-poses-s0-fields`) — the arc's
  **only `src/` touch**. `RenderFrame` gains render-only **`attackMove`** (the 13-id web vocabulary
  `MoveId | "sweep" | "throw" | ""`) and **`attackPhase`** (`0` none / `1` startup / `2` active / `3`
  recovery, mirroring the `0 = none` band-code convention). Carrying the id required `move: string` on the
  `attacking` / `air-attacking` states so the render site reads the **committed** move rather than the live
  action (idle for most of a strike). Framed as a **validation** slice, and it validated: `BENCHMARK_VERSION`
  held at `v19` with determinism + replay-byte-identity green, so the id never reached the outcome path (M11).
  Phase reuses the engine's **own** active-window inequality (`elapsed >= startup && elapsed < startup +
active`), because a rendered frame's `elapsed` is already advanced — so the drawn extension lands on the
  tick that resolves contact, and the air-strike landing park at `elapsed = startup + active` reads recovery.
  The else-branch absorbs parry-extended recovery with no fourth code (M5). Mutation **95.45%** (42/2), both
  survivors equivalent (`rules.throw?.x` is unreachable — a `throwing` state cannot exist without
  `rules.throw`). **GOTCHA:** there are **five** attack-state construction sites, not four — the air-strike
  landing conversion builds an `attacking` state as an object literal rather than via `startAttack`, so a
  landed `tobi-geri` would otherwise lose its identity through its grounded recovery.
- **S1 — a `mae-geri` draws its front foot** (PR #353, `feat/move-poses-s1-kick`) — `web/`-only. A new
  `move-descriptors.ts` names which skeleton endpoint each technique drives; `poseFor` applies the
  **already-solved** strike position to that endpoint instead of hard-coding `handR`. Kept separate from
  `reach-presets.ts` (decision 10): engine mirror vs aesthetic authoring data, two test disciplines. The
  arc's riskiest assumption **held** — a foot drives through the same `reachTargetX` solver as a hand, and
  because the bend rule already ran on the FINAL endpoints the knee re-derives off the moved `hip → footR`
  for free. Support leg stays planted (M8.2); undescribed moves keep the generic hand pose (M7), so the
  viewer stays usable while descriptors are authored one slice at a time. Mutation **`N/A`** (web is outside
  Stryker) — alternate evidence was exhaustive exact-assertion tests + a manual mutator scan + a Playwright
  `/dojo` visual sign-off.

[move-poses-s0-s1.md](move-poses-s0-s1.md) — the plan, with both slices' recorded outcomes. The arc's design
trail (`plans/move-poses-{decisions,stories}.md` — 10 decisions, mechanics M1–M11, 8 child stories) stays
**live in `plans/`**, since S2–S7 still run off it.

**Carried findings for S2.** The kick reads **stretched rather than snapped**: the driven leg spans ~67 local
px against a ~37 px natural length (1.8×), and at that extension the 8 px `KNEE_BEND` is nearly invisible.
The shipped punch telescopes just as hard (2.0×), so this is the existing visual language rather than a
regression — but a leg starting at the low hip and rising only to the mid band tolerates the stretch far
worse than an arm does. This answers the plan's open question _"what fields fall out beyond limb + chamber"_:
**limb alone is not enough** — a kick needs hip travel (the M2 lean moves head + shoulder only), a knee-lift
chamber, or a length constraint on the driven bone. Relatedly, **M8.2's support-integrity assertion is now
load-bearing**: if S2 concludes the hip must travel, that test must be changed _consciously_ — it is a
decision record, not a bug. `attackPhase` ships emitted but deliberately **unconsumed**; phase is S2's job.
