import {
  createMemo,
  createSignal,
  Show,
  type Component,
  type Setter,
} from "solid-js";
import { Dynamic } from "solid-js/web";

import DojoStage, { type DojoStageProps } from "./DojoStage";
import FigureControlPanel from "./FigureControlPanel";
import SpacingControl from "./SpacingControl";
import { buildDojoTape } from "./dojo-tape";
import { DEFAULT_GAP, presetFor } from "./reach-presets";
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
  selectMove,
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

  // Commit a figure to a technique: stamp its controls (controls.ts owns what that means), snap the
  // pair to the distance the engine would fight it at, then restart playback — a selection means
  // "show me this technique", and without the restart the new move would open parked on its final
  // recovery frame.
  //
  // The gap is SHARED but the pickers are per-figure, so the two genuinely compete for it:
  // last-write-wins (decision 6), i.e. the move just picked is the one being looked at. Standing a
  // figure down leaves the gap where it was — idle has no reach, and snapping to 0 would collapse
  // the fighters into each other.
  const commitMove = (setFigure: Setter<FigureControls>) => (move: string) => {
    const preset = presetFor(move);

    setFigure((prev) => selectMove(prev, move));

    if (preset !== undefined) setGap(preset.reach);

    setTransport(startTransport());
  };

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
        {/* Playback auto-pauses on the final tick, so the lab settles on a recovery frame. Restart
            is the way back to the movement: `startTransport()` IS the restart target (tick 0,
            resumed), so this reuses it rather than seeking — a seek would pause. */}
        <button
          type="button"
          class="control-segment"
          onClick={() => setTransport(startTransport())}
        >
          Restart
        </button>

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
          onSelectMove={commitMove(setChallenger)}
        />
        <FigureControlPanel
          label="King"
          controls={king()}
          onChange={setKing}
          brand={kingBrand()}
          onBrandChange={setKingBrand}
          onSelectMove={commitMove(setKing)}
        />
      </div>
    </main>
  );
};

export default DojoApp;
