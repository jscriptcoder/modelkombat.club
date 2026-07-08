import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";

// Web SSR project: the prerender path. Solid components are compiled in SSR mode and
// rendered with `renderToString` in a Node environment (no browser, no network) —
// exactly what the build-time prerender script does. Kept separate from the
// browser-mode `web` project so each test runs in the environment it needs.
//
// `conditions: ["node", "development"]` resolves `solid-js/web` to its **server** build
// (the one that actually provides `renderToString`; the browser build stubs it out) while
// keeping Solid's dev-mode warnings on. `ssr`/`hydratable` match the SSR build so the
// emitted markup carries the `data-hk` hydration markers the client `hydrate()` needs.
export default defineConfig({
  plugins: [solid({ ssr: true, solid: { hydratable: true } })],
  resolve: { conditions: ["node", "development"] },
  test: {
    name: "web-ssr",
    environment: "node",
    include: ["src/**/*.ssr.test.tsx"],
    server: { deps: { inline: [/solid-js/, /@solidjs/] } },
  },
});
