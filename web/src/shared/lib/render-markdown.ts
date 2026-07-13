import { Marked, type Renderer, type Tokens } from "marked";

// Render trusted, first-party markdown (our own generated spec / variety board) to an
// HTML string, giving every heading a URL-safe slug id so ANY section is deep-linkable
// as `#slug` (the browser scrolls to it natively). The mechanism is generic, not tied to
// one document; a per-render counter disambiguates repeated heading text so ids stay
// unique.
//
// The markdown is our own same-origin content (trusted), so marked's HTML is used
// directly — there is no untrusted author to sanitise against. If this ever renders
// third-party markdown, run the output through DOMPurify first.
export const renderMarkdown = (markdown: string): string => {
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
