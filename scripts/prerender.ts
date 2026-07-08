// Post-build prerender step (run via tsx, after the client + SSR Vite builds). It turns
// the built HTML shell into two pages:
//   - dist/index.html      — the home shell with the server-rendered body injected into
//                            #root, so a no-JS fetch (LLMs, crawlers) sees real content.
//   - dist/spec-guide.html — the *untouched* shell (empty #root) so the client renders
//                            SpecPage into it; no prerendered home content leaks in.
//                            (Slice 3 makes this page fully static with its own <head>.)
//
// renderApp + injectBody come from the SSR-built bundle. Fail-fast: injectBody throws if
// the shell has no #root, so a broken prerender aborts the build (Vercel keeps the last
// good deploy) rather than silently shipping an empty page.
import { readFileSync, writeFileSync } from "node:fs";

import { renderHomePage } from "../web/.ssr/entry-server.js";

const distDir = new URL("../web/dist/", import.meta.url);
const indexPath = new URL("index.html", distDir);
const specGuidePath = new URL("spec-guide.html", distDir);

const shell = readFileSync(indexPath, "utf8");

// Capture the empty shell for /spec-guide *before* filling index.html's #root.
writeFileSync(specGuidePath, shell, "utf8");

// The home page is prerendered (body in #root) and made hydratable (hydration script in
// <head>); /spec-guide keeps the empty shell above and client-renders SpecPage.
writeFileSync(indexPath, renderHomePage(shell), "utf8");

console.log(
  "prerender: wrote dist/index.html (home) + dist/spec-guide.html (shell)",
);
