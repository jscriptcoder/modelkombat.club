import { onCleanup, onMount, type Component } from "solid-js";
import { Application } from "pixi.js";

import { createStage } from "./figures";
import { scene, type Viewport } from "./scene";
import type { ReplayItem } from "./replay-contract";

// The live viewer: mounts a Pixi Application, draws the two stickmen + HUD via the pure `createStage`
// + `scene`, and runs an autoplay clock over the fight's tape. This is the impure edge (renderer +
// ticker) — its Scene→display mapping is unit-tested in figures.test, so here we keep only the wiring.

const DEFAULT_VIEWPORT: Viewport = { width: 1200, height: 600 };

// The site's dark canvas background (matches the theme-color in the page shells).
const BACKGROUND = 0x0b0e14;

type ReplayPlayerProps = {
  item: ReplayItem;
  viewport?: Viewport;
};

const ReplayPlayer: Component<ReplayPlayerProps> = (props) => {
  const viewport = props.viewport ?? DEFAULT_VIEWPORT;

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

    const tape = props.item.tape;
    const lastTick = tape.length - 1;
    let playhead = 0;

    stage.apply(scene(tape, 0, viewport));

    // Autoplay: advance the playhead ~one engine tick per rendered frame (tickRate 60 ≈ 60fps ⇒
    // roughly real time), stopping at the final tick. Controls (pause / restart) arrive in S3b.
    created.ticker.add((ticker) => {
      if (playhead >= lastTick) {
        return;
      }

      playhead = Math.min(lastTick, playhead + ticker.deltaTime);
      stage.apply(scene(tape, Math.round(playhead), viewport));
    });
  });

  return (
    <div
      ref={(el) => {
        host = el;
      }}
      class="replay-stage"
      role="img"
      aria-label="Fight playback"
    />
  );
};

export default ReplayPlayer;
