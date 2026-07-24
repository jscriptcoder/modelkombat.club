import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { renderToString } from "solid-js/web";
import { describe, expect, it } from "vitest";

import Arsenal from "./Arsenal";

// The move preview is a pure client-side ENHANCEMENT: the eye control is revealed on mount, and the
// Pixi renderer only loads when a preview is first opened. Two guarantees are checked here in the
// Node/SSR world the browser-mode tests can't reach:
//   1. With JS off (prerender / no-JS crawler), the Arsenal renders exactly as before — roster and
//      descriptors intact, no eye control, no dead affordance. `onMount` never runs under SSR, so
//      rendering the fallback branch here IS the "no eye without JS" guarantee.
//   2. Pixi stays OUT of the statically-imported home module graph — it is reachable only through a
//      dynamic import in the preview mount — so opening the home page never ships the WebGL bundle.

describe("Arsenal — server render (no-JS / prerender)", () => {
  it("renders the roster but no eye preview control when JS is off", () => {
    const html = renderToString(() => <Arsenal />);

    // The section and its roster still render for a no-JS crawler...
    expect(html).toContain("The Arsenal");
    expect(html).toContain("gyaku-zuki");

    // ...but the client-only eye affordance is absent — no dead control in the static markup.
    expect(html).not.toMatch(/preview gyaku-zuki/i);
  });
});

// Read a home-module's source relative to this test file so the import boundary is asserted against
// the real source, not a transcription.
const homeSource = (file: string): string =>
  readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");

const STATIC_PIXI_IMPORT = /^\s*import\s[^;]*from\s+["']pixi\.js["']/m;

describe("move preview — Pixi import boundary (home stays Pixi-free)", () => {
  it("keeps pixi.js out of every statically-imported home module", () => {
    for (const file of ["./App.tsx", "./Arsenal.tsx", "./MovePreview.tsx"]) {
      expect(homeSource(file)).not.toMatch(STATIC_PIXI_IMPORT);
    }
  });

  it("loads the Pixi preview stage through a dynamic import, never a static one", () => {
    const src = homeSource("./MovePreview.tsx");

    // The renderer is behind `import("./PreviewStage")` — a separate async chunk...
    expect(src).toMatch(/import\(\s*["']\.\/PreviewStage["']\s*\)/);
    // ...and is never pulled in as a static value binding (only its TYPE may be imported).
    expect(src).not.toMatch(/^\s*import\s+PreviewStage\s+from/m);
  });
});
