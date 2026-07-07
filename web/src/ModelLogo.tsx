import { Match, Switch, type Component, type JSX } from "solid-js";

// The curated brand roster (AC-L1): four in-house nominative marks — Claude, OpenAI,
// Gemini, and a neutral generic "mystery challenger" fallback. These are simple
// lightweight glyphs (not official brand assets), inlined so they stay CSP-safe.
type Brand = "claude" | "openai" | "gemini" | "generic";

// AC-L2: lowercase the free-text model, then substring-match in a FIXED priority order,
// first match wins; no match / empty / absent → generic.
const modelToBrand = (model: string | null | undefined): Brand => {
  const needle = (model ?? "").toLowerCase();

  if (needle.includes("claude")) {
    return "claude";
  }

  // "chatgpt" model ids contain "gpt", so the gpt check covers ChatGPT too.
  if (needle.includes("gpt") || needle.includes("openai")) {
    return "openai";
  }

  if (
    needle.includes("gemini") ||
    needle.includes("google") ||
    needle.includes("bard")
  ) {
    return "gemini";
  }

  return "generic";
};

// AC-L3: each mark is an accessible image naming its authoring brand — never the only
// signal (the model text label accompanies it on the card).
const LABELS: Record<Brand, string> = {
  claude: "authored by Claude",
  openai: "authored by OpenAI",
  gemini: "authored by Gemini",
  generic: "Mystery challenger",
};

// Distinct nominative glyphs, each in its brand's signature hue for at-a-glance identity.
const ClaudeGlyph = (): JSX.Element => (
  <g stroke="#d97757" stroke-width="2.2" stroke-linecap="round">
    <line x1="12" y1="2.5" x2="12" y2="21.5" />
    <line x1="2.5" y1="12" x2="21.5" y2="12" />
    <line x1="5.3" y1="5.3" x2="18.7" y2="18.7" />
    <line x1="18.7" y1="5.3" x2="5.3" y2="18.7" />
  </g>
);

const OpenAIGlyph = (): JSX.Element => (
  <path
    d="M12 2.5 L20.4 7.25 L20.4 16.75 L12 21.5 L3.6 16.75 L3.6 7.25 Z"
    fill="none"
    stroke="#10a37f"
    stroke-width="2.2"
    stroke-linejoin="round"
  />
);

const GeminiGlyph = (): JSX.Element => (
  <path
    d="M12 2 C12 7 12 7 22 12 C12 17 12 17 12 22 C12 17 12 17 2 12 C12 7 12 7 12 2 Z"
    fill="#4285f4"
  />
);

const GenericGlyph = (): JSX.Element => (
  <g fill="none" stroke="#aab2c0" stroke-width="2">
    <circle cx="12" cy="12" r="9" />
    <path
      d="M9.2 9.4 C9.2 7.5 10.6 6.4 12 6.4 C13.5 6.4 14.8 7.4 14.8 9 C14.8 10.9 12 11 12 13.2"
      stroke-linecap="round"
    />
    <circle cx="12" cy="16.6" r="0.5" fill="#aab2c0" stroke="none" />
  </g>
);

// The champion's model → its authoring brand's mark. Renders as an accessible image so
// assistive tech announces the brand while the mark carries the visual identity.
const ModelLogo: Component<{ model: string | null | undefined }> = (props) => {
  const brand = (): Brand => modelToBrand(props.model);

  return (
    <svg
      class="model-logo"
      viewBox="0 0 24 24"
      role="img"
      aria-label={LABELS[brand()]}
    >
      <Switch fallback={<GenericGlyph />}>
        <Match when={brand() === "claude"}>
          <ClaudeGlyph />
        </Match>
        <Match when={brand() === "openai"}>
          <OpenAIGlyph />
        </Match>
        <Match when={brand() === "gemini"}>
          <GeminiGlyph />
        </Match>
      </Switch>
    </svg>
  );
};

export default ModelLogo;
