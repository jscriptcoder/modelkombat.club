import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import DojoApp from "./DojoApp";

// /dojo is the pose lab: a dark dev route that renders two fighters through the real replay pipeline
// so the pose model can be tuned in isolation. The scene-graph maths is asserted in dojo-tape.test
// (pure builder + the shipped projection) and figures.test (the draw layer). Here we prove the PAGE
// mounts — its heading and the canvas host the Pixi stage attaches to — so the route entry renders
// without throwing.
describe("DojoApp — the pose-lab page", () => {
  it("names itself with a pose-lab heading", async () => {
    const { findByRole } = render(() => <DojoApp />);

    expect(await findByRole("heading", { name: /pose lab/i })).toBeTruthy();
  });

  it("renders the fighter stage host the Pixi canvas mounts into", async () => {
    const { findByRole } = render(() => <DojoApp />);

    expect(await findByRole("img", { name: /fighters/i })).toBeTruthy();
  });
});
