import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import ModelLogo from "./ModelLogo";

// AC-L1/L2/L3: the model → logo rule lowercases the free-text model and substring-matches
// in a FIXED priority — claude → (gpt|openai|chatgpt) → (gemini|google|bard) — first match
// wins; no match / empty / absent → the neutral "mystery challenger". The mark is an
// accessible image whose name identifies the authoring brand, so we assert the CHOICE
// through the rendered mark's accessible name (behaviour, not the classifier internals).
// This fixture table is exhaustive over the mutation space (every alias, both precedence
// orders, the case-fold, and empty/null/undefined) — the exact-assertion equivalent of a
// Stryker pass, since web-layer logic is outside the Node/Stryker scope.
const CLAUDE = "authored by Claude";
const OPENAI = "authored by OpenAI";
const GEMINI = "authored by Gemini";
const GENERIC = "Mystery challenger";

const cases: ReadonlyArray<readonly [string | null | undefined, string]> = [
  ["claude-opus-4-8", CLAUDE],
  ["claude-3-5-sonnet", CLAUDE],
  ["gpt-4o", OPENAI],
  ["openai/o1", OPENAI],
  ["chatgpt-4o-latest", OPENAI],
  ["gemini-2.5-pro", GEMINI], // gemini alias
  ["google/gemma-2", GEMINI], // google alias — no "gemini" substring, so it uniquely tests it
  ["bard", GEMINI], // bard alias
  ["GPT-4O", OPENAI], // proves the lowercasing (kills a `.toLowerCase()` removal)
  ["gpt-via-gemini", OPENAI], // precedence: gpt is tested before gemini
  ["claude-vs-gpt", CLAUDE], // precedence: claude is tested first of all
  ["weirdmodel", GENERIC],
  ["", GENERIC],
  [null, GENERIC],
  [undefined, GENERIC],
];

describe("ModelLogo", () => {
  it.each(cases)("brands model %o with the mark named %s", (model, name) => {
    const { getByRole } = render(() => <ModelLogo model={model} />);

    expect(getByRole("img", { name })).toBeTruthy();
  });

  it("classifies a hostile model string to the generic mark without injecting markup", () => {
    const { getByRole, container } = render(() => (
      <ModelLogo model="<script>alert(1)</script>" />
    ));

    // Unmatched → generic, and the raw string never becomes live markup or an attribute.
    expect(getByRole("img", { name: GENERIC })).toBeTruthy();
    expect(container.querySelector("script")).toBeNull();
  });
});
