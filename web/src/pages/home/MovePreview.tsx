import {
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  Show,
  type Component,
  type JSX,
} from "solid-js";
import { Dynamic, Portal } from "solid-js/web";

import { contactFrame, loopIndex, moveLoopTape } from "./move-preview";
import type { PreviewStageProps } from "./PreviewStage";

// The move preview's popover + loop clock — everything ABOVE the Pixi seam. When a move is open it
// portals a small dialog, lazily loads the Pixi renderer the FIRST time (kept afterward, so only one
// Application ever exists), and drives a seamless LOOP clock: the ticker delta accumulates into a
// playhead that `loopIndex` wraps back to the start at the tape's end. Escape / outside-pointer close
// it. Pixi is reached only through the dynamic import below, so this module — and the whole home
// bundle — stays Pixi-free until a visitor first opens a preview.

// The lazy boundary: the ONE dynamic import of the Pixi mount. Keeping it a plain module-level
// function (not inlined) makes the boundary easy to read and to assert.
const loadPreviewStage = (): Promise<Component<PreviewStageProps>> =>
  import("./PreviewStage").then((module) => module.default);

// The attacker reads at full strength; the passive target is faded so the eye follows the attacker as
// the subject of the preview. The exact fade is eye-tuned — the seam test pins only the relationship.
const PREVIEW_FIGURE_ALPHA = { a: 1, b: 0.4 } as const;

// Whether the visitor asked the OS to reduce motion. The default reads the media query live; it is
// sampled ONCE when a preview opens (below), so a mid-session OS toggle takes effect on the next open
// rather than mid-preview. Guarded for SSR, though the sample only runs client-side (on open).
const defaultReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export type MovePreviewProps = {
  // The open move id, or null when closed. Null renders nothing (the popover is portalled only while
  // open); switching moves re-aims the one preview.
  move: string | null;
  onClose: () => void;
  // The eye control's on-screen rect, so the popover can sit beside it. Presentation only.
  anchor?: DOMRect | null;
  // The Pixi renderer loader — injected in tests (a spy stage), the real dynamic import in production.
  loadStage?: () => Promise<Component<PreviewStageProps>>;
  // Injectable reduced-motion source (default the real media-query read). Tests pass `() => true` /
  // `() => false` to drive both branches deterministically.
  reducedMotion?: () => boolean;
};

const MovePreview: Component<MovePreviewProps> = (props) => {
  const load = () => (props.loadStage ?? loadPreviewStage)();

  // The loaded renderer, kept once resolved — a second open reuses it rather than spinning up another
  // Application.
  const [stage, setStage] = createSignal<Component<PreviewStageProps>>();

  // The loop clock's fractional playhead; the ticker advances it, `loopIndex` wraps it to a tape index.
  const [playhead, setPlayhead] = createSignal(0);

  // The async load may resolve after the page has torn down (a fast open-then-navigate); drop the
  // result rather than mount into a disposed scope.
  let disposed = false;

  onCleanup(() => {
    disposed = true;
  });

  // Lazily load the renderer the first time a preview opens; keep it for reuse afterward.
  createEffect(() => {
    if (props.move !== null && stage() === undefined) {
      void load().then((loaded) => {
        if (!disposed) setStage(() => loaded);
      });
    }
  });

  // Restart the loop from the top whenever the open move changes, so a newly opened technique plays
  // from its first frame rather than wherever the last one's clock happened to be.
  createEffect(
    on(
      () => props.move,
      () => setPlayhead(0),
    ),
  );

  // Reduced-motion, sampled ONCE per open: false while closed, the media-query value at the moment a
  // move opens. A memo (not an effect-set signal) so `tick` reads the settled value synchronously on
  // the first draw — no wind-up frame slips out before the freeze takes hold.
  const reduced = createMemo(
    on(
      () => props.move,
      (move) =>
        move !== null && (props.reducedMotion ?? defaultReducedMotion)(),
    ),
  );

  const tape = createMemo(() => moveLoopTape(props.move ?? ""));

  // The frame to draw: the seamless loop index normally, or a still contact frame held for the whole
  // preview when the visitor asked to reduce motion.
  const tick = () =>
    reduced()
      ? contactFrame(props.move ?? "")
      : loopIndex(playhead(), tape().length);

  // Escape and outside-pointer dismissal, live only while a preview is open. The eye control and the
  // popover both carry `data-move-preview`, so interacting with either keeps it open.
  createEffect(() => {
    if (props.move === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (
        !(target instanceof Element) ||
        target.closest("[data-move-preview]") === null
      ) {
        props.onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    onCleanup(() => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    });
  });

  // Sit the popover just below its eye control (clamped inside the viewport by CSS max-width); centred
  // near the top as a fallback when there is no anchor. Presentation only — no test pins it.
  const style = (): JSX.CSSProperties => {
    const rect = props.anchor;

    if (!rect) {
      return { top: "1rem", left: "50%", transform: "translateX(-50%)" };
    }

    return { top: `${rect.bottom + 8}px`, left: `${rect.left}px` };
  };

  return (
    <Show when={props.move !== null}>
      <Portal>
        <div
          role="dialog"
          aria-label={`${props.move} preview`}
          class="move-preview-popover"
          data-move-preview
          style={style()}
        >
          <Show when={stage()}>
            {(Stage) => (
              <Dynamic
                component={Stage()}
                tape={tape()}
                tick={tick()}
                figureAlpha={PREVIEW_FIGURE_ALPHA}
                paused={reduced()}
                onTick={(delta: number) => {
                  // A reduced-motion preview ignores the clock — the held contact frame never advances.
                  if (!reduced()) setPlayhead((p) => p + delta);
                }}
              />
            )}
          </Show>
        </div>
      </Portal>
    </Show>
  );
};

export default MovePreview;
