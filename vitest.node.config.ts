import { defineConfig } from "vitest/config";

// Node project: the deterministic engine (`src/`) + the serverless handlers
// (`api/`). Kept as a standalone config so Stryker's Vitest runner — which
// cannot drive browser-mode projects — targets only these Node tests.
export default defineConfig({
  test: {
    name: "node",
    environment: "node",
    include: ["src/**/*.test.ts", "api/**/*.test.ts"],
    // The gauntlet-driving generator tests (`gen-variety` / `gen-spec`) run full fights through
    // `sim.ts` — ~1s each normally, but several times that under Stryker's instrumentation, which
    // overran vitest's 5s default and failed the mutation dry run. Raised so the suite is
    // runnable both plainly and instrumented.
    testTimeout: 30_000,
  },
});
