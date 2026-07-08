import { hydrate, render } from "solid-js/web";

import App from "./App";
import { isSpecRoute } from "./routes";
import SpecPage from "./SpecPage";

const root = document.getElementById("root");

if (root) {
  // The home page is prerendered into #root at build time, so the browser *hydrates*
  // it (attaching to the existing markup, no re-render flash). /spec-guide is served as
  // an empty shell in this slice, so it still client-renders SpecPage into #root. The
  // Nav "Spec" link opens /spec-guide as a fresh page load, so the bootstrap just picks
  // which mode to use from the current path — no client router.
  if (isSpecRoute(window.location.pathname)) {
    render(() => <SpecPage />, root);
  } else {
    hydrate(() => <App />, root);
  }
}
