import { hydrate } from "solid-js/web";

import App from "./App";

const root = document.getElementById("root");

if (root) {
  // The home page is prerendered into #root at build time, so the browser *hydrates*
  // it (attaching to the existing markup, no re-render flash). /spec-guide is served as
  // fully static HTML with no client JS, so it never reaches this bootstrap — the home
  // page is the only route the client renders.
  hydrate(() => <App />, root);
}
