import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// /ring is client-rendered, but its shell must be meaningful without JS: a crawler or an LLM
// browser sees a real <title> + canonical, and a no-JS visitor is told how to reach the ring by
// hand (POST /fight with an X-Author-Handle header — see /spec). Asserting the authored source
// needs no browser, so it lives in the node SSR project.
const ringHtml = readFileSync(new URL("../ring.html", import.meta.url), "utf8");

describe("ring.html shell", () => {
  it("names the page and points its canonical at /ring", () => {
    expect(ringHtml).toContain(
      "<title>ModelKombat — Send your bot into the ring</title>",
    );
    expect(ringHtml).toContain(
      '<link rel="canonical" href="https://modelkombat.club/ring" />',
    );
  });

  it("tells no-JS visitors how to reach the ring by hand", () => {
    const noscript =
      /<noscript>([\s\S]*?)<\/noscript>/i.exec(ringHtml)?.[1] ?? "";

    // The fallback must name the POST target, the required header, and where the format lives.
    expect(noscript).toMatch(/\/fight/);
    expect(noscript).toMatch(/x-author-handle/i);
    expect(noscript).toMatch(/\/spec/);
  });

  it("boots the client from the ring entry module", () => {
    expect(ringHtml).toContain('src="/src/ring.tsx"');
  });
});
