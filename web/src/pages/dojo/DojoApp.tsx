import { createMemo, createSignal, Show, type Component } from "solid-js";
import { Dynamic } from "solid-js/web";

import DojoStage, { type DojoStageProps } from "./DojoStage";
import FigureControlPanel from "./FigureControlPanel";
import SpacingControl from "./SpacingControl";
import { buildDojoTape } from "./dojo-tape";
import { DEFAULT_GAP } from "./reach-presets";
import {
  advance,
  seek,
  startTransport,
  step,
  togglePlaying,
} from "../replay/transport";
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

  // The playback clock (the pure transport model) as page state, so the controls below are assertable
  // without a WebGL mount; the Pixi ticker only feeds `onTick` into it. Opens PLAYING — the lab's job
  // is to show a technique as a movement — and any manual control pauses it for tuning.
  const [transport, setTransport] = createSignal(startTransport());

  const lastTick = () => tape().length - 1;

  // Clamped on read, so shortening the tape under the playhead (selecting a faster move, or dialing a
  // fighter idle) can never leave it pointing off the end.
  const tick = () => Math.min(Math.round(transport().playhead), lastTick());

  return (
    <main class="dojo">
      <h1>Dojo — pose lab</h1>

      <Show when={brandKey()} keyed>
        <Dynamic
          component={props.stage ?? DojoStage}
          tape={tape()}
          tick={tick()}
          brands={brandPair()}
          onTick={(delta: number) =>
            setTransport((t) => advance(t, delta, lastTick()))
          }
        />
      </Show>

      <div class="dojo-transport" role="group" aria-label="Technique playback">
        <button
          type="button"
          class="control-segment"
          onClick={() => setTransport(togglePlaying)}
        >
          {transport().playing ? "Pause" : "Play"}
        </button>

        <button
          type="button"
          class="control-segment"
          aria-label="Step back one tick"
          onClick={() => setTransport(step(transport(), -1, lastTick()))}
        >
          ◀
        </button>

        <button
          type="button"
          class="control-segment"
          aria-label="Step forward one tick"
          onClick={() => setTransport(step(transport(), 1, lastTick()))}
        >
          ▶
        </button>

        <input
          type="range"
          class="dojo-scrub"
          min={0}
          max={lastTick()}
          step={1}
          value={tick()}
          aria-label="Scrub to tick"
          onInput={(e) =>
            setTransport(
              seek(transport(), e.currentTarget.valueAsNumber, lastTick()),
            )
          }
        />

        <span class="dojo-tick-readout">
          tick {tick()} / {lastTick()}
        </span>
      </div>

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
