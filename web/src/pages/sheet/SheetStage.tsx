import { onCleanup, onMount, type Component } from "solid-js";
import { Application } from "pixi.js";

import { createContactSheet, type SheetLayout } from "../replay/figures";
import { bodyHeightPx, type Viewport } from "../replay/scene";
import { contactSheetCells } from "./contact-sheet";

// The contact sheet's Pixi mount: like DojoStage's, it attaches an Application and draws through the
// pure contact-sheet data layer + createContactSheet. STATIC — the sheet never animates or takes a
// playhead, so there is no draw effect or ticker; it builds the grid once on mount. The pose maths is
// unit-tested in contact-sheet.test and the grid draw layer in figures.test; here we keep only the
// renderer wiring, exactly the seam DojoStage keeps.

// The grid: five columns fit the 13-move arsenal in three rows. Each cell is a fixed box; the figure
// scale is sized from the cell width (the same knob the ring's figures scale from), so a cell figure
// reads at a sensible size. All eye-tunable — no test pins these.
const COLS = 5;
const CELL_WIDTH = 240;
const CELL_HEIGHT = 300;
const HEAD_HEIGHT_RATIO = 0.3;

// The site's dark canvas background (matches the theme-color in the page shells).
const BACKGROUND = 0x0b0e14;

export type SheetStageProps = {
  // Optional override for the per-figure scale viewport; production derives it from the cell width.
  viewport?: Viewport;
};

const SheetStage: Component<SheetStageProps> = (props) => {
  const figureViewport = props.viewport ?? {
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
  };

  const cells = contactSheetCells(figureViewport);
  const rows = Math.ceil(cells.length / COLS);

  const layout: SheetLayout = {
    cols: COLS,
    cellWidth: CELL_WIDTH,
    cellHeight: CELL_HEIGHT,
    headPx: HEAD_HEIGHT_RATIO * bodyHeightPx(figureViewport),
  };

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
      width: COLS * CELL_WIDTH,
      height: rows * CELL_HEIGHT,
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

    const sheet = createContactSheet(cells, layout);

    created.stage.addChild(sheet.root);
  });

  return (
    <div
      ref={(el) => {
        host = el;
      }}
      class="sheet-stage"
      role="img"
      aria-label="Every arsenal technique posed at its active phase"
    />
  );
};

export default SheetStage;
