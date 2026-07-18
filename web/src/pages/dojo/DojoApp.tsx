import type { Component } from "solid-js";

import DojoStage from "./DojoStage";
import {
  buildDojoTape,
  DEFAULT_CHALLENGER,
  DEFAULT_GAP,
  DEFAULT_KING,
} from "./dojo-tape";

// The pose-lab page (/dojo): a dark developer route that renders two fighters through the real replay
// pipeline so the pose model can be tuned in isolation. Slice 1 shows the default first-load scene —
// the challenger mid-strike vs an idle king at gyaku reach; controls (re-pose · gap) come in later
// slices. Not linked from the nav, noindex, absent from the sitemap.
const DojoApp: Component = () => {
  const tape = buildDojoTape({
    a: DEFAULT_CHALLENGER,
    b: DEFAULT_KING,
    gap: DEFAULT_GAP,
  });

  return (
    <main class="dojo">
      <h1>Dojo — pose lab</h1>
      <DojoStage tape={tape} />
    </main>
  );
};

export default DojoApp;
