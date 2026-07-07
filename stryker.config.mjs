// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: "vitest",
  // Browser-mode (web) tests can't be driven by Stryker's Vitest runner and the
  // web UI isn't in `mutate` anyway — pin the runner to the Node-only project.
  vitest: { configFile: "vitest.node.config.ts" },
  coverageAnalysis: "perTest",
  reporters: ["clear-text", "progress"],
  // Mutate first-party production source only (never tests/fixtures/shared specs).
  mutate: [
    "src/**/*.ts",
    "!src/**/*.test.ts",
    "!src/**/*.contract.ts",
    "api/**/*.ts",
    "!api/**/*.test.ts",
  ],
};
