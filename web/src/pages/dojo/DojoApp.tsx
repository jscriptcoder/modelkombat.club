import { createMemo, createSignal, type Component } from "solid-js";
import { Dynamic } from "solid-js/web";

import DojoStage, { type DojoStageProps } from "./DojoStage";
import FigureControlPanel from "./FigureControlPanel";
import { buildDojoTape, DEFAULT_GAP } from "./dojo-tape";
import {
  controlsToFrame,
  DEFAULT_CHALLENGER_CONTROLS,
  DEFAULT_KING_CONTROLS,
  type FigureControls,
} from "./controls";
import "../../shared/app.css";
import "./dojo.css";

// The pose-lab page (/dojo): a dark developer route that renders two fighters through the real replay
// pipeline so the pose model can be tuned in isolation. Each fighter has a control panel over its raw
// pose fields (free combos — no engine constraint); an edit rebuilds the synthetic tape and the stage
// re-poses that figure. Opens on the challenger mid-strike vs an idle king at gyaku reach. The gap is
// fixed here (Slice 3 adds the reach-preset slider). Not linked from the nav, noindex, off the sitemap.

type DojoAppProps = {
  // The Pixi render sink — the impure edge. Injectable so tests assert the control→tape wiring without
  // a real WebGL mount (the pose maths lives in controls.test / dojo-tape.test / figures.test);
  // production uses the default DojoStage.
  stage?: Component<DojoStageProps>;
};

const DojoApp: Component<DojoAppProps> = (props) => {
  const [challenger, setChallenger] = createSignal<FigureControls>(
    DEFAULT_CHALLENGER_CONTROLS,
  );

  const [king, setKing] = createSignal<FigureControls>(DEFAULT_KING_CONTROLS);

  const tape = createMemo(() =>
    buildDojoTape({
      a: controlsToFrame(challenger()),
      b: controlsToFrame(king()),
      gap: DEFAULT_GAP,
    }),
  );

  return (
    <main class="dojo">
      <h1>Dojo — pose lab</h1>

      <Dynamic component={props.stage ?? DojoStage} tape={tape()} />

      <div class="dojo-controls">
        <FigureControlPanel
          label="Challenger"
          controls={challenger()}
          onChange={setChallenger}
        />
        <FigureControlPanel label="King" controls={king()} onChange={setKing} />
      </div>
    </main>
  );
};

export default DojoApp;
