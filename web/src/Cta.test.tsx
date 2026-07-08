import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import Cta from "./Cta";

describe("Cta", () => {
  // Guard: the "Enter the ring" CTA keeps pointing at the RAW /spec endpoint —
  // only the Nav "Spec" link moves to the rendered page (this slice leaves the
  // other two "Read the spec" links untouched).
  it("keeps its 'Read the spec' link pointed at the raw /spec endpoint", () => {
    const { getByRole } = render(() => <Cta />);

    const link = getByRole("link", { name: /read the spec/i });

    expect(link.getAttribute("href")).toBe("/spec");
  });
});
