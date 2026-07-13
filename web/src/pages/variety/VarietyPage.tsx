import { type Component } from "solid-js";

import { renderMarkdown } from "../../shared/lib/render-markdown";

// The human-readable variety board page. It is PURELY PRESENTATIONAL: it is handed the
// board markdown as a prop and renders it as an HTML document synchronously. The markdown
// is the SAME board committed to docs/variety.md — the build-time prerender passes in
// `generateVariety()` — so there is no second copy to drift and no runtime fetch. The
// page ships NO client JS (it is prerendered to static HTML), so there is no loading/error
// state and no client-side title effect: the static <head> owns the tab title.
//
// It carries NO site chrome — no nav header, no footer. Like /spec-guide it opens in its
// own tab as a bare reference document the reader consults and closes. It reuses the
// `.spec-doc` document typography (the shared rendered-markdown look) so the two reference
// pages read as one site.
const VarietyPage: Component<{ board: string }> = (props) => (
  <main>
    <article class="spec-doc" innerHTML={renderMarkdown(props.board)} />
  </main>
);

export default VarietyPage;
