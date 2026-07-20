import { render } from "solid-js/web";

import SheetApp from "./SheetApp";

const root = document.getElementById("root");

if (root) {
  // /sheet is client-rendered (not hydrated): the shell ships no server-rendered body — just a
  // <noscript> fallback — so there is nothing to hydrate. `render` mounts the contact sheet fresh.
  render(() => <SheetApp />, root);
}
