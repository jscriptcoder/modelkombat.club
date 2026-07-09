import { describe, expect, it, afterEach } from "vitest";

import App from "./App";
import { mount } from "./mount";

// The home page is bootstrapped by main.tsx. In production #root is PRERENDERED, so the client
// hydrates the existing markup. But the local dev server (`vite web`, which is what `vercel dev`
// runs) serves the raw index.html with an EMPTY #root and no hydration script — and hydrating an
// empty root silently no-ops, leaving a blank page. `mount` bridges both worlds: render fresh when
// there is nothing to hydrate, hydrate when the prerendered markup is present.

const freshRoot = (): HTMLElement => {
  const root = document.createElement("div");

  root.id = "root";
  document.body.appendChild(root);

  return root;
};

afterEach(() => document.getElementById("root")?.remove());

describe("mount (home-page bootstrap)", () => {
  it("renders the app fresh into an empty root (the dev / non-prerendered path)", () => {
    const root = freshRoot();

    mount(() => <App />, root);

    // An empty #root has no server markup to hydrate, so the app must be RENDERED — a bare
    // hydrate() here no-ops and the page stays blank (the exact `vite`/`vercel dev` breakage).
    expect(root.querySelector("nav.nav")).toBeTruthy();
    expect(root.querySelector(".hero")).toBeTruthy();
  });
});
