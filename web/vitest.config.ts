import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import solid from "vite-plugin-solid";

// Web project: the SolidJS public site. UI is tested in a real browser via
// Vitest Browser Mode (Playwright/Chromium) so behaviour is verified against a
// genuine DOM, not a jsdom shim.
export default defineConfig({
  plugins: [solid()],
  resolve: { conditions: ["development", "browser"] },
  test: {
    name: "web",
    include: ["src/**/*.test.tsx"],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
});
