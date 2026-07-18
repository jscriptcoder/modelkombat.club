import { createMemo, createSignal, type Component } from "solid-js";
import { Dynamic } from "solid-js/web";

import DojoStage, { type DojoStageProps } from "./DojoStage";
import FigureControlPanel from "./FigureControlPanel";
import SpacingControl from "./SpacingControl";
import { buildDojoTape } from "./dojo-tape";
import { DEFAULT_GAP } from "./reach-presets";
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
// pose fields (free combos — no engine constraint); a shared spacing control sets the world gap
// between them (snap to a move's reach, or drag freely). Any edit rebuilds the synthetic tape and the
// stage re-poses. Opens on the challenger mid-strike vs an idle king at gyaku reach. Dark route: not
// linked from the nav, noindex, off the sitemap.

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

  const [gap, setGap] = createSignal(DEFAULT_GAP);

  const tape = createMemo(() =>
    buildDojoTape({
      a: controlsToFrame(challenger()),
      b: controlsToFrame(king()),
      gap: gap(),
    }),
  );

  return (
    <main class="dojo">
      <h1>Dojo — pose lab</h1>

      <Dynamic component={props.stage ?? DojoStage} tape={tape()} />

      <SpacingControl gap={gap()} onChange={setGap} />

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
