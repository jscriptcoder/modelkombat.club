import { describe, expect, it } from "vitest";

import { loadGauntlet } from "./gauntlet.js";
import { GAUNTLET_NAMES } from "../engine/benchmark-config.js";

describe("loadGauntlet — the frozen roster", () => {
  it("loads the six frozen gauntlet bots, in the manifest order", () => {
    // Directly exercises the loader (the `/fight` handler loads it once at module
    // scope, so only a direct call re-runs it): reads each `bots/<name>.json`
    // through the real validator gate and returns the docs named by the manifest.
    const gauntlet = loadGauntlet();

    expect(gauntlet.map((bot) => bot.name)).toEqual([...GAUNTLET_NAMES]);
  });
});
