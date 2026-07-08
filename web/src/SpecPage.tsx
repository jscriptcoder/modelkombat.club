import { Marked, type Renderer, type Tokens } from "marked";
import { type Component } from "solid-js";

import Footer from "./Footer";
import { NavLogo } from "./Nav";

// The human-readable spec page. It is PURELY PRESENTATIONAL: it is handed the spec
// markdown as a prop and renders it as an HTML document synchronously. The markdown
// is the SAME text the LLM reads from GET /spec — the build-time prerender passes in
// `generateSpec()` — so there is no second copy to drift and no runtime fetch. The
// page ships NO client JS (it is prerendered to static HTML), so there is no
// loading/error state, no Retry, and no client-side title/scroll effect: the static
// <head> owns the tab title, and the browser handles `#section` deep-links natively
// because the content is present in the initial HTML.

// The spec is our own generated, same-origin markdown (trusted), so marked's HTML
// is injected directly — there is no untrusted author to sanitise against. If this
// ever renders third-party markdown, run the output through DOMPurify first.
//
// Every heading is given a URL-safe slug id so ANY section is deep-linkable as
// `/spec-guide#slug` (the browser scrolls to it natively). The mechanism is generic,
// not tied to one section. A per-render counter disambiguates repeated heading text
// so ids stay unique.
const renderMarkdown = (markdown: string): string => {
  const seen = new Map<string, number>();

  const slugify = (text: string): string => {
    const base = text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");

    const count = seen.get(base) ?? 0;

    seen.set(base, count + 1);

    return count === 0 ? base : `${base}-${count}`;
  };

  const md = new Marked({
    renderer: {
      heading(this: Renderer, token: Tokens.Heading): string {
        const inner = this.parser.parseInline(token.tokens);

        return `<h${token.depth} id="${slugify(token.text)}">${inner}</h${token.depth}>\n`;
      },
    },
  });

  return md.parse(markdown, { async: false });
};

const SpecPage: Component<{ spec: string }> = (props) => (
  <>
    <nav class="nav" aria-label="Spec">
      <a class="nav-brand" href="/">
        <NavLogo />
        <span>ModelKombat</span>
      </a>
      <div class="nav-links">
        <a href="/spec" target="_blank">
          Raw markdown <span aria-hidden="true">↗</span>
        </a>
      </div>
    </nav>
    <main>
      <article class="spec-doc" innerHTML={renderMarkdown(props.spec)} />
    </main>
    <Footer />
  </>
);

export default SpecPage;
