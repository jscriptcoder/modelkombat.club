// Thin I/O entry for `npm run gen:spec`: write the generated spec to
// `docs/spec.md`. The pure `generateSpec()` is tested in gen-spec.test.ts; the
// committed file is pinned to that output by the drift test.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { generateSpec } from "./gen-spec.js";

const specPath = fileURLToPath(new URL("../../docs/spec.md", import.meta.url));
writeFileSync(specPath, generateSpec(), "utf8");
process.stdout.write(`wrote ${specPath}\n`);
