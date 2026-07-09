import { render } from "solid-js/web";

import RingPage from "./RingPage";

const root = document.getElementById("root");

if (root) {
  // /ring is client-rendered (not hydrated): the shell ships no server-rendered body — just a
  // <noscript> fallback — so there is nothing to hydrate. `render` mounts the interactive form
  // fresh, which sidesteps the home page's hydration wiring entirely (this page has no SSR data).
  render(() => <RingPage />, root);
}
