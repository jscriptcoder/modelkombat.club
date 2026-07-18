import { type Component } from "solid-js";

import { BRAND_GLYPH, type Brand } from "../lib/brand";

// Re-exported so existing consumers (`import { type Brand } from "./BrandMark"`) keep working;
// the type itself now lives with the brand data in `../lib/brand`.
export type { Brand };

// The shared inline-SVG mark. With `label` it is an accessible image naming the brand (champion
// cards, where the mark conveys identity); without one it is decorative — used by the hero, where
// a single label on the whole face-off scene describes the art. The `data-brand` hook lets
// callers/tests identify which mark rendered regardless of a11y. The glyph geometry comes from the
// shared `BRAND_GLYPH` source (rendered as trusted static markup) so the DOM mark and the Pixi
// replay head draw the exact same shape.
const BrandMark: Component<{ brand: Brand; label?: string }> = (props) => (
  <svg
    class="brand-mark"
    data-brand={props.brand}
    viewBox="0 0 24 24"
    role={props.label ? "img" : undefined}
    aria-label={props.label}
    aria-hidden={props.label ? undefined : "true"}
    innerHTML={BRAND_GLYPH[props.brand]}
  />
);

export default BrandMark;
