import { defineConfig } from "vitest/config";

// Node project: the deterministic engine (`src/`) + the serverless handlers
// (`api/`). Kept as a standalone config so Stryker's Vitest runner — which
// cannot drive browser-mode projects — targets only these Node tests.
export default defineConfig({
  test: {
    name: "node",
    environment: "node",
    include: ["src/**/*.test.ts", "api/**/*.test.ts"],
  },
});
