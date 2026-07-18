import { render } from "solid-js/web";

import DojoApp from "./DojoApp";

const root = document.getElementById("root");

if (root) {
  // /dojo is client-rendered (not hydrated): the shell ships no server-rendered body — just a
  // <noscript> fallback — so there is nothing to hydrate. `render` mounts the pose lab fresh.
  render(() => <DojoApp />, root);
}
