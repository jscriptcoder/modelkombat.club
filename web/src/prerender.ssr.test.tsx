import { renderToString } from "solid-js/web";
import { describe, expect, it } from "vitest";

import {
  renderApp,
  renderHomePage,
  renderSpecGuidePage,
} from "./entry-server";
import {
  injectBody,
  injectHead,
  setCanonical,
  setTitle,
  stripScripts,
} from "./inject-body";
import { CANONICAL_ORIGIN } from "./config";
import King from "./King";
import Podium from "./Podium";
import SpecPage from "./SpecPage";

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

  it("prerenders a no-JS pointer to the live /king endpoint in the empty throne", () => {
    // The empty fallback is the only King markup a no-JS crawler sees, so it must carry a
    // followable link to the live standings, with the origin spelled out in the text.
    // (The exact absolute link text is pinned by the browser-mode accessible-name test;
    // hydratable SSR splits the `{CANONICAL_ORIGIN}/king` text with hydration markers, so
    // the raw HTML here is asserted at the followable-href + origin-text level.)
    const html = renderToString(() => <King />);

    expect(html).toContain('href="/king"');
    expect(html).toContain(CANONICAL_ORIGIN);
  });

  it("prerenders the Hall of Kings as the empty hall, not a loading spinner", () => {
    const html = renderToString(() => <Podium />);

    expect(html).toContain("No champions have been crowned yet");
    expect(html).not.toContain("Gathering");
  });

  it("prerenders a no-JS pointer to the live /king endpoint in the empty hall", () => {
    const html = renderToString(() => <Podium />);

    expect(html).toContain('href="/king"');
    expect(html).toContain(CANONICAL_ORIGIN);
  });
});

// renderApp is the build-time prerender entry: it turns the home route into the body
// string the prerender script injects into the built HTML shell's #root, so a no-JS
// fetch (LLMs, crawlers) sees the real marketing content. It must carry every *static*
// section plus the dynamic sections' *empty* fallback (they fetch client-side only).
describe("renderApp (prerender entry)", () => {
  it("renders the home page's static section content", () => {
    const html = renderApp();

    expect(html).toContain("The Arsenal");
    // A Gauntlet fighter name — the roster is the marketing centrepiece...
    expect(html).toContain("jabber");
    // ...and the four How-it-works step titles.
    expect(html).toContain("Read the spec");
    expect(html).toContain("Write a JSON bot");
    expect(html).toContain("Clear the gauntlet");
    expect(html).toContain("Challenge the King");
  });

  it("prerenders the dynamic sections as their empty fallback, not fetched data", () => {
    const html = renderApp();

    // King + Hall of Kings show their empty state — they fetch only after hydration.
    expect(html).toContain("The throne awaits");
    expect(html).toContain("No champions have been crowned yet");
  });

  it("bakes a /king endpoint link into both empty sections for no-JS crawlers", () => {
    const html = renderApp();

    // Both empty fallbacks (King + Hall of Kings) carry the pointer, so the static page a
    // crawler fetches without JS has the live endpoint in two self-describing landmarks.
    const links = html.match(/href="\/king"/g) ?? [];

    expect(links).toHaveLength(2);
  });
});

// SpecPage is prerendered at build time (no browser, no network). Its render must be
// SSR-safe — it must not touch the server-absent `document` — and it must turn the spec
// markdown it is GIVEN (as a prop) into semantic HTML. The old page fetched /spec and set
// `document.title` in its body (which throws under SSR); the static <head> owns the title
// now and the content is passed in, so the component is a pure markdown→HTML transform.
describe("SpecPage server render (build-time prerender)", () => {
  const SPEC_FIXTURE = "# Bot authoring spec\n\n## Frame table\n\nnumbers";

  it("renders to a string without touching the server-absent `document`", () => {
    expect(() =>
      renderToString(() => <SpecPage spec={SPEC_FIXTURE} />),
    ).not.toThrow();
  });

  it("turns the given markdown into semantic HTML with slug-id headings", () => {
    const html = renderToString(() => <SpecPage spec={SPEC_FIXTURE} />);

    // The '# '/'## ' headings become real, deep-linkable <h1>/<h2> with slug ids...
    expect(html).toContain("Bot authoring spec");
    expect(html).toContain('id="frame-table"');
    // ...and the raw markdown source lines do not survive rendering.
    expect(html).not.toContain("# Bot authoring spec");
  });
});

// The prerender script's core is a pure string transform, unit-tested here so the
// injection is covered without a slow in-test build (the real artifact rests on the
// build's fail-fast + the manual smoke).
describe("injectBody", () => {
  const shell = (root: string): string =>
    `<html><head><title>Keep me</title></head><body>${root}<script src="/x.js"></script></body></html>`;

  it("places the rendered body inside the shell's empty #root", () => {
    const result = injectBody(
      shell(`<div id="root"></div>`),
      "<main>PRE</main>",
    );

    expect(result).toContain(`<div id="root"><main>PRE</main></div>`);
    // The rest of the shell (head, scripts) is left intact.
    expect(result).toContain("<title>Keep me</title>");
    expect(result).toContain(`<script src="/x.js"></script>`);
    // #root is no longer empty — a no-op injection would fail here.
    expect(result).not.toContain(`<div id="root"></div>`);
  });

  it("throws (fail-fast) when the shell has no empty #root to inject into", () => {
    expect(() =>
      injectBody(`<html><body><div id="app"></div></body></html>`, "<p>x</p>"),
    ).toThrow(/root/i);
  });
});

describe("injectHead", () => {
  it("inserts markup immediately before </head>", () => {
    const result = injectHead(
      `<html><head><title>t</title></head><body></body></html>`,
      "<script>X</script>",
    );

    expect(result).toContain("<title>t</title><script>X</script></head>");
  });

  it("throws (fail-fast) when the shell has no </head>", () => {
    expect(() =>
      injectHead(`<html><body></body></html>`, "<script>X</script>"),
    ).toThrow(/head/i);
  });
});

// The full prerendered home page: body in #root PLUS Solid's hydration script in the
// <head>. The script is not optional — without `window._$HY` the browser's `hydrate()`
// can't establish its context, `onMount` never fires, and the client King/Podium fetches
// never run (the page looks right but is inert). This is the regression guard for that.
describe("renderHomePage", () => {
  const shell = `<html><head><title>t</title></head><body><div id="root"></div><script src="/x.js"></script></body></html>`;

  it("injects the server-rendered body into #root", () => {
    const html = renderHomePage(shell);

    expect(html).toContain("The Arsenal");
    expect(html).not.toContain(`<div id="root"></div>`);
  });

  it("includes Solid's hydration script so the browser can hydrate and run effects", () => {
    expect(renderHomePage(shell)).toContain("_$HY");
  });
});

// The spec page names itself in the tab, distinct from the marketing home title.
describe("setTitle", () => {
  it("replaces the document <title>", () => {
    const result = setTitle("<head><title>Home</title></head>", "Spec");

    expect(result).toContain("<title>Spec</title>");
    expect(result).not.toContain("<title>Home</title>");
  });

  it("throws (fail-fast) when the shell has no <title>", () => {
    expect(() => setTitle("<head></head>", "Spec")).toThrow(/title/i);
  });
});

// The spec page's canonical URL is its own, not the home page's.
describe("setCanonical", () => {
  it("points the canonical link at the given href", () => {
    const result = setCanonical(
      '<link rel="canonical" href="https://modelkombat.club/" />',
      "https://modelkombat.club/spec-guide",
    );

    expect(result).toContain(
      '<link rel="canonical" href="https://modelkombat.club/spec-guide"',
    );
  });

  it("throws (fail-fast) when the shell has no canonical link", () => {
    expect(() => setCanonical("<head></head>", "x")).toThrow(/canonical/i);
  });
});

// The spec page is fully static — no client JS. Every <script> goes: the module
// bundle in the body AND the JSON-LD block in the head.
describe("stripScripts", () => {
  it("removes every <script> block so the page ships no JS", () => {
    const result = stripScripts(
      '<head><script type="application/ld+json">{"a":1}</script></head>' +
        '<body>keep me<script type="module" src="/a.js"></script></body>',
    );

    expect(result).not.toContain("<script");
    // Non-script content is untouched.
    expect(result).toContain("keep me");
  });

  it("throws (fail-fast) when the shell has no <script> to strip", () => {
    expect(() => stripScripts("<head></head>")).toThrow(/script/i);
  });
});

// The full static spec page: the rendered spec in #root, a distinct <head> (own title
// + canonical), and NO client JS. There is deliberately no hydration script — nothing
// hydrates a page that ships no JS.
describe("renderSpecGuidePage", () => {
  const shell =
    "<!doctype html><html><head><title>Home</title>" +
    '<link rel="canonical" href="https://modelkombat.club/" />' +
    '<script type="application/ld+json">{}</script></head>' +
    '<body><div id="root"></div>' +
    '<script type="module" src="/assets/x.js"></script></body></html>';

  const spec = "# Bot authoring spec\n\n## Frame table\n\nnumbers";

  it("renders the spec into #root as static HTML with slug-id headings", () => {
    const html = renderSpecGuidePage(shell, spec);

    expect(html).toContain("Bot authoring spec");
    expect(html).toContain('id="frame-table"');
    // #root is filled — a no-op injection would leave it empty.
    expect(html).not.toContain('<div id="root"></div>');
  });

  it("gives the page its own <title> and canonical, and ships no client JS", () => {
    const html = renderSpecGuidePage(shell, spec);

    expect(html).toContain("<title>ModelKombat — Bot authoring spec</title>");
    expect(html).toContain(
      '<link rel="canonical" href="https://modelkombat.club/spec-guide"',
    );
    expect(html).not.toContain("<script");
  });
});
