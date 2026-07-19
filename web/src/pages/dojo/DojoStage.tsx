import {
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from "solid-js";
import { Application } from "pixi.js";

import { createStage, type Stage } from "../replay/figures";
import { scene, type Viewport } from "../replay/scene";
import type { ReplayTape } from "../replay/replay-contract";
import type { Brand } from "../../shared/lib/brand";

// The pose lab's Pixi mount: like ReplayPlayer's, it attaches an Application and draws the two
// stickmen through the pure `createStage` + `scene`. It renders whichever tick the page hands down
// and reports each ticker frame back up via `onTick` — the CLOCK STATE lives in DojoApp (above the
// injectable stage seam) so every transport transition stays assertable without a WebGL mount, while
// the impure ticker stays here at the edge. The Scene→display mapping is unit-tested in figures.test
// and the control/transport→tape wiring in DojoApp.test; here we keep only the renderer wiring.

const DEFAULT_VIEWPORT: Viewport = { width: 1200, height: 600 };

// The site's dark canvas background (matches the theme-color in the page shells).
const BACKGROUND = 0x0b0e14;

export type DojoStageProps = {
  tape: ReplayTape;
  // The playhead to draw — owned by the page, so a control edit and a transport move are the same
  // kind of change here: re-run the draw effect.
  tick: number;
  brands: readonly [Brand, Brand];
  // Each ticker frame's delta, reported up to whoever owns the clock. Absent in tests (the spy stage
  // runs no ticker), which is what keeps transport assertions deterministic.
  onTick?: (delta: number) => void;
  viewport?: Viewport;
};

const DojoStage: Component<DojoStageProps> = (props) => {
  const viewport = props.viewport ?? DEFAULT_VIEWPORT;

  let host: HTMLDivElement | undefined;
  let app: Application | undefined;
  let disposed = false;

  // The mounted stage as reactive state so the draw effect below fires once it exists AND whenever the
  // tape changes — the async init means the stage isn't ready when the effect first runs.
  const [stage, setStage] = createSignal<Stage>();

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

    // Brand is baked into the figures at creation, so a brand change remounts this component (a
    // keyed <Show> in DojoApp) to rebuild the stage; here we just read the current pair.
    const mounted = createStage(viewport, props.brands);

    created.stage.addChild(mounted.root);
    setStage(mounted);

    // Drive the page's clock. The delta is in ticks, so a technique plays at the engine's own rate.
    created.ticker.add((ticker) => {
      props.onTick?.(ticker.deltaTime);
    });
  });

  // Draw the current playhead. Re-runs when the stage mounts, when a control edit rebuilds the tape,
  // and on every transport move — the three ways the drawn frame can change.
  createEffect(() => {
    const mounted = stage();

    if (mounted) {
      mounted.apply(scene(props.tape, props.tick, viewport));
    }
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
