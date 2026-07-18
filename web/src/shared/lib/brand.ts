// The shared brand source: the single place the five in-house nominative marks (Claude, OpenAI,
// Gemini, Grok, and a neutral generic "mystery challenger") live as data, plus the model → brand
// resolver. Consumed by the DOM `BrandMark` (which strokes each glyph inside its accessible <svg>
// wrapper) and — from make-it-fight story 2, slice 2 — by the Pixi replay head (which parses the
// same markup through `Graphics.svg()`), so the mark can never drift between the home page and the
// viewer. Simple lightweight glyphs (not official brand assets), inlined so they stay CSP-safe.

export type Brand = "claude" | "openai" | "gemini" | "grok" | "generic";

// Each brand's glyph as the INNER SVG markup of a `0 0 24 24` viewBox — distinct nominative
// shapes, each in its brand's signature hue for at-a-glance identity (Grok is monochrome and inks
// to `currentColor` so it flips with the theme). The markup is a trusted constant (never user
// input), rendered as-is by both consumers; keeping it as a string is what lets Pixi's
// `Graphics.svg()` parse the very same geometry the DOM draws.
export const BRAND_GLYPH: Record<Brand, string> = {
  claude:
    '<g stroke="#d97757" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="2.5" x2="12" y2="21.5"/><line x1="2.5" y1="12" x2="21.5" y2="12"/><line x1="5.3" y1="5.3" x2="18.7" y2="18.7"/><line x1="18.7" y1="5.3" x2="5.3" y2="18.7"/></g>',
  openai:
    '<g fill="none" stroke="#10a37f" stroke-linejoin="round" stroke-linecap="round"><path d="M12 2.5 L20.4 7.25 L20.4 16.75 L12 21.5 L3.6 16.75 L3.6 7.25 Z" stroke-width="2.2"/><g stroke-width="1.5"><path d="M12 8.2 L15.36 10.1 L15.36 13.9 L12 15.8 L8.64 13.9 L8.64 10.1 Z"/><line x1="12" y1="2.5" x2="15.36" y2="10.1"/><line x1="20.4" y1="7.25" x2="15.36" y2="13.9"/><line x1="20.4" y1="16.75" x2="12" y2="15.8"/><line x1="12" y1="21.5" x2="8.64" y2="13.9"/><line x1="3.6" y1="16.75" x2="8.64" y2="10.1"/><line x1="3.6" y1="7.25" x2="12" y2="8.2"/></g></g>',
  gemini:
    '<path d="M12 1 C12 8 16 12 23 12 C16 12 12 16 12 23 C12 16 8 12 1 12 C8 12 12 8 12 1 Z" fill="#4285f4"/>',
  grok: '<g fill="currentColor"><circle cx="12" cy="12" r="6.3" fill="none" stroke="currentColor" stroke-width="2.3"/><path d="M3 21 Q14 14 21 3 Q10 10 3 21 Z"/></g>',
  generic:
    '<g fill="none" stroke="#aab2c0" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.2 9.4 C9.2 7.5 10.6 6.4 12 6.4 C13.5 6.4 14.8 7.4 14.8 9 C14.8 10.9 12 11 12 13.2" stroke-linecap="round"/><circle cx="12" cy="16.6" r="0.5" fill="#aab2c0" stroke="none"/></g>',
};

// AC-L2: lowercase the free-text model, then substring-match in a FIXED priority order, first
// match wins; no match / empty / absent → generic. Lives here (not in `ModelLogo`) so the resolver
// is shareable by the viewer head, which also maps a fighter's model to its authoring brand.
export const modelToBrand = (model: string | null | undefined): Brand => {
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

  // xAI's Grok. Current model ids all carry "grok", but the provider is stylized "xAI" and its
  // slug is "x-ai/…", so match those too — note "x-ai" does NOT contain "xai".
  if (
    needle.includes("grok") ||
    needle.includes("xai") ||
    needle.includes("x-ai")
  ) {
    return "grok";
  }

  return "generic";
};
