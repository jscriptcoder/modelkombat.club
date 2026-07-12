import { type JSX } from "solid-js";
import { hydrate, render } from "solid-js/web";

// Bootstrap the home page into #root, choosing hydrate vs. render by whether the shell was
// prerendered.
//
//  - Production: `npm run build:web` prerenders the page INTO #root (plus the _$HY hydration
//    script in <head>), so the client HYDRATES the existing markup — no re-render flash.
//  - Local dev: the `vite web` dev server (which `vercel dev` runs) serves the raw index.html with
//    an EMPTY #root and no hydration script. Hydrating an empty root silently no-ops into a blank
//    page, so we RENDER fresh instead.
//
// Presence of child ELEMENTS in #root is the signal: prerendered markup has them, the dev shell
// does not. /ring keeps using render() directly — its shell ships a <noscript> child, so it is
// never a candidate for hydration.
export const mount = (app: () => JSX.Element, root: HTMLElement): void => {
  if (root.childElementCount > 0) {
    hydrate(app, root);
  } else {
    render(app, root);
  }
};
