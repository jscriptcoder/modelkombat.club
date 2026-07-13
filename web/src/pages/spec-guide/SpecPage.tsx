import { type Component } from "solid-js";

import { renderMarkdown } from "../../shared/lib/render-markdown";

// The human-readable spec page. It is PURELY PRESENTATIONAL: it is handed the spec
// markdown as a prop and renders it as an HTML document synchronously. The markdown
// is the SAME text the LLM reads from GET /spec — the build-time prerender passes in
// `generateSpec()` — so there is no second copy to drift and no runtime fetch. The
// page ships NO client JS (it is prerendered to static HTML), so there is no
// loading/error state, no Retry, and no client-side title/scroll effect: the static
// <head> owns the tab title, and the browser handles `#section` deep-links natively
// because the content is present in the initial HTML.
//
// It carries NO site chrome — no nav header, no footer. It opens in its own tab as a
// bare reference document the reader consults and closes, so there is nothing to
// navigate to and back from. The markdown→HTML transform (with slug-anchored headings)
// is the shared `renderMarkdown`, reused by the variety board page too.

const SpecPage: Component<{ spec: string }> = (props) => (
  <main>
    <article class="spec-doc" innerHTML={renderMarkdown(props.spec)} />
  </main>
);

export default SpecPage;
