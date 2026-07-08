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
}));
