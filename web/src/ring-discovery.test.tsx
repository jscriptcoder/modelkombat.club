import { describe, expect, it } from "vitest";

// /ring must be discoverable by machines, not only by humans clicking the Nav / Hero CTA. Two
// static surfaces advertise it: sitemap.xml (for crawlers) and llms.txt (for reading LLMs).
// Fetching the served files exercises the crawler's-eye view and lets the real browser DOMParser
// give a genuine XML well-formedness check — no XML dependency needed.
const RING_URL = "https://modelkombat.club/ring";

describe("/ring discoverability surfaces", () => {
  it("lists /ring in a well-formed sitemap.xml", async () => {
    const xml = await (await fetch("/sitemap.xml")).text();

    const doc = new DOMParser().parseFromString(xml, "application/xml");

    // A <parsererror> node is how DOMParser reports malformed XML — there must be none.
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);

    const locs = [...doc.getElementsByTagName("loc")].map(
      (el) => el.textContent,
    );

    expect(locs).toContain(RING_URL);
  });

  it("documents /ring in llms.txt", async () => {
    const txt = await (await fetch("/llms.txt")).text();

    expect(txt).toContain(RING_URL);
  });
});
