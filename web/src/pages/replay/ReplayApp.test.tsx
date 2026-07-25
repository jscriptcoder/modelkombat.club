import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import ReplayApp from "./ReplayApp";

describe("ReplayApp — the /watch page shell", () => {
  it("marks Fights as the current page, so the shared nav says where the visitor is", () => {
    const { getByRole } = render(() => <ReplayApp />);

    // /watch is a nav destination now rather than a dark route, so the shared header must name it
    // as active — the same contract /ring has.
    expect(
      getByRole("link", { name: "Fights" }).getAttribute("aria-current"),
    ).toBe("page");
  });
});
