import { generateHydrationScript, renderToString } from "solid-js/web";

import App from "../pages/home/App";
import { CANONICAL_ORIGIN } from "../shared/lib/config";
import {
  injectBody,
  injectHead,
  setCanonical,
  setTitle,
  stripScripts,
} from "./inject-body";
import { SPEC_GUIDE_PATH, VARIETY_PATH } from "../shared/lib/paths";
import SpecPage from "../pages/spec-guide/SpecPage";
import VarietyPage from "../pages/variety/VarietyPage";

// Re-exported so the prerender script can pull the string transforms from this one
// SSR-built bundle (they are pure string transforms).
export {
  injectBody,
  injectHead,
  setCanonical,
  setTitle,
  stripScripts,
} from "./inject-body";

// The spec page's own tab title — distinct from the home title the shell ships with.
const SPEC_GUIDE_TITLE = "ModelKombat — Bot authoring spec";

// The variety board page's own tab title — likewise distinct from the home title.
const VARIETY_TITLE = "ModelKombat — Variety board";

// The build-time prerender entry. Renders the home page to a body string that the
// prerender script injects into the built HTML shell's `#root`, so a no-JS fetch
// (LLMs, crawlers) sees the real content. Synchronous `renderToString` does not await
// resources, so the client-gated King/Podium fetches render their empty fallback here
// (see createClientResource) — exactly the static HTML we want.
export const renderApp = (): string => renderToString(() => <App />);

// Assemble the full prerendered home page from the built HTML shell: the server-rendered
// body into `#root`, PLUS Solid's hydration script into the `<head>`. The hydration
// script sets up `window._$HY` — without it the browser's `hydrate()` cannot establish
// its context, `onMount` never fires, and the client King/Podium fetches never run.
export const renderHomePage = (shell: string): string =>
  injectBody(injectHead(shell, generateHydrationScript()), renderApp());

// Assemble the fully-static spec page: the spec markdown rendered to HTML in `#root`, a
// distinct `<head>` (own title + canonical), and NO client JS — every `<script>` is
// stripped. There is deliberately no hydration script: nothing hydrates a page that
// ships no JS, so `/spec-guide` is inert, readable static HTML.
export const renderSpecGuidePage = (shell: string, spec: string): string =>
  stripScripts(
    setCanonical(
      setTitle(
        injectBody(
          shell,
          renderToString(() => <SpecPage spec={spec} />),
        ),
        SPEC_GUIDE_TITLE,
      ),
      `${CANONICAL_ORIGIN}${SPEC_GUIDE_PATH}`,
    ),
  );

// Assemble the fully-static variety board page — the same static-doc shape as the spec
// page: the board markdown rendered to HTML in `#root`, a distinct `<head>` (own title +
// canonical), and NO client JS. There is deliberately no hydration script; nothing
// hydrates a page that ships no JS, so `/variety` is inert, readable static HTML.
export const renderVarietyPage = (shell: string, board: string): string =>
  stripScripts(
    setCanonical(
      setTitle(
        injectBody(
          shell,
          renderToString(() => <VarietyPage board={board} />),
        ),
        VARIETY_TITLE,
      ),
      `${CANONICAL_ORIGIN}${VARIETY_PATH}`,
    ),
  );
