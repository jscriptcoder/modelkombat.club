import solid from "vite-plugin-solid";
import { defineConfig } from "vite";

// One config drives both halves of the prerender build:
//  - client build (default): generate DOM output with hydration markers so the browser
//    can `hydrate()` the prerendered home page.
//  - SSR build (`--ssr`): generate SSR output so `entry-server.tsx`'s `renderApp` can
//    `renderToString` the home page at build time.
// `hydratable` is on for both so the two outputs carry matching markers.
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [solid({ ssr: Boolean(isSsrBuild), solid: { hydratable: true } })],
  // The client build is multi-page: the marketing home (`index.html`, prerendered + hydrated), the
  // client-rendered `/ring` submit page (`ring.html`), the client-rendered `/watch` fight viewer
  // (`replay.html`), and the dark `/dojo` pose lab (`dojo.html`, its own `dojo.tsx` entry). The SSR
  // build takes its input from the `--ssr` entry flag instead, so the multi-page input is applied to
  // the client build only.
  build: isSsrBuild
    ? undefined
    : {
        rollupOptions: {
          input: {
            main: "index.html",
            ring: "ring.html",
            replay: "replay.html",
            dojo: "dojo.html",
          },
        },
      },
}));
