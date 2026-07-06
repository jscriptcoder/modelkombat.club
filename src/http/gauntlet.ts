/// <reference types="node" />
// Loads the frozen gauntlet — the 6 archetype bots at the current BENCHMARK_VERSION
// — the same roster + files the CLI runner (`src/cli/benchmark.ts`) uses, through
// the same validator gate. One source of truth (decisions §"gauntlet IS the frozen
// benchmark"): the manifest names the roster, `bots/<name>.json` holds the docs.
//
// The `../../bots/<name>.json` read resolves to the repo-root `bots/` from this
// module (one level under `src/`), matching `gen-spec.ts`'s proven-on-Vercel
// pattern. The serverless bundle needs `functions["api/fight.ts"].includeFiles:
// "bots/*.json"` in `vercel.json` (templated reads are untraced by the bundler).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadBotDoc } from "../cli/load.js";
import { GAUNTLET_NAMES } from "../engine/benchmark-config.js";
import type { BotDoc } from "../engine/dsl.js";

const botPath = (name: string): string =>
  fileURLToPath(new URL(`../../bots/${name}.json`, import.meta.url));

export const loadGauntlet = (): BotDoc[] =>
  GAUNTLET_NAMES.map((name) => loadBotDoc(readFileSync(botPath(name), "utf8")));
