// Thin I/O entry for `npm run gen:variety`: write the generated board to
// docs/variety.md. The pure generateVariety() is tested in gen-variety.test.ts; the
// committed file is pinned to that output by the drift test.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { generateVariety } from "./gen-variety.js";

const varietyPath = fileURLToPath(
  new URL("../../docs/variety.md", import.meta.url),
);

writeFileSync(varietyPath, generateVariety(), "utf8");
process.stdout.write(`wrote ${varietyPath}\n`);
