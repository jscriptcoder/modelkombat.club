import { generateHydrationScript, renderToString } from "solid-js/web";

import App from "./App";
import { injectBody, injectHead } from "./inject-body";

// Re-exported so the prerender script can pull the injection helpers from this one
// SSR-built bundle (they are pure string transforms).
export { injectBody, injectHead } from "./inject-body";

// The build-time prerender entry. Renders the home page to a body string that the
// prerender script injects into the built HTML shell's `#root`, so a no-JS fetch
// (LLMs, crawlers) sees the real content. Synchronous `renderToString` does not await
// resources, so the client-gated King/Podium fetches render their empty fallback here
// (see createClientResource) — exactly the static HTML we want. Slice 3 extends this to
// prerender the spec route statically; for now the home page is the only prerendered route.
export const renderApp = (): string => renderToString(() => <App />);

// Assemble the full prerendered home page from the built HTML shell: the server-rendered
// body into `#root`, PLUS Solid's hydration script into the `<head>`. The hydration
// script sets up `window._$HY` — without it the browser's `hydrate()` cannot establish
// its context, `onMount` never fires, and the client King/Podium fetches never run.
export const renderHomePage = (shell: string): string =>
  injectBody(injectHead(shell, generateHydrationScript()), renderApp());
