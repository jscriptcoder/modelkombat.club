import { renderToString } from "solid-js/web";

import App from "./App";

// The build-time prerender entry. Renders the home page to a body string that the
// prerender script injects into the built HTML shell's `#root`, so a no-JS fetch
// (LLMs, crawlers) sees the real content. Synchronous `renderToString` does not await
// resources, so the client-gated King/Podium fetches render their empty fallback here
// (see createClientResource) — exactly the static HTML we want. Slice 3 extends this to
// prerender the spec route statically; for now the home page is the only prerendered route.
export const renderApp = (): string => renderToString(() => <App />);
