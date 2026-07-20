import { type Component } from "solid-js";
import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import SheetApp from "./SheetApp";
import type { SheetStageProps } from "./SheetStage";

// /sheet is the arsenal contact sheet: a dark dev route that renders every technique in a labelled
// grid so a developer can compare them at a glance. The pose data is asserted in contact-sheet.test
// (pure) and the grid draw layer in figures.test (createContactSheet); here we prove only that the
// PAGE mounts — its heading and the region the Pixi canvas attaches to. A spy stage stands in for the
// WebGL mount where the canvas itself is not under test (it is opaque to DOM assertions).
const spyStage: Component<SheetStageProps> = () => (
  <div data-testid="spy-stage" />
);

describe("SheetApp — the arsenal contact-sheet page", () => {
  it("names itself with a contact-sheet heading", async () => {
    const { findByRole } = render(() => <SheetApp stage={spyStage} />);

    expect(
      await findByRole("heading", { name: /contact sheet/i }),
    ).toBeTruthy();
  });

  it("renders the sheet region the Pixi canvas mounts into", async () => {
    const { findByRole } = render(() => <SheetApp />);

    expect(
      await findByRole("img", { name: /arsenal|techniques/i }),
    ).toBeTruthy();
  });
});
