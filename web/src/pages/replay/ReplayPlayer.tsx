import { createSignal, onCleanup, onMount, type Component } from "solid-js";
import { Application } from "pixi.js";

import { createStage } from "./figures";
import { scene, type Viewport } from "./scene";
import { advance, seek, startTransport, togglePlaying } from "./transport";
import type { ReplayItem } from "./replay-contract";

// The live viewer: mounts a Pixi Application, draws the two stickmen + HUD via the pure `createStage`
// + `scene`, and runs the pure `transport` clock over the fight's tape. This is the impure edge
// (renderer + ticker) — the Scene→display mapping is unit-tested in figures.test and the clock's
// transitions in transport.test, so here we keep only the wiring plus the DOM playback controls.

const DEFAULT_VIEWPORT: Viewport = { width: 1200, height: 600 };

// The site's dark canvas background (matches the theme-color in the page shells).
const BACKGROUND = 0x0b0e14;

type ReplayPlayerProps = {
  item: ReplayItem;
  viewport?: Viewport;
};

const ReplayPlayer: Component<ReplayPlayerProps> = (props) => {
  const viewport = props.viewport ?? DEFAULT_VIEWPORT;

  // The fight is fixed for this mount, so read its tape facts once. `lastTick` is the scrub bar's
  // range (index space); `finalTick` is the engine tick at the end — the "M" in the tick N / M
  // readout, sourced from the tape exactly like the HUD so the two always agree.
  const tape = props.item.tape;
  const lastTick = tape.length - 1;
  const finalTick = tape[lastTick].tick;

  // The playback clock (pure transport model) as reactive state: the Pixi ticker advances it each
  // frame, the controls pause/resume/seek/restart it, and the play/pause label tracks `playing`.
  const [transport, setTransport] = createSignal(startTransport());

  // The tape index the playhead lands on (what the renderer draws + the scrub bar's position), and
  // the engine tick number there — the same value the canvas HUD prints (see `scene`).
  const tickIndex = () => Math.round(transport().playhead);
  const currentTick = () => tape[tickIndex()].tick;

  let host: HTMLDivElement | undefined;
  let app: Application | undefined;
  let disposed = false;

  // Registered synchronously so teardown works even if the async init below is still in flight.
  onCleanup(() => {
    disposed = true;
    app?.destroy(true, { children: true });
  });

  onMount(async () => {
    const created = new Application();

    await created.init({
      width: viewport.width,
      height: viewport.height,
      background: BACKGROUND,
      antialias: true,
    });

    // The component may have unmounted during the async init — drop the orphaned renderer.
    if (disposed || host === undefined) {
      created.destroy(true, { children: true });

      return;
    }

    app = created;
    host.appendChild(created.canvas);

    const stage = createStage(viewport);

    created.stage.addChild(stage.root);

    stage.apply(scene(tape, 0, viewport));

    // Advance the clock ~one engine tick per rendered frame while playing (a paused clock is
    // unchanged), then draw the frame the playhead lands on. Reading the signal each frame picks up
    // pause / restart from the controls; a restart resets the playhead and the next frame draws it.
    created.ticker.add((ticker) => {
      const next = advance(transport(), ticker.deltaTime, lastTick);

      setTransport(next);
      stage.apply(scene(tape, Math.round(next.playhead), viewport));
    });
  });

  return (
    <div class="replay-player">
      <div
        ref={(el) => {
          host = el;
        }}
        class="replay-stage"
        role="img"
        aria-label="Fight playback"
      />

      <div class="replay-controls">
        <button
          type="button"
          class="replay-control"
          onClick={() => setTransport(togglePlaying)}
        >
          {transport().playing ? "Pause" : "Play"}
        </button>

        <input
          type="range"
          class="replay-scrub"
          min={0}
          max={lastTick}
          step={1}
          value={tickIndex()}
          aria-label="Scrub to tick"
          aria-valuetext={`tick ${currentTick()} of ${finalTick}`}
          onInput={(e) =>
            setTransport(
              seek(transport(), e.currentTarget.valueAsNumber, lastTick),
            )
          }
        />

        <span class="replay-readout">
          tick {currentTick()} / {finalTick}
        </span>

        <button
          type="button"
          class="replay-control"
          onClick={() => setTransport(startTransport())}
        >
          Restart
        </button>
      </div>
    </div>
  );
};

export default ReplayPlayer;
