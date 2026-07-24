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
import { playbackDelta } from "../replay/transport";
import type { ReplayTape } from "../replay/replay-contract";
import type { Brand } from "../../shared/lib/brand";

// The move preview's Pixi mount — the ONE impure edge of the feature, and the only home-reachable
// module that imports Pixi. It is loaded ONLY through a dynamic import in MovePreview (never a static
// one), so the home bundle stays Pixi-free until a visitor first opens a preview. Like DojoStage it
// draws through the shared `createStage` + `scene` pipeline "what you tune is what ships"; the clock
// and the render-model wiring live ABOVE this seam in MovePreview, so this file carries only the
// renderer wiring (unit-tested at the seam in Arsenal.test; the draw layer in figures.test).

// Small enough that the stickman stays clearly visible without dominating the row (eye-tuned).
const DEFAULT_VIEWPORT: Viewport = { width: 220, height: 168 };

// The site's dark canvas background (matches the theme-color in the page shells).
const BACKGROUND = 0x0b0e14;

// The preview reads SHAPE, not authorship: both fighters wear the neutral generic head so the eye
// follows the technique rather than a brand mark.
const PREVIEW_BRANDS: readonly [Brand, Brand] = ["generic", "generic"];

// Slow the loop for legibility in the small popover — at engine rate a strike blurs past. Eye-tuned;
// no test pins it (the loop-wrap itself is asserted purely at the seam).
const PREVIEW_SPEED = 0.6;

const PreviewStage: Component<PreviewStageProps> = (props) => {
  const viewport = props.viewport ?? DEFAULT_VIEWPORT;

  let host: HTMLDivElement | undefined;
  let app: Application | undefined;
  let disposed = false;

  // The mounted stage as reactive state so the draw effect fires once it exists AND on every tick —
  // the async init means the stage isn't ready when the effect first runs.
  const [stage, setStage] = createSignal<Stage>();

  // Registered synchronously so teardown works even if the async init is still in flight.
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

    const mounted = createStage(viewport, PREVIEW_BRANDS);

    // The preview is a single looping technique, not a scored bout — the scoreboard's live tick
    // counter would only distract from the move, so it is hidden (the ring + shadows stay for
    // grounding). Eye-tuned edge; manual capture covers it.
    mounted.scoreboard.container.visible = false;

    created.stage.addChild(mounted.root);
    setStage(mounted);

    // Drive the clock above the seam. The delta is scaled here (the legibility slowdown), so
    // MovePreview receives it already in the playhead-tick units its loop-wrap works in.
    created.ticker.add((ticker) => {
      props.onTick?.(playbackDelta(ticker.deltaTime, PREVIEW_SPEED));
    });
  });

  // Draw the current playhead and hold the dim: the attacker at full strength, the passive target
  // faded. Re-runs when the stage mounts and on every clock tick.
  createEffect(() => {
    const mounted = stage();

    if (mounted) {
      mounted.a.root.alpha = props.figureAlpha.a;
      mounted.b.root.alpha = props.figureAlpha.b;
      mounted.apply(scene(props.tape, props.tick, viewport));
    }
  });

  return (
    <div
      ref={(el) => {
        host = el;
      }}
      class="move-preview-stage"
      role="img"
      aria-label="Move preview"
    />
  );
};

export default PreviewStage;

// The seam contract MovePreview drives and the spy stage stands in for. Kept beside the real mount so
// the type has one home; MovePreview and the tests import it as `import type` (erased at build), which
// is what keeps this Pixi-importing module out of the static home graph.
export type PreviewStageProps = {
  tape: ReplayTape;
  // The playhead to draw, already wrapped into [0, tape.length) by the loop clock above the seam.
  tick: number;
  // Per-figure root alpha: the attacker (a) at full strength, the passive target (b) dimmed.
  figureAlpha: { readonly a: number; readonly b: number };
  // Each ticker frame's delta (in playhead-tick units), reported up to the loop clock. Absent in
  // tests (the spy runs no ticker), which keeps the loop assertions deterministic.
  onTick?: (delta: number) => void;
  viewport?: Viewport;
};
