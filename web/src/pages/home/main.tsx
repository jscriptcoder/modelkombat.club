import App from "./App";
import { mount } from "./mount";

const root = document.getElementById("root");

if (root) {
  // The home page is prerendered into #root at build time, so in production the browser *hydrates*
  // the existing markup (no re-render flash). The local dev server serves an empty #root, so `mount`
  // renders fresh there instead — otherwise a bare hydrate() no-ops and the page is blank in dev.
  mount(() => <App />, root);
}
