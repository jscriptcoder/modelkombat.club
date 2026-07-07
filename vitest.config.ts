import { defineConfig } from "vitest/config";

// Root config composes the two projects so `npm test` runs both suites:
//  - node: engine + api (`vitest.node.config.ts`)
//  - web:  browser-mode SolidJS site (`web/vitest.config.ts`)
export default defineConfig({
  test: {
    projects: ["./vitest.node.config.ts", "./web/vitest.config.ts"],
  },
});
