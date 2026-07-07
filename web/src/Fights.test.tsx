import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import Fights from "./Fights";

describe("Fights teaser", () => {
  it("is a labelled region anchored at #fights", () => {
    const { getByRole } = render(() => <Fights />);

    // The accessible name comes from the heading; the id is the nav anchor target.
    const region = getByRole("region", { name: /fight replays/i });

    expect(region.id).toBe("fights");
    // AC-1: it describes what's coming — replaying a title fight tick-for-tick.
    expect(region.textContent).toMatch(/tick-for-tick/i);
  });

  it("offers a replay control that is aria-disabled, not natively disabled (AC-A1/A3)", () => {
    const { getByRole } = render(() => <Fights />);

    // AC-A3: named for assistive tech by its exact visible label — not a bare
    // greyed button, and the decorative ▶ glyph must not leak into the name.
    const control = getByRole("button", {
      name: "Replays — in development",
    });

    // aria-disabled keeps it focusable/hoverable; a native `disabled` would drop it
    // from the tab order and suppress the tooltip — the opposite of AC-A1/AC-R3.
    expect(control.getAttribute("aria-disabled")).toBe("true");
    expect(control.hasAttribute("disabled")).toBe(false);
  });

  it("carries the in-development state in visible text, with the tooltip as enhancement (AC-R3)", () => {
    const { getByRole } = render(() => <Fights />);

    const control = getByRole("button", { name: /in development/i });

    // Touch devices have no hover: the state must be readable without the tooltip.
    expect(control.textContent).toMatch(/in development/i);
    // The title is a progressive enhancement, never the sole signal.
    expect(control.getAttribute("title")).toBeTruthy();
  });
});
