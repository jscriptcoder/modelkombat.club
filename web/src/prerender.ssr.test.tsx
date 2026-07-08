import { renderToString } from "solid-js/web";
import { describe, expect, it } from "vitest";

import King from "./King";
import Podium from "./Podium";

// When the page is prerendered at build time there is no browser and no network. The
// two dynamic sections must therefore server-render their *empty* fallback — the empty
// throne / empty hall — never a loading spinner (which would mean the fetch ran on the
// server) and never a fabricated champion. The client fetch is driven by `onMount`,
// which never runs during SSR, so asserting the fallback branch here *is* the
// "does not fetch on the server" guarantee that lets the client's first hydrated frame
// match the prerendered markup.
describe("server-rendered dynamic sections", () => {
  it("prerenders the King section as the empty throne, not a loading spinner", () => {
    const html = renderToString(() => <King />);

    expect(html).toContain("The throne awaits");
    // The loading branch would mean the /king fetch ran on the server — it must not.
    expect(html).not.toContain("Summoning");
  });

  it("prerenders the Hall of Kings as the empty hall, not a loading spinner", () => {
    const html = renderToString(() => <Podium />);

    expect(html).toContain("No champions have been crowned yet");
    expect(html).not.toContain("Gathering");
  });
});
