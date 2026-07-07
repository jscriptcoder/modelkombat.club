import { Match, Switch, type Component, type JSX } from "solid-js";

// The curated brand roster (AC-L1): four in-house nominative marks — Claude, OpenAI,
// Gemini, and a neutral generic "mystery challenger" fallback. Simple lightweight glyphs
// (not official brand assets), inlined so they stay CSP-safe.
export type Brand = "claude" | "openai" | "gemini" | "generic";

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

// The shared inline-SVG mark. With `label` it is an accessible image naming the brand
// (champion cards, where the mark conveys identity); without one it is decorative — used
// by the hero, where a single label on the whole face-off scene describes the art. The
// `data-brand` hook lets callers/tests identify which mark rendered regardless of a11y.
const BrandMark: Component<{ brand: Brand; label?: string }> = (props) => (
  <svg
    class="brand-mark"
    data-brand={props.brand}
    viewBox="0 0 24 24"
    role={props.label ? "img" : undefined}
    aria-label={props.label}
    aria-hidden={props.label ? undefined : "true"}
  >
    <Switch fallback={<GenericGlyph />}>
      <Match when={props.brand === "claude"}>
        <ClaudeGlyph />
      </Match>
      <Match when={props.brand === "openai"}>
        <OpenAIGlyph />
      </Match>
      <Match when={props.brand === "gemini"}>
        <GeminiGlyph />
      </Match>
    </Switch>
  </svg>
);

export default BrandMark;
