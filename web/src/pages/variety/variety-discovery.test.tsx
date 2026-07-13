import { describe, expect, it } from "vitest";

// /variety must be discoverable by machines, not only by a human clicking the Arsenal
// hand-off. Two static surfaces advertise it: sitemap.xml (for crawlers) and llms.txt
// (for reading LLMs). Fetching the served files exercises the crawler's-eye view and lets
// the real browser DOMParser give a genuine XML well-formedness check — no XML dep needed.
const VARIETY_URL = "https://modelkombat.club/variety";

describe("/variety discoverability surfaces", () => {
  it("lists /variety in a well-formed sitemap.xml", async () => {
    const xml = await (await fetch("/sitemap.xml")).text();

    const doc = new DOMParser().parseFromString(xml, "application/xml");

    // A <parsererror> node is how DOMParser reports malformed XML — there must be none.
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);

    const locs = [...doc.getElementsByTagName("loc")].map(
      (el) => el.textContent,
    );

    expect(locs).toContain(VARIETY_URL);
  });

  it("documents /variety in llms.txt", async () => {
    const txt = await (await fetch("/llms.txt")).text();

    expect(txt).toContain(VARIETY_URL);
  });
});
