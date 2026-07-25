import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import Fights from "./Fights";

// This section used to advertise replays with an `aria-disabled` button, because /watch shipped
// dark. /watch is public now, so the dead control is gone and the section is a real way in. The
// three tests that pinned the disabled-button behaviour were REPLACED, not repaired — they
// characterised exactly what this slice removes.
//
// The static frame asserted here is also, deliberately, the fallback S2 will degrade to when its
// `GET /replay` card fetch is loading, empty, or failed (watch-public-decisions.md D4). Cards layer
// on top of this; they never replace it.
describe("Fights section", () => {
  it("is a labelled region anchored at #fights", () => {
    const { getByRole } = render(() => <Fights />);

    // The accessible name comes from the heading; the id is the anchor target that keeps every
    // pre-existing `/#fights` link resolving even though the nav now points at /watch.
    const region = getByRole("region", { name: /fight replays/i });

    expect(region.id).toBe("fights");
    expect(region.textContent).toMatch(/tick-for-tick/i);
  });

  it("offers a real link into the fight viewer", () => {
    const { getByRole } = render(() => <Fights />);

    const link = getByRole("link", { name: "Watch the fights" });

    // Same tab, like every other primary destination; the decorative arrow must not leak into
    // the accessible name (getByRole matched it exactly above).
    expect(link.getAttribute("href")).toBe("/watch");
    expect(link.getAttribute("target")).toBe(null);
  });

  it("offers no dead control — nothing aria-disabled and nothing natively disabled", () => {
    const { container } = render(() => <Fights />);

    expect(container.querySelector("[aria-disabled]")).toBeNull();
    expect(container.querySelector(":disabled")).toBeNull();
  });

  it("no longer describes replays as unbuilt", () => {
    const { container } = render(() => <Fights />);

    expect(container.textContent).not.toMatch(/in development/i);
    expect(container.textContent).not.toMatch(/coming soon/i);
  });
});
