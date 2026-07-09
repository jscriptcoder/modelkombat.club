// Post-build prerender step (run via tsx, after the client + SSR Vite builds). It turns
// the built HTML shell into three outputs:
//   - dist/index.html      — the home shell with the server-rendered body injected into
//                            #root (plus Solid's hydration script), so a no-JS fetch sees
//                            real content and the browser hydrates it.
//   - dist/spec-guide.html — the generated spec rendered to fully static HTML: its own
//                            <head> (title + canonical) and NO client JS, so LLMs and
//                            crawlers read the whole spec and native #section deep-links
//                            work.
//   - dist/spec.md         — the raw generated spec markdown, served statically at
//                            /spec.md. A CDN-served fallback carrying the exact spec bytes
//                            for LLM tooling that trips over the /spec serverless endpoint
//                            (no function, no cold start). Same content as docs/spec.md;
//                            generated here from the same generateSpec() so it can never
//                            drift from the engine (no committed duplicate).
//
// renderHomePage/renderSpecGuidePage come from the SSR-built bundle. generateSpec() is
// called HERE (unbundled, via tsx) so its committed-source reads resolve against the real
// repo layout, not the bundled .ssr/ path; the API envelope is omitted so the static page
// and raw markdown carry only the canonical spec core. Fail-fast: the render transforms
// throw if the shell is malformed, aborting the build (Vercel keeps the last good deploy)
// rather than silently shipping a broken page.
import { readFileSync, writeFileSync } from "node:fs";

import { generateSpec } from "../src/cli/gen-spec.js";
import {
  renderHomePage,
  renderSpecGuidePage,
} from "../web/.ssr/entry-server.js";

const distDir = new URL("../web/dist/", import.meta.url);
const indexPath = new URL("index.html", distDir);
const specGuidePath = new URL("spec-guide.html", distDir);
const rawSpecPath = new URL("spec.md", distDir);

// Read the pristine shell (empty #root) ONCE; strings are immutable, so both pages render
// from the same untouched shell — spec-guide stripping its scripts never affects home.
const shell = readFileSync(indexPath, "utf8");

// generateSpec() is the single source of truth for the spec (the same bytes committed to
// docs/spec.md and pinned by its drift test). Compute once, then feed both the static
// spec-guide page and the raw /spec.md fallback, so neither can drift from the engine.
const spec = generateSpec();

writeFileSync(specGuidePath, renderSpecGuidePage(shell, spec), "utf8");
writeFileSync(rawSpecPath, spec, "utf8");
writeFileSync(indexPath, renderHomePage(shell), "utf8");

console.log(
  "prerender: wrote dist/index.html (home) + dist/spec-guide.html (static spec) + dist/spec.md (raw spec)",
);
