import { onCleanup, onMount, type Component } from "solid-js";
import { Application } from "pixi.js";

import { createStage } from "../replay/figures";
import { scene, type Viewport } from "../replay/scene";
import type { ReplayTape } from "../replay/replay-contract";

// The pose lab's Pixi mount: like ReplayPlayer's, it attaches an Application and draws the two
// stickmen through the pure `createStage` + `scene` — but with NO ticker/transport. A pose is static,
// so it renders the single tape frame once on mount. The Scene→display mapping is unit-tested in
// figures.test and the dojo tape in dojo-tape.test; here we keep only the renderer wiring.

const DEFAULT_VIEWPORT: Viewport = { width: 1200, height: 600 };

// The site's dark canvas background (matches the theme-color in the page shells).
const BACKGROUND = 0x0b0e14;

type DojoStageProps = {
  tape: ReplayTape;
  viewport?: Viewport;
};

const DojoStage: Component<DojoStageProps> = (props) => {
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

    // A pose is static: draw the single tape frame once (no clock).
    stage.apply(scene(props.tape, 0, viewport));
  });

  return (
    <div
      ref={(el) => {
        host = el;
      }}
      class="dojo-stage"
      role="img"
      aria-label="Fighters posed in the dojo ring"
    />
  );
};

export default DojoStage;
