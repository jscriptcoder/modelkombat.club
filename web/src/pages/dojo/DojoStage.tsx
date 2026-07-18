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

// The pose lab's Pixi mount: like ReplayPlayer's, it attaches an Application and draws the two
// stickmen through the pure `createStage` + `scene` — but with NO ticker/transport. A pose is static,
// so it renders tick 0; when a control edit rebuilds the tape (props.tape), the effect re-applies the
// shipped projection. The Scene→display mapping is unit-tested in figures.test and the control→tape
// wiring in DojoApp.test; here we keep only the renderer wiring.

const DEFAULT_VIEWPORT: Viewport = { width: 1200, height: 600 };

// The site's dark canvas background (matches the theme-color in the page shells).
const BACKGROUND = 0x0b0e14;

export type DojoStageProps = {
  tape: ReplayTape;
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

    // A default brand pair (challenger Claude vs a generic king — the M10 opening identities) so the
    // pose lab shows real glyph heads; the interactive per-figure brand picker arrives in Slice 3.
    const mounted = createStage(viewport, ["claude", "generic"]);

    created.stage.addChild(mounted.root);
    setStage(mounted);
  });

  // Draw tick 0 of the current pose. Re-runs when the stage mounts and whenever a control edit rebuilds
  // the tape — no clock, since a pose is static (unlike the /watch player's ticker-driven playback).
  createEffect(() => {
    const mounted = stage();

    if (mounted) {
      mounted.apply(scene(props.tape, 0, viewport));
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
