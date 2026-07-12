import { render } from "solid-js/web";

import RingApp from "./RingApp";

const root = document.getElementById("root");

if (root) {
  // /ring is client-rendered (not hydrated): the shell ships no server-rendered body — just a
  // <noscript> fallback — so there is nothing to hydrate. `render` mounts the page (shared nav +
  // the interactive form + footer) fresh, sidestepping the home page's hydration wiring entirely.
  render(() => <RingApp />, root);
}
