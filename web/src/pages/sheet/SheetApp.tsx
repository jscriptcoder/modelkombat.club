import { type Component } from "solid-js";
import { Dynamic } from "solid-js/web";

import SheetStage, { type SheetStageProps } from "./SheetStage";
import "../../shared/app.css";
import "./sheet.css";

// The arsenal contact-sheet page (/sheet): a dark developer route that renders every technique in a
// labelled grid, each attacker frozen at its active phase, so the whole roster can be compared at a
// glance — the detector for whether any two moves read alike (S7). Static: no controls, no transport.
// The pose data + grid draw layer are unit-tested (contact-sheet.test / figures.test); the page is a
// thin frame around the Pixi mount. Dark route: not linked from the nav, noindex, off the sitemap.

type SheetAppProps = {
  // The Pixi render sink — the impure edge. Injectable so a page test asserts the frame without a real
  // WebGL mount (the draw maths lives in the unit tests); production uses the default SheetStage.
  stage?: Component<SheetStageProps>;
};

const SheetApp: Component<SheetAppProps> = (props) => (
  <main class="sheet">
    <h1>Arsenal — contact sheet</h1>
    <p class="sheet-blurb">
      Every technique in the arsenal, each posed at the moment of contact. A
      move that reads like its neighbour is one to re-tune.
    </p>

    <Dynamic component={props.stage ?? SheetStage} />
  </main>
);

export default SheetApp;
