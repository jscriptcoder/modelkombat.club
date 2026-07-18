import { createMemo, createSignal, Show, type Component } from "solid-js";
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
import { type Brand } from "../../shared/lib/brand";
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

  // Each fighter's authoring brand (its head glyph), the M10 opening identities. Separate from the
  // pose signals — identity rides the item, not the render frame.
  const [challengerBrand, setChallengerBrand] = createSignal<Brand>("claude");

  const [kingBrand, setKingBrand] = createSignal<Brand>("generic");

  const tape = createMemo(() =>
    buildDojoTape({
      a: controlsToFrame(challenger()),
      b: controlsToFrame(king()),
      gap: gap(),
    }),
  );

  // `createStage` bakes the brand into each figure at creation, so a brand change must rebuild the
  // stage. A keyed <Show> on this string remounts the Pixi mount when either brand changes, while a
  // pose/gap edit (key unchanged) keeps the mount and just re-applies the tape.
  const brandKey = () => `${challengerBrand()}|${kingBrand()}`;

  const brandPair = (): [Brand, Brand] => [challengerBrand(), kingBrand()];

  return (
    <main class="dojo">
      <h1>Dojo — pose lab</h1>

      <Show when={brandKey()} keyed>
        <Dynamic
          component={props.stage ?? DojoStage}
          tape={tape()}
          brands={brandPair()}
        />
      </Show>

      <SpacingControl gap={gap()} onChange={setGap} />

      <div class="dojo-controls">
        <FigureControlPanel
          label="Challenger"
          controls={challenger()}
          onChange={setChallenger}
          brand={challengerBrand()}
          onBrandChange={setChallengerBrand}
        />
        <FigureControlPanel
          label="King"
          controls={king()}
          onChange={setKing}
          brand={kingBrand()}
          onBrandChange={setKingBrand}
        />
      </div>
    </main>
  );
};

export default DojoApp;
