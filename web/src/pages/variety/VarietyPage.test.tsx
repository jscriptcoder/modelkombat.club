import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import VarietyPage from "./VarietyPage";

// A small but representative slice of the variety board: the version-carrying H1, the
// two emphasised orientation lines (provenance + the static §P7 note), and the fenced
// telemetry report — the constructs the real docs/variety.md board is built from. The
// page must turn these into SEMANTIC HTML, never show them as raw markdown text.
//
// The page is PURELY PRESENTATIONAL: it is handed the board markdown as a prop and
// renders it synchronously (the build-time prerender passes in `generateVariety()`).
// There is no fetch, no loading/error state, and no client JS. `v19` here is a fixture
// token, not the live BENCHMARK_VERSION — that coupling lives in the generator's tests.
const VARIETY_FIXTURE = [
  "# Variety board — v19",
  "",
  "_Frozen 6-bot gauntlet · 10 seeds · v19_",
  "",
  "_§P7 soft targets: usage ≤ 35%, opener win ≤ 60%. Scan for ⚠ below._",
  "",
  "```",
  "technique     count  share",
  "gyaku-zuki     2322  31.6%",
  "```",
].join("\n");

describe("VarietyPage", () => {
  it("renders the given variety board markdown as a semantic HTML document", () => {
    const { getByRole, getByText, container } = render(() => (
      <VarietyPage board={VARIETY_FIXTURE} />
    ));

    // The '# ' heading becomes a real <h1> carrying the version...
    expect(
      getByRole("heading", { level: 1, name: /variety board — v19/i }),
    ).toBeTruthy();

    // ...the provenance and §P7 orientation lines render as emphasised prose...
    expect(getByText(/frozen 6-bot gauntlet · 10 seeds · v19/i)).toBeTruthy();
    expect(getByText(/soft targets: usage ≤ 35%/i)).toBeTruthy();

    // ...and the fenced telemetry report becomes <pre><code>, not inline prose.
    const code = container.querySelector("pre code");

    expect(code?.textContent).toContain("gyaku-zuki");
  });

  it("never leaves the raw markdown syntax visible as text", () => {
    const { queryByText } = render(() => (
      <VarietyPage board={VARIETY_FIXTURE} />
    ));

    // The literal '# ...' heading source and the ``` fence markers must not survive.
    expect(queryByText("# Variety board — v19")).toBeNull();
    expect(queryByText(/```/)).toBeNull();
  });
});
