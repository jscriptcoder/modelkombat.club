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

The online loop's front door. The completed **S1–S4 plans** and the **overall** design source of
truth (spanning S1–S4) are archived here — the whole feature shipped (`/spec` · `/validate` ·
`/fight` + the version-scoped KotH throne, all **LIVE**), and its successor the KotH ladder is also
complete (S1–S5, above).

- **S1 — `GET /spec`** (the deployment walking skeleton + self-describing layered spec + the inert `model?` `BotDoc` field; 4 slices, PRs #171–#174 → live at `https://modelkombat.club/spec`): [platform-http-api-s1-spec.md](platform-http-api-s1-spec.md)
- **S2 — `POST /validate`** (the validator gate — `200 {ok:true}` or RFC 9457 `problem+json` issues; 2 slices, PRs #176–#177; parse-first, `413` oversize, no content-type gate): [platform-http-api-s2-validate.md](platform-http-api-s2-validate.md)
- **S3 — `POST /fight`** (the stateless gauntlet gate — `cleared` verdict vs the frozen `v19` gauntlet + a compact leak-free per-member report with `endReasons` + `diagnostics.degrade`; 4 slices, PRs #178–#181; shared `src/http/` RFC 9457 envelope, advertised + rate-limited at 20 req/min via Vercel WAF): [platform-http-api-s3-fight.md](platform-http-api-s3-fight.md)
- **S4 — the version-scoped KotH throne** (the **first stateful** platform piece — a gauntlet-clearer earns a title shot; bootstrap crown → fresh-seeded title fight → dethrone on `> 0.5` else king-retained, atomic-CAS `409 /problems/throne-moved`, incumbent identity + `X-Author-Handle`, durably persisted on Upstash Redis behind a `ThroneStore` port with an in-memory fake; 5 slices, PRs #184–#188 + #190; durable persistence LIVE): [platform-http-api-s4-throne.md](platform-http-api-s4-throne.md)

**Feature complete (S1–S4).** The Platform HTTP API design trail — `platform-http-api-decisions.md`
(the resolved decisions 1–10 + eng-reqs + API response contract) + `platform-http-api-stories.md`
(the story split + gaps-closed log) — was kept live in `plans/` across S1–S4 and is now archived here
alongside the slice plans. Follow-on platform work (the KotH ladder — see the KotH ladder S1–S5 sections above — plus `/replay` + the Pixi viewer) has its own design trail.

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

**Carried findings for S2** _(all three resolved by S2 — see `move-poses-s2.md`)_. The kick reads **stretched
rather than snapped**: the driven leg spans ~67 local px against a ~37 px natural length (1.8×), and at that
extension the 8 px `KNEE_BEND` is nearly invisible. This answered the plan's open question _"what fields fall
out beyond limb + chamber"_ with **limb alone is not enough**. S2 · Slice 3 found the diagnosis itself was
wrong — `hip → foot` distance is not bone length — and fixed the real defect a level down. **M8.2's
support-integrity assertion** was flagged as load-bearing in case the hip had to travel; it did, but the step
is capped, so M8.2 never needed changing. `attackPhase` ships emitted but deliberately **unconsumed**; phase
is S2's job.

---

## Move showcase & per-move poses — S2: a technique winds up and recovers (2026-07-19)

**Three slices, three PRs**, closing the "0.4 s frozen at full extension" defect end to end. `web/`-only
throughout — no `src/` change, `BENCHMARK_VERSION` held at `v19`. Mutation **`N/A`** for every slice (Stryker
is node-only and does not reach `web/`); substitute evidence each time was exhaustive exact-assertion tests, a
**scripted** manual mutator scan, and a Playwright `/dojo` visual sign-off.

- **Slice 1 — a technique winds up and recovers on `/watch`** (PR #355, `feat/move-poses-s2-windup`) —
  `poseFor` honours `attackPhase`: a chamber during startup and recovery, the solved extension only at
  contact. **Call 1** resolved M7's fallback to its literal reading, which made this a **whole-roster** change
  — all 13 moves gained wind-up and recovery, not just `mae-geri`, because an undescribed move winds up
  through its stance. **Call 2** relaxed M8.3 to "phase 2 differs from 1 and 3", since M3 defaults recovery to
  the chamber so `1 === 3` is by design. Scan 16/16 after one genuine survivor was killed (dropping the
  `strikeHand` gate let an idle fighter chamber off a stale move id). **The change was far bigger than "a
  nicer strike": 87% of committed ticks were previously drawn wrong** — 636 of 727 committed ticks in one
  replay are startup or recovery.
- **Slice 2 — `/dojo` plays a technique at real engine timing** (PR #356, `feat/move-poses-s2-dojo-timing`) —
  `reach-presets.ts` gains the 13-move `startup`/`active`/`recovery` mirror; `buildDojoTape` spans the longer
  of the two figures' techniques, stamping phase per tick; `DojoApp` owns the transport **above** the
  injectable spy seam. Scan 27/28, with one accepted survivor (the stage ignoring the playhead is invisible to
  the unit layer by construction — the same seam that makes the transport assertable — killed empirically by
  the visual check). Extraction of shared playback controls with `ReplayPlayer` was **assessed and rejected**:
  the player carries speed, restart and engine-tick semantics the lab does not want.
- **Slice 3 — a kick's contact frame reads like a kick** (PR #357, `feat/move-poses-s2-kick-reads`) — see
  below; the slice that changed the most about how the figure is understood.

[move-poses-s2.md](move-poses-s2.md) — the plan, with all three slices' recorded outcomes, both resolved calls
and the full Call 3 reversal. The arc's design trail (`plans/move-poses-{decisions,stories}.md`) stays **live
in `plans/`**, since S3–S8 still run off it.

**The durable finding — the body cannot reach the engine's distances, and that is structural.**
`BODY_HEIGHT_SUB` is 240*000 and the opening distance is 240_000, so fighters stand **one body-height apart**
while an arm spans 0.35 of that and a leg 0.48. Nothing human-proportioned reaches its own height, and drawing
cannot fix a ratio the engine owns — scaling magnifies gap and body together, and the figure already fills 80%
of the viewport. **So the original limb-stretching was the compromise that made contact legible, not an
oversight.** Slice 3 replaced it with a \_bounded* compromise rather than eliminating it: bone length became the
invariant with the mid-joint solved for it (2-bone IK, derived from `STAND` so the neutral figure is
pixel-identical), plus a root step capped at 16 local px, with a bounded residual stretch beyond that. Drift at
contact fell **0.72 → 0.28** and the swing across a technique **0.51×→1.72×** → **1.0×→1.28×**.

**GOTCHA — `hip → foot` distance is not bone length.** The S1 finding ("the limb telescopes to 1.8× its
natural length") measured the endpoint span. A folded knee _should_ bring the foot near the hip, so the 0.34×
chamber was always fine. The real defect was that `deriveBend` offset the mid-joint by a **constant** 8 px, so
the bones it implied were `√((span/2)² + 8²)` — a function of endpoint separation. Measure the bones, not the
span.

**Two rulings recorded rather than patched around.** A limb at or past full extension now draws **straight**
(the solved bow floors at zero) — correct rather than tolerated, since a committed kick _is_ a straight line;
M8.6 therefore holds wherever the limb is not fully extended. And the M2 lean is now gated to **hand**
techniques: authored for punches, inherited wrongly by kicks. **An unplanned win** — slice 2's eye check asked
for a kick to counter-lean backward, but because the hip steps forward while the shoulder does not, the torso
leans **back over the driven hip** on its own. The counterbalance fell out of the step rather than needing to
be authored.

**Carried into S4** — unifying `strikeLean` (a heuristic, `min(CAP, handX × 0.5)`) with `rootTravel` (derived,
`min(CAP, shortfall)`) was assessed and **rejected as out of scope**: they agree at the workhorse distance and
diverge closer in, so merging them changes how punches look at close range. That is a behaviour change, and it
belongs where `gyaku-zuki` is being judged by eye.

---

## Move showcase & per-move poses — S3: browse the arsenal in `/dojo` (2026-07-19)

**Four slices, four PRs**, turning `/dojo` from a lab pinned to one hard-coded technique into the authoring
harness the rest of the arc runs on. `web/`-only throughout — no `src/` change, `BENCHMARK_VERSION` held at
`v19`. Mutation **`N/A`** for every slice; substitute evidence each time was exhaustive exact-assertion tests, a
**scripted** manual mutator scan (4 / 12 / 7 / 9, all killed) and a Playwright `/dojo` visual sign-off.

- **Slice 1 — Restart replays from the first tick** (PR #358, `feat/move-poses-s3-picker`) — reused
  `startTransport()` rather than seeking, because a seek always pauses and `transport.ts:11` already **named**
  that function the restart target. Nothing was added to the transport model. Shipped first because it is close
  to a prerequisite: playback auto-pauses at the end, so selecting a move while parked would land on that move's
  final recovery frame.
- **Slice 2 — a per-figure move picker** (PR #359, `feat/move-poses-s3-move-picker`) — options come straight off
  the engine-mirror table, so the picker cannot offer a move the engine lacks; `""` is the engine's own idle
  sentinel. Selecting stamps and lets go (decision 6). **One mutant survived the first pass** — "the picker does
  not reflect the committed move": there were tests for writing but none for reading back. Refactor **taken**:
  the stamp became a pure `selectMove(controls, move)` in `controls.ts`, which slices 3 and 4 then extended
  exactly as predicted.
- **Slice 3 — the gap snaps to the move's true reach** (PR #360, `feat/move-poses-s3-gap-snap`) — driven by
  slice 2's eye check, where `empi` (95k) selected at the 240k default visibly whiffed. The superseded "Reach
  preset" dropdown was **retired**, and two of its tests with it: one had its live half moved into the picker
  test, the other described a read-back state that no longer exists.
- **Slice 4 — the picker stamps a legal band** (PR #361, `feat/move-poses-s3-band-stamp`) — `bands` joins the
  mirror as its third transcribed field, in `rules.ts`'s own order, since the **first** entry is what gets
  stamped.

[move-poses-s3.md](move-poses-s3.md) — the plan, with all four slices' recorded outcomes, the amended AC and the
rejected refactors. The arc's design trail (`plans/move-poses-{decisions,stories}.md`) stays **live in
`plans/`**, since S4–S8 still run off it.

**The engine settled a question the plan got wrong.** The plan assumed all 13 moves carry a band list —
`sweep` and `throw` do not. The tempting fix was to invent one (the sweep is documented as a low technique).
`bandLegal` (`sim.ts:613`) decided it instead: an **absent `bands` means _every_ band is legal, not none**. The
sweep is gated by hurtbox occupancy; a throw is a grab with no height. So the mirror leaves them absent and the
stamp leaves the band alone — whatever is set is already legal. **No interpretation entered a table whose whole
job is to transcribe**, and the AC was amended rather than the data bent.

**The finding that outlives the story — S2's structural mismatch is now visible, and it lands on S5.** Standing
the pair at each move's true reach shows the body failing to fit the engine's distance range from both ends at
once: **`empi` at its true 95k renders as two interpenetrating figures** (heads overlapping, bodies crossed),
while **`ushiro-geri` at 330k stretches the arm enormously**. Both are correct — those _are_ the engine's
distances. S5's two moves (`empi`, `hiza-geri`) are exactly the close-range pair this makes undrawable, so S5
must confront it rather than inherit it.

**GOTCHA — `as const` hides an absent optional key.** `throw`/`sweep` have no `bands` **key**, so the literal
union has no such property and `tsc` rejects reading it _even though the tests pass_. Read through the declared
type (`p: ReachPreset`), where the field is optional.

**GOTCHA — a control that both writes and displays needs both assertions.** Slice 2's scan found the picker had
tests for writing but none for reading back, so a mutant deleting `value={...}` survived. The scan is what
earned that test, not the TDD pass.

**Two refactors rejected, recorded.** `SpacingControl` keeps its component despite collapsing to a single
slider (a named fieldset with its own accessible name and format constants). A named `primaryBandOf` has one
caller, and its fallback (`?? controls.attackBand`) belongs to the caller, not the table. **Still carried:**
`formatGap` / `formatReach` are the same one-liner — predicted to ride along with slice 4, which never opened
that file, so it remains a standalone tidy rather than something smuggled into a feature commit.

## Move showcase & per-move poses — S4: the moves fighters actually throw look distinct ✅ COMPLETE (5/8 of the arc, 2026-07-20)

The first story a **spectator** sees pay off. S1–S3 built the mechanism and the harness; S4 spent it on the
two moves with real screen time — `gyaku-zuki` (~80%) and `mawashi-geri` (~13%). It grew mid-flight from 4
slices to 6: the shoulder girdle (M12) was not a third move but the mechanism without which the reverse punch
did not read. Every slice was `web/`-only — `BENCHMARK_VERSION` held at `v19`, `git diff main -- src/` empty
each time (M11) — with mutation `N/A` (`web/` is outside Stryker); substitute evidence was exhaustive
exact-assertion tests, a **scripted** manual mutator scan, and a Playwright `/dojo` visual sign-off.

- **Slice 1 — the reverse punch is thrown with the rear arm** (PR #363, `feat/move-poses-s4-gyaku-zuki`) —
  `StrikeLimb` gains `handL`; a **precedence rule** lets a committed strike win the rear hand off the guard
  (gated on a live strike, not the move id). The visual check found the distinction reads _faintly_ — both
  arms hang off one shoulder, so the extended arm lands the same place either way.
- **Slice 2 — the reverse punch chambers at the hip, `hikite` folded in** (PR #363) — the off-hand pull is the
  first crack in M3's "only the driven endpoint moves": a second authored endpoint. Authored at the hip first,
  found undrawable (outside the arm's reach once the girdle slid the shoulder), parked at the flank until
  slice 5.
- **Slice 3 — a punch leans only as far as it must reach** (PR #364, `feat/move-poses-s4-lean`) — the heuristic
  `strikeLean` became the derived `rootTravel` shortfall shared with the kick's hip step. **The eye-check here
  surfaced the arc's main risk on _punches_, not the kicks it was forecast for:** at the workhorse distance a
  jab and a reverse punch render on the **identical pixel**. That forced the **M12 girdle decision tree** (10
  sub-decisions), pinned in the plan before slice 4.
- **Slice 4 — the fighter gets a shoulder girdle** (PR #365, `feat/move-poses-s4-girdle`) — `Skeleton` gains
  derived `shoulderL`/`shoulderR` at `shoulder.x ± SHOULDER_HALF_WIDTH`; each elbow re-roots onto its own
  shoulder so the rear arm starts 14px back. `ARM_BONE` deliberately unchanged (widening shoulders does not
  shorten arms). Shipped a **bounded intermediate state** (the rigid slide stretched `hikite` 8.7%, ceilinged
  by an AC), removed in slice 5.
- **Slice 5 — the torso rotates into the punch** (PR #366, `feat/move-poses-s4-rotate`) — the lean drives only
  the **driving** shoulder by the full amount (a new `GirdleShift` on `deriveSkeleton`), midpoint + head follow
  at half, and the shortfall is measured per-arm — so a reverse punch leans more than a jab at mid range. The
  rear shoulder comes through; the front returns to x 7, **restoring `hikite` to the hip** where slice 2 wanted
  it. Slice 3's hand-ride retired with the slide that forced it.
- **Slice 6 — the roundhouse kicks with the rear leg** (PR #367, `feat/move-poses-s4-mawashi-geri`) — the
  forecast M3 risk finally bit where predicted, on the kicks: `mae-geri` and `mawashi-geri` both drive a foot to
  the same solved target, so the same foot would render them identically, and a 2-D side view cannot show
  lateral hip rotation. Took **M12i's named escape hatch — drive the REAR leg (`footL`, a new `StrikeLimb`)**;
  a shared `isKick` predicate generalised the two `footR` gates. Not a bespoke mechanism: another endpoint
  through the shared solver.

[move-poses-s4.md](move-poses-s4.md) — the plan, with all six slices' recorded outcomes, the M12 girdle
decision tree, and slice 6's honest `/dojo` read. The design trail
(`plans/move-poses-{decisions,stories}.md`) stays **live in `plans/`**, since S5–S8 still run off it.

**The expressiveness limit was diagnosed AND treated — twice.** M3 accepts "only the driven endpoint moves",
and the plan forecast this would collapse the four kicks into one picture. It bit first on **punches** (slice 3) — because both hands shared one shoulder — and the treatment was the girdle. It bit again on **kicks**
(slice 6) as forecast, and the treatment was to drive a **different limb** (the rear leg). Both are the same
move: when two techniques land the same endpoint, separate them by _where the limb starts_, not by nudging
where it ends.

## Move showcase & per-move poses — S5: close-range techniques lead with the elbow / knee ✅ COMPLETE (6/8 of the arc, 2026-07-20)

The story that **inverts** the pose model, and the one that closes the arc's structural close-range overlap.
Every strike S1–S4 authored drives an ENDPOINT (a hand, a foot) and lets the bend rule DERIVE the mid-joint;
`empi` (elbow) and `hiza-geri` (knee) are the only two moves whose striking surface IS the mid-joint, so they
drive the joint and let the endpoint TRAIL, folded back behind it. S5 promoted the mid-joint to a first-class
driven `StrikeLimb` (M13) and confronted the close-range **overlap** (M13g) that S3 · Slice 3 had surfaced. Both
slices were `web/`-only — `BENCHMARK_VERSION` held at `v19`, `git diff main -- src/` empty (M11) — with mutation
`N/A` (`web/` is outside Stryker); substitute evidence was exact-assertion tests, a manual mutator scan, and a
Playwright `/dojo` visual sign-off.

- **Slice 1 — `empi` leads with the elbow** (PR #369, `feat/move-poses-s5-empi`) — the **mechanism carrier**.
  `StrikeLimb` gains the four mid-joints; a driven `elbowR` routes through the SAME `reachTargetX` solve to the
  opponent's near edge, the fist folds back via an authored **relative `tuck`** (M13c, so it rides chamber →
  contact for free), and the driven joint is written back over `deriveSkeleton`'s derived bend as a final layer
  (M13b). A driven mid-joint **holds the root** — `lean` and `step` gate to 0 (M13f). The RED driver was the
  routing: `elbowR` fell through to the generic front hand, so the fist led and the elbow was only the bisector.
- **Slice 2 — `hiza-geri` leads with the knee** (PR #370, `feat/move-poses-s5-hiza-geri`) — the **leg branch +
  reuse**. A driven `kneeR` folds `footR` (not the fist), rooted at the single `hip` with the other leg planted
  as the support and no step. The same two routing edits as slice 1, mirrored onto the leg; the manual scan
  found one survivor — the `tuck.y` sign (foot folding ABOVE the knee) — killed by a `footR.y > kneeR.y`
  relation and verified by an induced failure.

[move-poses-s5.md](move-poses-s5.md) — the plan, with both slices' recorded outcomes, the manual-scan survivor,
and the M13g overlap sign-off. The design trail (`plans/move-poses-{decisions,stories}.md`) stays **live in
`plans/`**, since S6–S8 still run off it.

**The close-range overlap was accepted, not faked.** At `empi`'s 95k and `hiza-geri`'s 110k reach the two
figures interpenetrate — the truthful consequence of clinch distance against a body that stands one height from
its opponent. The M13g **tripwire** (would `/dojo` read the clinch as a z-fighting BUG?) did NOT fire on either
move: a knee or elbow driving INTO the opponent at that range reads as **infighting**, which is what contact at
clinch range looks like. No bespoke spacing treatment was built — the arc's "root x is truthful, compromises are
cosmetic" rule since S2 · Slice 3 held to the end.

**When two techniques land the same endpoint, separate them by where the limb STARTS.** S4 · Slice 6 learned it
for the two foot-kicks (drive a different leg); S5 generalised it — `empi` and `hiza-geri` land near the same
close-range target a punch would, and what separates them is the DIFFERENT limb that leads (the mid-joint) and
the DIFFERENT root it hangs from (shoulder vs hip). A 2-D side view cannot show a lateral turn, so the
distinction must live in which joint drives, not in where it ends up.

**GOTCHA — never trust an exit code as a kill signal.** The slice-4 scan reported a **false kill**: `execSync`
goes non-zero for runner errors as well as test failures, so a mutant that broke the harness read as "killed"
while it was alive. Every scan since records a kill only when the run **names a failing test**. A transport
test also surfaced intermittently _only under mutation_ — more reason to attribute kills to named tests, not
counts.

**GOTCHA — a Pixi `Graphics` path is invisible to display-object assertions.** Re-rooting an arm or dropping
the girdle bar was invisible to the whole suite while plainly visible on screen, until `BONES` was **exported**
and its wiring asserted directly (same discipline as `DESCRIBED_MOVES`). Any change to what the draw layer
connects needs that test.

**GOTCHA — the working tree is CRLF, so multi-line mutation anchors miss.** `.ts` files check out CRLF on
Windows (the repo LF-pins via `.gitattributes`), so a scripted-scan anchor containing `\n` never matches.
Single-line, uniquely-identifying anchors are robust; span-a-newline ones are not.

**GOTCHA — measure a limb from its REAL root, not the midpoint.** A slice-5 resting-arm bone-drift test
measured from the shared `shoulder` midpoint — a fictional bone that passed under the old hand-ride (arm rigid
vs a moving midpoint) but drifted 35% under rotation. Rooted at `shoulderL` (the arm's actual origin) it read
true.

## Move showcase & per-move poses — S6: the non-strike moves read correctly ✅ COMPLETE (7/8 of the arc, 2026-07-20)

The story that **completes the 13-move roster** and retires the arc's last non-descriptor render path. S1–S5
authored every move that drives a single limb to a height band; S6 is the trio that doesn't — a `sweep` that
reaps along the floor, a `tobi-geri` thrown from the air, and a `throw` that grips with both hands. All three
slices were `web/`-only — `BENCHMARK_VERSION` held at `v19`, `git diff main -- src/` empty (M11) — with mutation
`N/A` (`web/` is outside Stryker); substitute evidence was exact-assertion tests, a manual mutator scan, and a
Playwright `/dojo` visual sign-off.

- **Slice 1 — `sweep` reaps low with the front foot** (PR #372, `feat/move-poses-s6-non-strike-moves`) — the
  **first non-strike descriptor** and the first driven endpoint at a **fixed height** rather than a band. A
  sweep's band is UNRESTRICTED (the engine gates it by hurtbox occupancy, not `bandLegal`), so its height
  cannot come from `attackBand` the way a kick's does — a new optional **`MoveDescriptor.targetY`** pins the
  reap near the floor, resolved as `targetYFor(move) ?? bandHeight(attackBand)` (every banded strike unchanged).
  The `footR` reaps at any band, including the band-0 / unmapped codes a banded kick declines.
- **Slice 2 — `tobi-geri` is a flying front kick** (PR #373, `feat/move-poses-s6-tobi-geri`) — the only
  **airborne** technique. Descriptor `{ limb: "footR" }` (no chamber — the AIR-tucked foot IS the wind-up; no
  `targetY` — it is banded). One new production line, `isAirborne = posture === 2`, gates the hip **step** to 0
  for an airborne kick: the jump arc (`rules.ts`) supplies the closing, so a stepping hip on a floating body
  would read as a mid-air lunge, and the leg telescopes for the residual (as a mid-joint holds its root). The
  grounded-vs-air hip-contrast test (same move, posture 0 vs 2) is the tightest guard on the gate.
- **Slice 3 — `throw` dispatches through the descriptor** (PR #374, `feat/move-poses-s6-throw-dispatch`) — the
  **last non-descriptor render path retires**. The grab now dispatches on `attackMove:"throw"` (an `isGrab`
  descriptor flag, `MoveDescriptor.limb` made optional) instead of the `frame.throwing` boolean. `strikeHandFor`
  returns null for a grab, suppressing the phantom strike layer so a `/dojo` throw renders identically to
  `/watch`. The dead `/dojo` `throwing` control was removed (`FigureControls.throwing` dropped; `throwing` kept
  on the `ReplayFrame` wire). The `/dojo` picker, which stamps the move id but never the flag, finally draws
  the two-hand grab instead of a generic hand.

[move-poses-s6.md](move-poses-s6.md) — the plan, with all three slices' recorded outcomes, the grill decisions,
and the byte-identical `/watch` proof. The design trail (`plans/move-poses-{decisions,stories}.md`) stays
**live in `plans/`**, since S7–S8 still run off it.

**Byte-identical `/watch` came for free from the engine's own emission.** `renderFrameOf` sets `throwing`,
`attackMove:"throw"`, and `attackReach` from the SAME `state.kind === "throwing"`, so every real throw frame
(startup → active → recovery) carries `attackMove:"throw"`. Moving the grab's gate from the boolean to the
descriptor therefore renders every shipped throw frame unchanged — the existing exact-coordinate throw tests,
given both flags, became the characterisation guard (green before and after). The lesson: **before regating a
render path, check whether the two gates are emitted from one source** — if they are, the migration is free.

**A dispatch change can leave the tests it needs already written.** Slice 3 touched eight files, but most were
collateral: `controls.test`, `DojoApp.test`, and `figures.test` each built throw frames with `throwing:true`
alone, which the regate stopped drawing until `attackMove:"throw"` was added. The RED drivers were only two —
the `/dojo` grab (throw move, no flag) and the gate-switch (stale flag, no throw move) — and the rest was
propagating the new frame shape through the suite.

**GOTCHA — a "flag" descriptor beats a discriminated union here.** A grab authors no `limb`, so a
`{ kind: "strike" | "grab" }` union was tempting; but the lookups (`limbFor`, `chamberFor`, …) all read fields
through optional chaining and stay total, and a union would force every one of them to narrow. A lighter
`grab?: boolean` flag (plus making `limb` optional) kept all lookups untouched. The plan's suggestion to remove
`poseFor`'s `grab` param was also declined: `poseFor(frame, strikeHand, grab)` pre-solves both
opponent-dependent layers in `scene()`, and removing only `grab` would make that asymmetric.

## Move showcase & per-move poses — S7: compare the whole arsenal at a glance ✅ COMPLETE (8/8 of the arc, 2026-07-20)

The **detector** for the arc's carried expressiveness risk (M3 — only the driven endpoint moves, so whole-body
character is not expressible). A dark **`/sheet`** route lays all 13 techniques in a labelled grid, each
attacker frozen at its ACTIVE phase, so a developer can see at a glance whether any two moves read alike. Single
slice, `web/`-only (`BENCHMARK_VERSION` held at `v19`, `src/` untouched); mutation `N/A` (`web/` is outside
Stryker) → exact-assertion scene-graph tests + a manual mutator scan + a Playwright visual sign-off (PR #376,
`feat/move-poses-s7-contact-sheet`).

- **The pure/Pixi split mirrors `scene.ts`/`figures.ts`.** `web/src/pages/sheet/contact-sheet.ts` (pure, no
  Pixi) is the testable heart: `contactSheetCells(viewport)` iterates `REACH_PRESETS` and drives each move
  through the SAME `selectMove → controlsToFrame → buildDojoTape → scene(tape, preset.startup, vp).a` path
  `/watch` ships, so "what a move looks like on the sheet is what it looks like in a fight". `figures.ts` gains
  `createContactSheet(cells, layout)` — a grid of single figures alongside `createStage`'s posed pair,
  **reusing the private `createFigure` / `applyFigure`** by taking pre-computed `{ id, placement }` inputs, so
  `figures.ts` gains no `dojo` import and the shipped 2-figure ring is untouched.
- **One Pixi canvas + N grid cells, not 13 `Application`s** — browsers cap ~16 WebGL contexts, so 13 mounted
  apps would be fragile. A single canvas with grid-positioned sub-containers is the sound architecture and the
  one bit of real engineering in the slice.
- **`tobi-geri` is posed AIRBORNE** (an `AIRBORNE_MOVES` set in `contact-sheet.ts`): rendered grounded it drives
  `footR` to the band exactly as `mae-geri` does and would be a **false look-alike** the detector wrongly flags —
  but on `/watch` it is airborne, so the sheet mirrors that. Posture isn't in any web table, so this is a
  localised, documented web-mirror of an engine fact.
- **The detector worked, and confirmed the accepted trade-off.** Visual sign-off: the 8 authored moves read
  distinctly; the 5 undescribed tail moves (`uraken`, `kizami-zuki`, `shuto`, `yoko-geri`, `ushiro-geri`) all
  render as the generic hand and **do** read alike — exactly the outcome the S4 stopping rule parked as
  acceptable (the rare, never-thrown tail can stay generic). Grid cosmetics (scale, cell size) are eye-tunable,
  not test-pinned (decision 9).

[move-poses-s7.md](move-poses-s7.md) — the plan, with the settled decisions and the recorded outcome.

## Move showcase & per-move poses — S8: a technique flows instead of snapping between three held poses ✅ COMPLETE — **ARC COMPLETE** (2026-07-20)

The arc's **finale**. Until now a committed move drew one held shape per phase — `attackPhase` picked the chamber
(startup / recovery) or the solved extension (active) and every tick within a phase drew the identical pose — so
the driven endpoint **teleported** at each phase boundary and froze between them (a `gyaku-zuki` held its chamber
for 7 ticks, its extension for 3, its chamber for 14). S8 makes the driven point (and the lean / girdle /
mid-joints derived from it) **travel** `stance → chamber → extension → chamber → stance` across the tape's
per-phase run, on `/watch` and `/dojo` alike — the one story that changes how `/watch` looks while **authoring
nothing new** (the keyframes are the shapes S1–S7 already authored). Single slice, `web/`-only (`BENCHMARK_VERSION`
held at `v19`, `src/` untouched), grilled → decisions **M14** (PR #377, `feat/move-poses-s8-easing`).

- **Progress is DERIVED in-web** — a new pure `phaseRunAt(tape, playhead, select)` run-length-scans the
  contiguous ticks sharing this fighter's `attackMove` + `attackPhase` (the same pure-scan idiom as
  `scoredWithin`). No engine / contract field (the parked `attackProgress` stayed parked), so `v19` holds and the
  scan is replay-safe. A change of move, a change of phase, or an idle gap bounds the run — two back-to-back
  techniques never blend into one motion.
- **THE load-bearing insight (M14e).** `poseFor` was already structured so a single `driven` point is what the
  lean, hip-step, girdle rotation, `deriveSkeleton` mid-joints, and the mid-joint write-back all flow from. So the
  core change is one line of intent: replace the discrete `isChamberPhase` pick with a continuous **smoothstep
  keyframe blend** (`easeDriven`). Because the whole chain re-derives from `driven`, **body-coherence and the
  fixed bone lengths (S2 · Slice 3) hold for free** — `deriveSkeleton` re-solves each mid-joint at fixed length
  from the eased endpoints. Lerping the RESOLVED skeleton joint-by-joint was rejected: it would drift a mid-joint
  off its bone length mid-travel and reopen that stretch scar.
- **The extension lands on the FIRST active tick — a `kime` commit — revised during TDD.** The original M14(c)
  put full extension at the mid-active PEAK; that broke 4 tests, because the **S7 contact sheet and the S2 dojo
  default both render each move at its first active tick (`preset.startup`) and require the solved extension
  there**, and every pre-S8 single-tick test reads a lone active tick as the extension. Anchoring the extension
  at the first active tick (easing back to the chamber across the rest of active) keeps those surfaces
  byte-identical, still moves within the active phase, and reads as an explosive strike. The lesson: **a shipped
  detector doubles as a regression oracle** — S7 pinned the invariant that caught the peak-model mistake within
  minutes.
- **Totality keeps every existing single-tick test green.** A run of length 1 (a synthetic single-tick tape, or a
  lone phase tick) makes `easeDriven` return the phase's primary keyframe exactly, reproducing the pre-S8 discrete
  pick; a chamber-less move eases through its stance; an idle / unknown / non-`{1,2,3}` phase draws the extension
  as before.
- **Mutation `N/A` → manual scan + two real mutation kills.** The run-scan's boundary is `attackMove === … && attackPhase === …`; each half was genuinely mutated on the real source and the run re-run: dropping the
  `attackMove` check failed the move-change test, dropping the `attackPhase` check failed the 3→1 phase-drop test.
  Curve-coefficient mutants that stay monotonic 0→1 survive **by design** — the curve is the eye-tuned swappable
  seam (decision 9). 598 web / 2233 full-suite green. The `dojo-tape.test.tsx` default-scene tests were updated to
  characterise the eased wind-up: tick 0 is now the stance (wind-up start), and the chamber is reached at the last
  startup tick — the S2 "tick 0 = chamber" assumption is outdated by easing.

[move-poses-s8.md](move-poses-s8.md) — the plan, with the recorded outcome and the TDD refinement.

**The arc is complete — all of S0–S8 shipped, and the full design trail is now archived.** Alongside the eight
per-slice plans (`move-poses-{s0-s1,s2,s3,s4,s5,s6,s7,s8}.md`), the two remaining live design documents were
archived in this closeout: [move-poses-decisions.md](move-poses-decisions.md) (the 10 decisions + mechanics
**M1–M14**) and [move-poses-stories.md](move-poses-stories.md) (the story split). **The retrospective in one
line:** each of the 13 arsenal moves reads as its own technique on `/watch`, can be compared on the `/sheet`
contact sheet, and now flows — built across 9 stories and ~20 PRs, on a single additive engine field (S0) and
otherwise entirely in `web/`, with `BENCHMARK_VERSION` never leaving `v19`. **The unifying design lesson**
(when two techniques land the same endpoint, separate them by where the limb STARTS — the girdle and the rear-leg
roundhouse — not by nudging where it ends) and the structural note (the body cannot span the engine's distances;
the bounded limb-stretch is the compromise that makes contact legible, not a bug) carry forward to any future
pose work. Defense / _uke_ is explicitly a **separate later arc** (decision 7).

## Replay strike makes visible contact — a scored strike connects on `/watch` ✅ COMPLETE (2/2, 2026-07-21)

Fixed the viewer defect where a scored strike looked like it whiffed: the engine only ever awards a point
_inside_ a strike's active window, but `easeDriven` snapped the limb to full extension on the **first** active
tick and eased it back toward the chamber across the rest — so by the time the point registered a tick or two
later, the drawn limb had 50–100 % re-chambered and contact was a single-frame blip. Two behaviour slices, both
entirely in `web/` (no `src/` / TCB / `v19` / `INPUT_HASH` touch), TDD RED-GREEN with a manual mutator scan (the
`web` project is outside Stryker). The design trail (`plans/replay-strike-{decisions,…}`) folded into the plan.

- **Slice 1 — a committed strike holds its extension through the scoring tick** (PR #380,
  `feat/replay-kime-hold`) — `easeDriven`'s active branch now returns the `extension` keyframe for the **whole**
  active window (a _kime_ hold) instead of a `chamber→extension→chamber` blend, and the retract moves to the
  **recovery** branch (`extension→stance`). Because the score always falls inside the active window, holding
  extension across it is guaranteed to cover the scoring tick — no engine change, no off-by-one. The `length <= 1`
  fallbacks are untouched, so `/sheet` (the first-active-tick contact sheet) and `/dojo` single-tick previews stay
  byte-identical.
- **Slice 2 — a scored strike flashes an impact mark where it lands** (PR #381, `feat/replay-contact-flash`) —
  the readability cue on top of the held limb. `scene()` gains a pure per-fighter `contact: { a, b }`
  (`Mark = {x,y,age}`): scan back within the score-pop window to each side's last score, anchor at **that score
  tick's** committed-action target (a strike's reach-to-target endpoint, a throw's grab hand) in absolute screen
  px, `age` from the score tick — so the starburst is fixed in world space and fades **in place** while the
  fighters _yame_-reset. A throw scoring on a non-grab finish falls back to the nearest in-window grab frame. The
  Pixi layer draws a per-side starburst, alpha faded by age, cleared when `null`.

[replay-strike-contact.md](replay-strike-contact.md) — the plan, with both slices' recorded outcomes, the
constraints, and the Slice 2 implementer notes.

**The lesson (both slices):** the fix lived entirely in the pure `scene()` projection + its Pixi draw layer, on
one key enabling fact — **the score always falls within the active window** — so both "hold the limb there" and
"mark where it landed" are guaranteed by anchoring on the active/score tick rather than chasing the exact frame.
Every new derivation stayed a **pure scan of the tape at the playhead** (the `scoredWithin` / `phaseRunAt` idiom),
so it is identical on replay and after any scrub, and the whole arc held `BENCHMARK_VERSION` at `v19` with `src/`
untouched — the same web-only discipline as the move-showcase arc it builds on.

## Per-move character differentiation — colliding moves read apart by execution (✅ complete, 5 of 5)

A post-arc follow-up to the move-showcase arc. That arc got every move to read as its own **limb** and closed
accepting **M3**'s expressiveness limit — _only the driven endpoint moves_, so two moves that drive the same limb
to the same band render the identical **contact** picture and differ only by reach. A user browsing `/dojo`
reported the consequence: `mae-geri`/`yoko-geri` (footR), `mawashi-geri`/`ushiro-geri` (footL), and
`uraken`/`kizami-zuki`/`shuto` (handR) look the same, "only the distance" differs. This arc takes that up: the
**7 colliding moves** in three same-limb groups read apart by **execution** (a distinct wind-up / motion / posture),
not by re-sculpting contact. Levers, cheapest-first: the existing **`chamber`** (S1), a per-move **lean** (S2 —
consciously reopens the M9 upright-kick rule), and an **arc via-waypoint** (S3), then group-completion S4/S5.
Facing is excluded from v1. Web-only throughout (`src/` / TCB / `INPUT_HASH` / `BENCHMARK_VERSION` `v19` untouched);
each slice is verified by exact-assertion tests + a manual mutator scan (the `web` project is outside Stryker) +
a `/dojo` visual sign-off (Playwright — `agent-browser` hangs on the Pixi canvas).

- **S1 — the front-hand trio winds up from its own chamber** (PR #386, `feat/move-character-s1-hand-chambers`) —
  `uraken` (backfist), `kizami-zuki` (jab), and `shuto` (knife-hand) each author their **own `chamber`** in
  `move-descriptors.ts` (the **existing** field, no new mechanism), so their wind-ups play as three distinct
  motions on `/dojo` + `/watch`. **Contact stays byte-unchanged (M3):** `easeDriven` returns the solved extension
  at the active phase regardless of the chamber, so the chamber shapes startup/recovery only — the difference is
  visible in the wind-up, not the contact frame (so `/sheet` + `/watch` contact frames look identical to today; a
  `/sheet` motion-trail to surface it statically is a parked follow-up). Each chamber sits well inside an arm's
  reach of the front shoulder `(7, −64)`, so `deriveBend` never straightens the limb into a stretched line —
  confirmed in the `/dojo` capture (jab forward-low · backfist across · knife-hand high by the ear, no stretched
  arms). **The coupled cost:** `kizami-zuki` was the suite's canonical "real move with no descriptor" fixture; after
  S1 **every arsenal move is described**, so the M7 generic-hand fallback is only reachable by non-arsenal ids —
  those sites re-point to the unknown id `"no-such-move"` (only **2** actually turn RED: the S2 chamber-hold and the
  S8 extension-hold; the rest pose at the extension phase and stay green). Manual mutator scan: duplicate-chamber and
  limb-flip-to-foot mutants killed; chamber-value perturbations that keep the three distinct + off-stance survive by
  design (decision 9 — the relation is pinned, not the eye-tuned literal).

[move-character-s1.md](move-character-s1.md) — the S1 plan, with the recorded outcome and the full per-site
fixture-rework categorization.

- **S2 — a move can lean back as part of its technique** (PR #388, `feat/move-character-s2-lean`) — the first of
  the two **mechanism-risk skeletons**: a new optional per-move **`lean`** descriptor field (a horizontal upper-body
  shift, `+` forward / `−` back) + a total `leanFor` lookup, wired in `scene.ts` as an `authoredLean` term added to
  `head.x` / `shoulder.x` **only** (not the girdle — a torso pitch is not an arm rotation — and not the hip, whose
  step still answers a kick's reach), gated to the **active phase**. `yoko-geri` authors `lean: -8` and becomes the
  **first kick to lean at all**, pitching back off its bladed side kick so it reads apart from `mae-geri`'s upright
  front snap. The lever is **purely additive** — any move that authors no lean gets `authoredLean = 0` and renders
  byte-identically, so `src/` / TCB / `INPUT_HASH` / `v19` stay untouched. **M9 amended (conscious — the story's
  requirement):** the derived reach-lean is hand-only and zeroes for kicks (`isKick ? 0`) — that zero **was** M9;
  M9 becomes _"a kick is upright **by default**; an authored lean is the conscious exception."_ The
  `mae-geri`/`mawashi-geri` M9 tests keep their assertions (both author no lean → still upright) and got reworded
  premises pointing at the new `yoko-geri` test. **Bonus:** because the lean shifts the contact silhouette, `yoko`'s
  `/sheet` cell now differs from `mae`'s too (execution twins otherwise stay alike on `/sheet` until the parked
  motion-trail). Manual mutator scan: sign-flip, phase-gate-drop, and shoulder-lean-drop mutants killed; the exact
  `-8` px (eye-tuned, decision 9) and a redundant `driven === null` guard (dead under the endpoints spread, kept for
  parallelism) survive by design.

[move-character-s2.md](move-character-s2.md) — the S2 plan, with the recorded verification (RED → GREEN → manual
scan → `/dojo`).

- **S3 — a technique swings its driven endpoint through an arc** (PR #390, `feat/move-character-s3-arc`) — the
  **second and last mechanism-risk skeleton**: a new optional per-move **`arc`** descriptor (an authored via-waypoint,
  same local frame as `chamber`) + a total `arcFor` lookup + a pure `bezier2` quadratic Bézier. `easeDriven`'s
  **startup branch only** becomes `arc === null ? lerpJoint(stance, chamber, u) : bezier2(stance, arc, chamber, u)`, so
  `mawashi-geri` (which authors `arc: {-26, -16}`) **swings its rear foot up-and-around** as it winds up — a circular
  load that reads apart from `ushiro-geri`'s straight rear-leg thrust (same leg, no arc, the side-by-side control).
  **The Bézier pins both endpoints** (`t=0`→stance, `t=1`→chamber), so the chamber is reached exactly at the last
  startup tick and the _kime_ commit (the held solved extension at the active phase, S1) is **byte-identical** — this
  **resolved the arc's open question:** carried-risk 1 warned an arc on the chamber→contact (kime) leg would soften the
  strike, so the swing rides the **wind-up** leg instead, where the roundhouse's circular load lives. The recovery-leg
  arc (`extension → stance`, same `bezier2` at a second call site) is a **stated deferral** — the walking skeleton
  proves the mechanism on one leg. Purely additive (unauthored moves byte-identical). RED was the signed cross-product
  `expected -83 to be less than -800` (no arc ⇒ the mid wind-up foot is collinear ⇒ the bow is rounding noise); the
  test pins the bow's **side + magnitude** via an affine-invariant cross-product, **not** the eye-tuned via literal
  (decision 9). Manual mutator scan: drop-the-Bézier, via sign-flip, `arcFor` fallback leak, and phase-2-short-circuit
  break all killed; the exact via px survives by design.

[move-character-s3.md](move-character-s3.md) — the S3 plan, with the resolved open question and the recorded
verification (RED → GREEN → manual scan → `/dojo`).

- **S4 — a back kick reads as a straight thrust pitched forward** (PR #392, `feat/move-character-s4-ushiro`) — the
  **first group-completion slice**, and the first to introduce **no new mechanism**: it reuses S2's optional `lean`
  field, authored **forward** this time. `ushiro-geri` gains `lean: 8` (the mirror of `yoko-geri`'s `-8` — symmetric
  ±8), so at contact its torso **pitches forward** into the linear back-thrust — a committed drive that is the opposite
  of the side kick's bladed lean-back and a posture the roundhouse (`mawashi-geri`, upright + arcing foot, S3) never
  strikes. This **finishes the rear-foot pair:** `mawashi` arcs its foot and stays upright; `ushiro` drives its foot
  straight and leans forward. **No `scene.ts` change** — the S2 `authoredLean` term already adds to `head.x` /
  `shoulder.x` for **any** driven limb, gated on `winding` (not `isKick`), so a `footL` kick opts in exactly as
  `yoko`'s did; the whole slice is one descriptor value + comment. **No M9 re-amendment** — `ushiro` is the **second
  instance** of the exception S2 opened, so the `mae`/`mawashi` upright tests stay untouched. The straight foot path
  (no arc) and the solved contact point stay **byte-identical** — S3's `ushiro`-collinear test and the `ushiro`
  foot/hip tests stayed green (the lean shifts only the upper body). **The "falling into a rising leg" risk** carried
  in the plan never materialized: the active-phase gate keeps the wind-up upright (leg rising, torso vertical), and the
  forward pitch appears only at the extended kime — confirmed in the `/dojo` wind-up capture. **Honest caveat:**
  `ushiro`'s _absolute_ forward pitch on `/dojo` is modest because it is the longest reach (330k), so the big hip-step
  dominates any lean — the headline read is the clear opposite-sign contrast against `yoko`, which the tests pin
  quantitatively at a matched setup (forward > `mae`; `yoko` < `mae` < `ushiro`; `mawashi` upright but `ushiro` >
  `mawashi`; the lean contained to the upper body, foot unchanged). The reach bound mirrors `yoko`'s: a forward lean
  stretches the **rear** arm, span `√((N+11)²+400)` must stay under `2·ARM_BONE ≈ 31.3`, so `+8`→27.6 is comfortably
  safe (headroom to N≈13). Manual mutator scan: sign-flip, drop, and zero all killed; the exact `8` px survives by
  design (decision 9).

[move-character-s4.md](move-character-s4.md) — the S4 plan, with the "no new mechanism / no `scene.ts` change"
rationale and the recorded verification (RED → GREEN → manual scan → `/dojo`).

- **S5 — the front-hand pair loads on its own arc** (PR #394, `feat/move-character-s5-hand-arcs`) — the **last
  slice**, and the second group-completion slice: like S4 it reuses a built lever with **no new mechanism** and
  **no `scene.ts` change**. `uraken` and `shuto` author S3's optional `arc` field (`uraken { arc {8,-60} }`,
  `shuto { arc {2,-46} }`) on top of their S1 chambers, so each front hand **loads on a curve** — `uraken`
  bowing up-and-across, `shuto` bowing the **other way** up to its high by-the-ear cock — while `kizami-zuki`
  (the jab) stays the straight ease, the group's no-arc control (the way `ushiro-geri` was for the rear-foot
  pair). The two curve to **opposite sides**, so the trio reads apart by wind-up **path**, not just chamber. The
  lever transferred from foot to hand for free: `easeDriven`'s startup Bézier bows **whichever endpoint `limb`
  names**, and a hand's wind-up has `step` / `lean` / `girdle` all `0`, so the bowed `handR` flows to the pose
  as cleanly as the foot did — the same literal-free seam. As with every arc it rides the **wind-up** only:
  D8's whip / chop is the untouchable _kime_ (carried-risk 1, resolved in S3), so the arc shows the **loading**
  curve, exactly as `mawashi`'s did. The one thing S5 had to prove that S3 did not — that the two arced moves
  read apart **from each other** — is pinned by an offset-direction test (`offset(uraken)·offset(shuto) < 0`),
  the sole killer of a "gave both the same via" regression. RED was the no-arc bow at **exactly `0`** (cleaner
  than S3's `-83`). Manual mutator scan: drop each arc, sign-flip a via, and the same-via-for-both mutant all
  killed; the exact via px survive by design (decision 9). `/dojo` sign-off: three distinct loads (up-and-across
  · high by the ear · straight jab), bent elbows throughout (no stretched arms), contact unchanged.

[move-character-s5.md](move-character-s5.md) — the S5 plan, with the "arc-lever-reused, no `scene.ts`"
rationale and the recorded verification (RED → GREEN → manual scan → `/dojo`).

**Arc complete — the design trail is archived.** The decisions + stories stayed live in `plans/` across all
five slices and are archived here with the arc's close:
[move-character-decisions.md](move-character-decisions.md) (D1–D8 + constraints + carried risks) and
[move-character-stories.md](move-character-stories.md) (the S1–S5 split + dependency graph). The design PR
was #385. All **7 colliding moves** now read apart by execution — a distinct wind-up / motion / posture — and
no move-character files remain in `plans/`.

## Pure King-of-the-Hill — S1 fresh seeded v20 season ✅ COMPLETE (story 1 of 3)

The first story of the **pure King-of-the-Hill** rework: a fresh season is born already seeded with three House
champions, so `/king` and `/fight` are never an empty throne. `GET /king` on an empty (new-season) arena surfaces
the **three strongest gauntlet bots** (grappler · sweeper · rekka, ranked King/#2/#3 by a deterministic build-time
round-robin, credited `handle: "Gauntlet"` · `model: "House"`); a gauntlet-clearer that competes **contests that
House board** rather than taking a free solo crown; and the season is opened by a one-constant `BENCHMARK_VERSION`
bump. Platform-layer (`src/http` + the `api/` wrappers + the single version flip) only — **TCB untouched**, no DSL
op, no engine change; the version bump is a **season wipe, not a scoring change**, so `INPUT_HASH` is unchanged.
Design trail (still live for S2–S3): `plans/pure-koth-{decisions,stories}.md` (D1–D15). Slices 1–2 were TDD'd at
**100% mutation** on the changed `src/http` files; Slice 3 is a constant flip (mutation N/A — the version pin + two
committed-doc byte-drift guards + a preview smoke are the evidence).

- **Slice 1 — `/king` seeds an empty arena** (PR #397, `feat/pure-koth-s1-seeded-season`) — a pure
  `buildSeedArena(gauntlet)` builds `SEED_ARENA` from a **pinned** `SEED_ORDER` (grappler/sweeper/rekka, seniority
  1/2/3, gen 1, nextSeniority 4), each member stamped `handle: "Gauntlet"` + `model: "House"`; a test re-derives
  the strongest-three + their arena order from the real `benchmark` and fails the build if the pin ever diverges
  (D5 — no runtime fights, the seed is a pinned constant). The shared `readArenaOrSeed` resolver makes an empty
  store resolve to the seed; `handle-king` + `api/king.ts` read through it, **dark-launched** (inert while the live
  v19 store is non-empty). `modelToBrand("House") → generic`, so the web renders the seed as ordinary champion rows
  with **zero web change**.
- **Slice 2 — `/fight` contests the House seed, retiring the bootstrap crown** (PR #398,
  `feat/pure-koth-s1-compete-house`) — `readArenaOrSeed` now returns `{ arena, expected }` (overloaded so a required
  seed narrows `arena` to defined): on a physically-empty store the effective arena is the seed but the CAS
  `expected` is **`null`** (the find-gaps fix — committing against the seed's nominal generation 1 would 409
  forever). `handle-fight` resolves the arena + CAS token up front, mirror-checks unconditionally, and both commit
  sites use `expected`; the whole `arena === undefined` **bootstrap-crown branch is deleted** — a first clearer now
  round-robins the three House bots instead of taking a solo crown. `FightDeps.seed` is required, so `api/fight.ts`
  fails to compile without injecting the seed (a wiring guarantee).
- **Slice 3 — open the v20 season (bump `BENCHMARK_VERSION`)** (PR #399, `feat/pure-koth-s1-bump-v20`) — the
  activation: `BENCHMARK_VERSION` `"v19" → "v20"` wipes the version-scoped throne keys (`arena:v20` / `archive:v20`
  are empty), so the seed machinery shipped (dark-launched) in Slices 1–2 surfaces everywhere. **No scoring
  change** — `INPUT_HASH` is unchanged (the version is not a scoring input), so `CANONICAL_RULES`, the gauntlet, and
  every run parameter stay byte-identical; `docs/spec.md` + `docs/variety.md` were regenerated with only their
  version-string headers moving (bodies byte-identical — the two committed-doc byte-drift guards prove it). The
  manifest's Policy comment gained the "a season wipe is a legitimate bump on its own, `INPUT_HASH` unchanged" note.
  Preview smoke (real `api/king.ts` + `api/fight.ts` on an empty v20 store): `/king` → the grappler/sweeper/rekka
  House board; compete → `version: v20`. Reverting the constant restores v19 (its keys are orphaned, not deleted).

[pure-koth-s1.md](pure-koth-s1.md) — the S1 plan, with the recorded outcome + the as-built module list per slice.
The pure-KotH design trail — `pure-koth-decisions.md` + `pure-koth-stories.md` (the S1–S3 split) — stays
**live in `plans/`** for the rest of the arc (now just **S3 — watch every competing fight**).

## Pure King-of-the-Hill — S2 drop the gauntlet ✅ COMPLETE (story 2 of 3)

The second story of the **pure King-of-the-Hill** rework: the 6-bot gauntlet pre-gate is **gone**. A submitted
bot no longer has to clear a frozen gauntlet to earn a title shot — it fights the sitting arena champions
directly and is placed **crowned / entered / unplaced** by the round-robin alone. The reshape ran end-to-end —
the `/fight` contract, the `/ring` UI, the home page, the author-facing spec + `llms.txt`, and the mirror guard.
Platform-layer only (`src/http` + `api/` wrappers + `web/` + `src/cli/gen-spec.ts` + the generated `docs/spec.md`)
— **TCB untouched**, no DSL op, no engine change; **`INPUT_HASH` and `BENCHMARK_VERSION` (`v20`) are unchanged**
(dropping a pre-gate and rewording docs move no scoring input). Slices 1 & 3 at **100% / equivalent-only mutation**
on the changed `src/http` files; Slice 2 is string assembly (mutation N/A — the `docs/spec.md` byte-drift guard +
the spec-content assertions + the `/spec` envelope pin are the evidence).

- **Slice 1 — drop the gate; `/fight` + `/ring` show the arena result** (PR #402, `feat/pure-koth-s2-spec-drops-gauntlet`
  base) — the gauntlet `benchmark()` pass + `buildFightReport` + the `if (!cleared) return` gate are **deleted**;
  `settle` returns `{ version, title|projection }` and every valid bot flows straight to crowned/entered/unplaced.
  `fight-report.ts` shrinks to `toTitleFightReport` (the per-defender board rows still carry full telemetry — D8);
  the dead `FightDeps.gauntlet` / `gauntletNames` + `api/fight.ts` wiring retire (D9). `/ring` renders arena-only
  headlines + the per-defender board (scorecard + dead empty-board "first King" branches removed), and the home
  page's **"The Gauntlet" section is deleted** with the How-It-Works copy reworded to pure KotH. Net −876 lines.
- **Slice 2 — the author-facing spec + `llms.txt` describe fighting the champions** (PR #403,
  `feat/pure-koth-s2-spec-drops-gauntlet`) — `gen-spec.ts`'s overview + benchmark section + submit bullets stop
  instructing "clear all six gauntlet opponents / earn a title shot" and describe the **climb** (fight the sitting
  champions; out-rank the weakest to **enter**, top the King to be **crowned**, else **unplaced**). The fixed
  six-bot roster listing is **removed** — the spec names no fighters (not even the three transient House seeds,
  D16). `docs/spec.md` regenerated (`INPUT_HASH` + `v20` byte-unchanged — the drift guard proves it); `api/spec.ts`
  - `web/public/llms.txt` reframed to the arena.
- **Slice 3 — a raw House-champion resubmit is mirror-rejected regardless of model** (PR #404,
  `feat/pure-koth-s3-mirror-model-agnostic`) — the House seed stamps its champions `model: "House"`, so a raw
  resubmit differed only by the inert `model` label and slipped the byte-exact `sameDoc` mirror. A new `sameFighter`
  http helper normalizes `model` to a shared sentinel on both sides, then reuses `sameDoc` — a **strict superset**
  of the byte-exact check (an existing member's byte-exact resubmit is still caught). `model` is inert
  (`INPUT_HASH` excludes it), so the engine / `sameDoc` stay untouched (D17). Stryker `handle-fight.ts:157-184` →
  12/13 killed, the survivor the sentinel's value (equivalent — applied identically to both sides).

[pure-koth-s2.md](pure-koth-s2.md) — the S2 plan, with the recorded outcome + the as-built module list per slice.

## Pure King-of-the-Hill — S3 watch every competing fight ✅ COMPLETE (story 3 of 3) — CLOSES THE ARC

The **third and final** story of the **pure King-of-the-Hill** rework: a spectator can watch how a fighter beat (or
lost to) **each** of the sitting champions — not just the King bout — reaching every matchup by its own permalink,
including straight from the `/ring` board row that reports it. The `ReproRecord` already stored every defender + seed
(S5.1), so watchability was **free**; S3 made each bout **addressable** and **navigable**, then widened the retention
window. Platform-layer (`src/http` + `web/`) only — **TCB untouched**, no DSL op, no engine change, **no `INPUT_HASH` /
`BENCHMARK_VERSION` (`v20`) bump**. Node slices TDD'd at **100% mutation** on the changed `src/http` files; web slices
compensate the Node-only Stryker scope with exhaustive exact-assertion browser tests + a manual mutator scan.

- **S3.1 — reconstruct any of the three bouts by its own content-hash id** (PR #407,
  `feat/pure-koth-s3-per-bout-ids`) — the record-level `replayId` is **replaced** by a **per-bout** `boutReplayId`
  (sha256 of the canonicalized `{challenger, defender, seed, version}`, singular), so every challenger-vs-defender
  matchup is addressable (byte-identical bouts dedupe). `GET /replay?id=<bout id>` reconstructs **that** bout via
  `renderTape`; the item response also carries the parent submission's sibling `matchups` (a content hash can't derive
  its siblings, D19). The browse list stays one entry per submission, now headlined by the **King-bout** id (D14).
- **S3.2 — the replay page switches between the three matchups** (PR #408,
  `feat/pure-koth-s3-matchup-switcher`) — on `/watch/{boutId}`, `ReplayFight`'s `found` branch renders a matchup
  switcher: a `<nav aria-label="Matchups">` of the submission's sibling bouts (board order, King first) as per-bout
  permalink tabs, each the defender's identity (`ModelLogo` mark + name). The bout on screen is marked
  `aria-current="page"` plus non-colour-only cues (weight / underline / border); the others are plain `/watch/{id}`
  links. A single-matchup (or absent) list renders no switcher; loading / not-found / error states are preserved.
  `matchups` was threaded through the web contract mirror (`Matchup` + optional `matchups?`), read defensively.
- **S3.3 — `/fight` embeds per-bout ids; `/ring` board rows deep-link to their bout** (PR #409,
  `feat/pure-koth-s3-ring-deeplinks`) — a COMPETE `title.board[i]` now carries a `replayId`, computed via the shared
  `boutReplayIds` **exported from `handle-replay`** (the hashing rule + seed pairing live once, so a row's id is
  byte-for-byte the one `/replay` resolves), attached **only when competing** (a practice `projection` omits it —
  unwatchable, D12/D18); `board[0].replayId` is the headline watch target. On `/ring`, each board row after a compete
  renders a keyboard-reachable, `aria-label`-identity-labelled **"Watch"** deep-link to `/watch/<its id>`.
- **S3.4 — raise the reproduction-archive retention cap to 100, measured** (PR #410,
  `feat/pure-koth-s4-retention-cap`) — `DEFAULT_ARCHIVE_LIMIT` **50 → 100** (both the in-memory fake and the Upstash
  adapter read the one knob, so no Lua change), gated on the **D13/D20 measurement**: the full-archive `LRANGE 0 -1`
  reply is dominated by each record embedding the 3 champion docs, so at cap 100 it is ~1.4 MiB worst-case / ~0.36 MiB
  realistic — within a ~1.5 MiB ceiling for the `/replay`-only, 30s-cached read (200 rejected at 2.8 MiB). A behavior
  test pins the shipped default (a default-configured store retains exactly the newest 100); `throne-store.ts` at 100%.

[pure-koth-s3.md](pure-koth-s3.md) — the S3 plan, with the recorded measurement + the per-slice outcomes.

**Arc complete (S1–S3, the whole pure-KotH rework).** With the last story shipped, the pure-KotH design trail —
[pure-koth-decisions.md](pure-koth-decisions.md) (D1–D20) + [pure-koth-stories.md](pure-koth-stories.md) (the S1–S3
split) — was kept live in `plans/` across all three stories and is now archived here alongside the slice plans. No
pure-koth files remain in `plans/`.
