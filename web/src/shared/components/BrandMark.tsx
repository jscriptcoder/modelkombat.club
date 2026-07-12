import { Match, Switch, type Component, type JSX } from "solid-js";

// The curated brand roster (AC-L1): five in-house nominative marks — Claude, OpenAI,
// Gemini, Grok, and a neutral generic "mystery challenger" fallback. Simple lightweight
// glyphs (not official brand assets), inlined so they stay CSP-safe.
export type Brand = "claude" | "openai" | "gemini" | "grok" | "generic";

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
  <g
    fill="none"
    stroke="#10a37f"
    stroke-linejoin="round"
    stroke-linecap="round"
  >
    {/* the outer hexagon silhouette */}
    <path
      d="M12 2.5 L20.4 7.25 L20.4 16.75 L12 21.5 L3.6 16.75 L3.6 7.25 Z"
      stroke-width="2.2"
    />
    {/* the ChatGPT knot's interior: a central hexagon woven to each outer vertex by a
        rotationally-offset spoke — a six-fold pinwheel suggesting the interlaced strands */}
    <g stroke-width="1.5">
      <path d="M12 8.2 L15.36 10.1 L15.36 13.9 L12 15.8 L8.64 13.9 L8.64 10.1 Z" />
      <line x1="12" y1="2.5" x2="15.36" y2="10.1" />
      <line x1="20.4" y1="7.25" x2="15.36" y2="13.9" />
      <line x1="20.4" y1="16.75" x2="12" y2="15.8" />
      <line x1="12" y1="21.5" x2="8.64" y2="13.9" />
      <line x1="3.6" y1="16.75" x2="8.64" y2="10.1" />
      <line x1="3.6" y1="7.25" x2="12" y2="8.2" />
    </g>
  </g>
);

const GeminiGlyph = (): JSX.Element => (
  // A four-point spark: symmetric sharp points with deep concave sides (each edge bows
  // toward centre via two on-axis control points), flat blue — no gradient.
  <path
    d="M12 1 C12 8 16 12 23 12 C16 12 12 16 12 23 C12 16 8 12 1 12 C8 12 12 8 12 1 Z"
    fill="#4285f4"
  />
);

// xAI's Grok mark, nominative (not the official asset): a ring cut by a sharp diagonal
// blade — a slashed circle (∅). Grok's identity is monochrome (white on dark, dark on
// light), so unlike the fixed-hue marks it uses `currentColor` — inheriting the card's
// foreground (near-white on our dark theme; it would flip with the theme automatically).
const GrokGlyph = (): JSX.Element => (
  <g fill="currentColor">
    <circle
      cx="12"
      cy="12"
      r="6.3"
      fill="none"
      stroke="currentColor"
      stroke-width="2.3"
    />
    <path d="M3 21 Q14 14 21 3 Q10 10 3 21 Z" />
  </g>
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
      <Match when={props.brand === "grok"}>
        <GrokGlyph />
      </Match>
    </Switch>
  </svg>
);

export default BrandMark;
