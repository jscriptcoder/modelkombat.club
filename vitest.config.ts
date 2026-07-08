import { defineConfig } from "vitest/config";

// Root config composes the projects so `npm test` runs every suite:
//  - node:    engine + api (`vitest.node.config.ts`)
//  - web:     browser-mode SolidJS site (`web/vitest.config.ts`)
//  - web-ssr: Node-mode prerender/SSR render path (`web/vitest.ssr.config.ts`)
export default defineConfig({
  test: {
    projects: [
      "./vitest.node.config.ts",
      "./web/vitest.config.ts",
      "./web/vitest.ssr.config.ts",
    ],
  },
});
