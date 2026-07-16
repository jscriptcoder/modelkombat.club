import { render } from "solid-js/web";

import ReplayApp from "./ReplayApp";

const root = document.getElementById("root");

if (root) {
  // /watch is client-rendered (not hydrated): the shell ships no server-rendered body — just a
  // <noscript> fallback — so there is nothing to hydrate. `render` mounts the page (shared nav +
  // the Pixi player + footer) fresh, exactly as /ring does.
  render(() => <ReplayApp />, root);
}
