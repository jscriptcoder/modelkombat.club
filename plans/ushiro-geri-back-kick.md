# Plan: `ushiro-geri` (back kick) — Batch-1 move #4

**Branch**: feat/ushiro-geri-back-kick (Slice 1) · feat/ushiro-geri-rule-readers (Slice 2)
**Status**: Active
**Design source**: `docs/move-roster.md` (Batch-1 resolved frame data; balance law + policies)

## Goal

The bot can throw `ushiro-geri` (back kick) — the **reach apex and highest-commitment kick of the
arsenal**: `reach 330000` is now the **longest in the game** (past `yoko-geri` 315000 and `startGap`
300000), and it is the expansion's **first jodan-ippon _kick_** — `scoreByBand {high: 3}` scores **3**
(_ippon_) at head height, **2** (_waza-ari_) at chudan. It pays with the **slowest startup** (13), the
**longest recovery** (22), and the **highest cost** (52, gas-locked) in the whole roster — the
turn-away back kick is the most telegraphed and punishable commit there is. Wired into
`CANONICAL_RULES` and taught in `spec.md`.

## Context — why this is small and additive (the `yoko-geri` pattern + `mawashi-geri` precedent)

Post-C9 the arsenal is canonical and the `sim.ts` resolver is fully **generic**
(`rules.moves[action.move]` + `bandLegal` + `affordable` + `spec !== undefined`), so a new move is
**pure data + allowlist**, no resolver code — exactly as `uraken` (#1), `shuto` (#2), and `yoko-geri`
(#3) shipped. Every path `ushiro-geri` exercises is already-proven engine mechanics driven by new
data; unlike `yoko-geri` it introduces **zero** new engine paths — every one has a direct baseline
precedent:

- **Score-2 (_waza-ari_) at chudan** — `computeStrike` awards `spec.score`; `yoko-geri`/`mae-geri`/
  `mawashi-geri` already prove a 2-point chudan kick.
- **Jodan _ippon_ via `scoreByBand {high: 3}`** — `computeStrike` already reads `spec.scoreByBand[band]`
  in preference to `spec.score`; **`mawashi-geri` is the exact precedent** (score 2 chudan / 3 jodan).
  `ushiro-geri` is the expansion's **first `scoreByBand` move** and its **first jodan-ippon kick** —
  but the mechanic is unchanged, only the data is new.
- **Gas-LOCKED (`staminaCost 52 > gasThreshold 30`)** — the `affordable` gate already locks out
  specials when gassed (kicks 35–48, throw/sweep 40). `ushiro-geri` 52 is simply the priciest yet.
  (Behavioural precedent: the `DRAIN_THEN_THROW` / `DRAIN_THEN_YOKO` bots in `rules.test.ts`.)
- **`high·mid` band gate** — `bandLegal` admits only the listed band(s); `mawashi-geri`/`shuto`
  already prove the high·mid case. `ushiro-geri` whiffs only `low`.
- **Cancel TARGET, not just source** — `ushiro-geri`'s `cancelInto:["gyaku-zuki"]` makes it a rekka
  source (kick → reverse finisher, situational at ≤240k, identical to the other kicks). As with
  `yoko-geri`, it is **also a cancel target** — `gyaku-zuki.cancelInto` **grows** to include
  `ushiro-geri` (the "reverse → any kick" category policy). The growth is pure data (spatially valid
  — the kick out-reaches the punch).

**The signature trait — the reach apex + the ippon back kick.** Reach ladder around `ushiro-geri`:
`mawashi-geri` 300k = `startGap` 300k < `yoko-geri` 315k < **`ushiro-geri` 330k**. It is now the
single longest technique in the game, and the only long-range kick that can also score the jodan
_ippon_. Its no-Pareto trade made concrete: it pushes **reach up** (330 > 315) **and** carries the
jodan bonus (like the roundhouse), paying with the slowest **startup** (13 > everything), the longest
**recovery** (22 > everything), and the highest **cost** (52 > everything). Dominance-free vs both
`yoko-geri` (out-commits it on every tempo/cost axis for +15k reach and the ippon) and `mawashi-geri`
(same jodan bonus but +30k reach traded for slower/costlier/longer-recovery).

**Canonical `ushiro-geri` spec** (from `docs/move-roster.md`):

```ts
"ushiro-geri": { startup: 13, active: 3, recovery: 22, score: 2,
                 scoreByBand: { high: 3 }, reach: 330000,
                 bands: ["high", "mid"], staminaCost: 52,
                 cancelInto: ["gyaku-zuki"] }
```

Plus the grown edge on the **existing** reverse punch:

```ts
"gyaku-zuki": { …, cancelInto: ["mae-geri", "mawashi-geri", "yoko-geri", "ushiro-geri"] } // + the new kick
```

`spec.md` is **generated** (`npm run gen:spec`): the move table row, the JSON-schema `move` enum
(`[...MOVES]`), and — in Slice 2 — the `rule(path)` list all derive from `MOVES`, `CANONICAL_RULES`,
and the field-readers. No hand-editing of `spec.md`.

## Benchmark impact (the `yoko-geri` finding, restated)

Wiring `ushiro-geri` into `CANONICAL_RULES` (the new spec **and** the grown `gyaku-zuki.cancelInto`,
both scoring inputs) flips the benchmark `INPUT_HASH` ⇒ **Slice 1 bumps `BENCHMARK_VERSION` v7 → v8**
(recompute `INPUT_HASH`, update the guard + version-assertion tests in `benchmark-config.test.ts`).
**Slice 2 adds no `CANONICAL_RULES` field** (readers only) ⇒ `INPUT_HASH` stable ⇒ **no bump**. The 6
frozen gauntlet bots don't reference `ushiro-geri`, so their round-robin outcomes stay byte-identical
under v8 (no gauntlet re-characterization).

## Acceptance Criteria

Behaviour proven by `runFight` against `CANONICAL_RULES` (engine), `validate` (TCB), and the
`gen-spec` / schema drift tests (spec). Observable score/accept assertions, not literals alone.

- [ ] **AC-1 (waza-ari — mid):** a clean `mid` `ushiro-geri` within reach scores **2** (chudan
      _waza-ari_ — the base `spec.score`).
- [ ] **AC-2 (jodan ippon — the signature `scoreByBand`):** a clean `high` `ushiro-geri` within reach
      scores **3** (_ippon_ via `scoreByBand {high: 3}` — the expansion's first jodan-scoring kick,
      mirroring `mawashi-geri`), and at `band:"low"` degrades to idle ⇒ **0** (high·mid gate). Property:
      `ushiro-geri.scoreByBand.high === 3 > ushiro-geri.score`.
- [ ] **AC-3 (reach apex — the new game-longest):** at a gap between `yoko-geri` (315k) and
      `ushiro-geri` (330k) — e.g. `startGap 320000` — `ushiro-geri` (mid) scores **2** where
      `yoko-geri` (315k) whiffs to **0** (documents `ushiro-geri.reach > yoko-geri.reach` **and**
      `> startGap` — the first move connecting where even the prior apex whiffs).
- [ ] **AC-4 (gas-LOCKED — the priciest move):** a **gassed** fighter (`stamina ≤ gasThreshold 30`)
      can **no longer** commit `ushiro-geri` — the commit degrades to idle ⇒ **0** (its cost 52 > 30).
      Property: `ushiro-geri.staminaCost > gasThreshold` and `> yoko-geri.staminaCost` (the new max).
- [ ] **AC-5 (kick → reverse finisher):** an `ushiro-geri` that connects opens the cancel window; a
      `gyaku-zuki` started within it hit-confirms (kick → reverse, the unchanged category policy;
      situational — the 240k reverse only reaches when the kick landed within its reach).
- [ ] **AC-6 (reverse → back kick — the cancel graph GROWS):** a connecting `gyaku-zuki` cancels
      **into** `ushiro-geri` (the "reverse → any kick" policy now includes the new kick — the grown
      `gyaku-zuki.cancelInto` edge, spatially valid since the kick out-reaches the punch).
- [ ] **AC-7 (TCB allowlist):** `validate` accepts `{type:"attack", move:"ushiro-geri", band:"high"}`
      and `band:"mid"` **and** accepts it out-of-band (`band:"low"`) — band-legality is a runtime
      concern; the validator only checks the move id + band are well-formed.
- [ ] **AC-8 (spec teaches the move + bands + jodan bonus):** regenerated `spec.md` lists
      `ushiro-geri` in the attack-move line, the move-stats table (with `bands: high·mid` and the
      `scoreByBand` jodan call-out), and the JSON-schema `move` enum; `gen-spec` + schema drift tests
      stay green; `BENCHMARK_VERSION` v7 → v8.
- [ ] **AC-9 (rule-path accepted):** `validate` accepts a bot using `rule("moves.ushiro-geri.reach")`
      (and the other **6** paths, including `moves.ushiro-geri.scoreByBand.high` — the 7th, mirroring
      `mawashi-geri`); an unknown `moves.ushiro-geri.bands` path is **rejected**. _(Slice 2)_
- [ ] **AC-10 (reader returns the value):** the interpreter resolves `rule("moves.ushiro-geri.reach")`
      to **330000**, `rule("moves.ushiro-geri.staminaCost")` to **52**, `rule("moves.ushiro-geri.score")`
      to **2**, and `rule("moves.ushiro-geri.scoreByBand.high")` to **3** against `CANONICAL_RULES`.
      _(Slice 2)_
- [ ] **AC-11 (spec lists the paths):** regenerated `spec.md` lists the seven `moves.ushiro-geri.*`
      rule paths + the `rulePath` schema enum; drift tests green. _(Slice 2)_

**Deferred (NOT this feature):** the roster-wide no-Pareto-dominance property test (add once more of
Batch-1 lands, per `docs/move-roster.md`); the `vulture`/`sweeper` gauntlet rebalance (a separate
capability, folded into a family-level re-run once the kicks land).

## Slices

One slice = one PR. Each follows RED-GREEN-MUTATE-KILL MUTANTS-REFACTOR. Load the project CLAUDE.md +
`tdd`/`testing`/`mutation-testing`/`refactoring` before any code.

### Slice 1: Bot can throw `ushiro-geri` — the canonical reach-apex, jodan-ippon, gas-locked kick

**Value**: The bot author gets the game's longest-reach kick, and the first long-range kick that also
scores the jodan _ippon_ (3) — trading the slowest tempo, longest recovery, and highest cost in the
roster for that reach + point ceiling. The most committed, most punishable attack in the game.
**Actor / Trigger / Outcome**: bot author / `{type:"attack", move:"ushiro-geri", band}` / the fight
scores **3** on a clean `high` hit in reach, **2** on a clean `mid` hit, **0** at `low` (out-of-band),
at a gap where `yoko-geri` whiffs but `ushiro-geri` reaches, and when gassed; it cancels into
`gyaku-zuki` and the reverse now cancels into it.
**Path**: bot DSL `attack` → `dsl.ts` validate (`MOVES` admits `ushiro-geri`) → `sim.ts` `intake`
reads `rules.moves["ushiro-geri"]` → existing `bandLegal` + `affordable` (gas-lock) + `spec !==
undefined` gates → `startAttack` → existing `computeStrike`/`applyStrike` (`points: spec.scoreByBand
[band] ?? spec.score`) + cancel window (both directions) → `result.scores`. **No new resolver code.**
**Production edits**:

1. `types.ts` — `MoveId` union `+ "ushiro-geri"`; `Rules.moves` optional `"ushiro-geri"?: MoveSpec`
   (type-only ⇒ no runtime mutants).
2. `dsl.ts` (TCB) — `"ushiro-geri"` into the `MOVES` allowlist (the one mutable line).
3. `rules.ts` — **two** edits to `CANONICAL_RULES.moves`: (a) the canonical `ushiro-geri` `MoveSpec`
   above (note `scoreByBand: { high: 3 }`, mirroring `mawashi-geri`); (b) extend `gyaku-zuki.cancelInto`
   with `"ushiro-geri"` (the grown "reverse → any kick" edge).
4. `benchmark-config.ts` — `BENCHMARK_VERSION` v7 → v8; recompute `INPUT_HASH`.
5. `docs/spec.md` — `npm run gen:spec` (auto: move line, stats table row, JSON-schema `move` enum,
   embedded version/hash). The data-driven drift tests pin these.

**Required implementation skills**: before code, load `tdd`, `testing`, `mutation-testing`,
`refactoring`.
**Acceptance criteria**: AC-1 … AC-8. **Present to human and confirm before code.**
**RED** — failing tests first, mirroring the `mawashi-geri`/`yoko-geri` behavioural block in
`rules.test.ts`, the validator-accept tests in `validate-bot.test.ts`, and the drift/version tests in
`gen-spec.test.ts` / `spec-schema.test.ts` / `benchmark-config.test.ts`:

- `rules.test.ts` (runFight vs `CANONICAL_RULES`): AC-1 (`mid` in reach ⇒ 2), AC-2 (`high` in reach ⇒
  **3** via scoreByBand — mirror the `mawashi-geri` jodan test; `low` ⇒ 0; assert `scoreByBand.high ===
3 > score`), AC-3 (gap 320000 where `yoko-geri` whiffs but `ushiro-geri` lands ⇒ ushiro 2 / yoko 0;
  assert `ushiro-geri.reach > yoko-geri.reach` and `> 300000`), AC-4 (gassed fighter degrades ⇒ 0;
  assert `ushiro-geri.staminaCost > gasThreshold` and `> yoko-geri.staminaCost` — mirror
  `DRAIN_THEN_YOKO`), AC-5 (ushiro→`gyaku-zuki` cancel hit-confirms), AC-6 (`gyaku-zuki`→ushiro cancel
  hit-confirms — the grown edge).
- `validate-bot.test.ts`: AC-7 (accept `high`; accept `mid`; accept out-of-band `low`).
- `benchmark-config.test.ts`: AC-8 version guard — bump the version-assertion test to `v8` and re-pin
  `INPUT_HASH` (the guard goes RED on the `CANONICAL_RULES` change — the new spec **and** the grown
  cancelInto — until re-pinned; paste the printed hash).
- `gen-spec.test.ts` / `spec-schema.test.ts`: AC-8 drift — regenerated `spec.md` contains the
  `ushiro-geri` row + `move`-enum entry; drift green after regen.

Mutator-awareness: the mutable production lines are the `MOVES` string literal (AC-7 kills
`"ushiro-geri" → ""`), the new `ushiro-geri` spec (AC-1's `=== 2` pins base score, AC-2's `=== 3` pins
`scoreByBand.high` — kills dropping/altering the jodan bonus, AC-4's `> gasThreshold` pins cost, AC-3
pins `reach > yoko-geri`/`> startGap` — kills a reach narrowing to ≤ 315k, AC-2's `low ⇒ 0` pins the
`bands` — kills a widening to include `low`), and the grown `gyaku-zuki.cancelInto` array (AC-6 kills
removing `"ushiro-geri"`).
**GREEN**: the five additive edits above; nothing in `sim.ts`.
**MUTATE**: scope Stryker to `dsl.ts` (`MOVES`) + `rules.ts` (the new spec object **and** the grown
`gyaku-zuki.cancelInto`) + `benchmark-config.ts` (version/hash). `rm -rf .stryker-tmp` first. Confirm
100% on the changed lines.
**KILL MUTANTS**: strengthen only if a survivor appears; ask the human if a survivor's value is ambiguous.
**REFACTOR**: none expected (additive mirror of the arsenal pattern); assess via `refactoring`, skip if
no value.
**Done when**: AC-1…AC-8 green; full suite green (byte-identical for all non-`ushiro-geri` paths);
`dsl.ts`/`rules.ts`/`benchmark-config.ts` mutation 100%; typecheck + lint + format clean; mutation
report reviewed; human approves commit.

### Slice 2: Bots can introspect `ushiro-geri`'s frames via `rule("moves.ushiro-geri.*")`

**Value**: The bot author can read `ushiro-geri`'s frames at runtime to write adaptive logic (e.g.
gate on `rule("moves.ushiro-geri.reach")` to open at max spacing, or on
`rule("moves.ushiro-geri.scoreByBand.high")` to prefer the ippon read), the same as every other move.
**Actor / Trigger / Outcome**: bot author / a bot document using `{op:"rule",
path:"moves.ushiro-geri.reach"}` / `validate` accepts it and the interpreter returns the canonical
value (330000).
**Path**: bot DSL `rule(path)` → `dsl.ts` `ALLOWED_RULES` (derived from the field-readers) admits the
path → interpreter reads `CANONICAL_RULES.moves["ushiro-geri"].<field>`.
**Production edits**:

1. `dsl.ts` (TCB) — **7** field-readers `moves.ushiro-geri.{startup,active,recovery,score,reach,
staminaCost}` **plus `moves.ushiro-geri.scoreByBand.high`** in `RULE_READERS` (mirror the
   `mawashi-geri` readers — it is the only baseline with the 7th `scoreByBand.high` reader; `?.`/`?? 0`
   for the optional key), which flow into `ALLOWED_RULES` / `RulePath`.
2. `docs/spec.md` — `npm run gen:spec` (auto: the `moves.ushiro-geri.*` rule-path list + the `rulePath`
   enum). The data-driven drift tests pin these. **No `CANONICAL_RULES` change ⇒ no version bump.**

**Required implementation skills**: `tdd`, `testing`, `mutation-testing`, `refactoring`.
**Acceptance criteria**: AC-9 … AC-11. **Present and confirm before code.**
**RED**: `validate-bot.test.ts` — AC-9 (add the 7 `moves.ushiro-geri.*` paths to the accept table,
including `scoreByBand.high`; add `moves.ushiro-geri.bands` to the reject table); `interpret-tick.test.ts`
— AC-10 (7 reader-value rows: canonical `13/3/22/2/330000/52` + `scoreByBand.high 3`, minimal-sentinel
`0`; mutually distinct ⇒ wrong-field read caught); `gen-spec.test.ts` / `spec-schema.test.ts` — AC-11
(data-driven drift goes RED on the reader add, green after regen).
**GREEN**: the 7 readers + regen.
**MUTATE**: scope Stryker to the new `dsl.ts` reader lines; expect path-string + `?? 0` mutants,
killed by AC-9/AC-10. Confirm `dsl.ts` 100%.
**KILL MUTANTS / REFACTOR**: as Slice 1 (none expected).
**Done when**: AC-9…AC-11 green; full suite green; `dsl.ts` mutation 100%; typecheck + lint + format
clean; report reviewed; human approves commit.

> **Slice-count note:** Slices 1 + 2 MAY be merged into a single "fully-wired `ushiro-geri`" PR, but
> the recommended path keeps them split, as `uraken` (#117/#118), `shuto` (#120/#121), and `yoko-geri`
> (#123/#124) shipped — each is independently deployable and reviewable. **Your call.**

## Pre-PR Quality Gate

Before each PR:

1. Mutation testing — `mutation-testing` skill, scoped to the changed `dsl.ts` / `rules.ts` /
   `benchmark-config.ts` lines (`types.ts` is type-only; `sim.ts` untouched). `rm -rf .stryker-tmp` first.
2. Refactoring assessment — `refactoring` skill (expected: no change).
3. `npm run typecheck` + `npm run lint` + `npm run format:check` pass; `spec.md` regenerated and drift-clean.
4. On feature completion: update `docs/move-roster.md` (mark `ushiro-geri` shipped, PR #) and
   `docs/STATUS.md`; the family-level `vulture`/`sweeper` gauntlet re-run stays deferred until the
   Batch-1 kick family lands.

---

_When both slices are merged, **archive** this file under `docs/archive/` (add a README index entry
under the existing "Batch-1 arsenal expansion" section) — **do not delete it**. The record also lives
in the PRs + `docs/move-roster.md`._
