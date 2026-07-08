import { render } from "solid-js/web";

import App from "./App";
import { isSpecRoute } from "./routes";
import SpecPage from "./SpecPage";

const root = document.getElementById("root");

if (root) {
  // The Nav "Spec" link opens /spec-guide as a fresh page load, so the bootstrap
  // simply picks which root to mount from the current path — no client router.
  render(
    () => (isSpecRoute(window.location.pathname) ? <SpecPage /> : <App />),
    root,
  );
}
