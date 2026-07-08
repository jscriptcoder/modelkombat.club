import { Marked, type Renderer, type Tokens } from "marked";
import {
  createEffect,
  createResource,
  Match,
  Show,
  Switch,
  type Component,
} from "solid-js";

import Footer from "./Footer";
import { NavLogo } from "./Nav";

// The rendered document's own tab title — the spec is a distinct page from the
// marketing home, so it names itself rather than inheriting the home title.
const SPEC_PAGE_TITLE = "ModelKombat — Bot authoring spec";

// The human-readable spec page: it fetches the SAME markdown the LLM reads from
// GET /spec and renders it as an HTML document, so there is no second copy of the
// spec to drift. States mirror the King card: loading → status, failure → a
// distinct alert with Retry, success → the rendered document.

// Default fetcher: read the live /spec markdown. A non-2xx THROWS, driving the
// resource's error state (deliberately distinct from a rendered document).
// Injectable via props so tests drive every state deterministically.
const fetchSpecFromApi = async (): Promise<string> => {
  const res = await fetch("/spec");

  if (!res.ok) {
    throw new Error(`/spec responded ${res.status}`);
  }

  return res.text();
};

// The spec is our own generated, same-origin markdown (trusted), so marked's HTML
// is injected directly — there is no untrusted author to sanitise against. If this
// ever renders third-party markdown, run the output through DOMPurify first.
//
// Every heading is given a URL-safe slug id so ANY section is deep-linkable as
// `/spec-guide#slug` (see the scroll-to-hash effect below) — the mechanism is
// generic, not tied to one section. A per-render counter disambiguates repeated
// heading text so ids stay unique, and building the counter fresh each call means
// a Retry re-render starts clean rather than accumulating "-1" suffixes.
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

const SpecPage: Component<{ fetchSpec?: () => Promise<string> }> = (props) => {
  document.title = SPEC_PAGE_TITLE;

  const [spec, { refetch }] = createResource(
    props.fetchSpec ?? fetchSpecFromApi,
  );

  // Once the fetched document is in the DOM, honour a `#section` hash in the URL
  // by scrolling that heading into view. The browser's native hash-scroll fires
  // on navigation — before the async content exists — so the page does it itself.
  // Gate on `state === "ready"` (not `spec()`, which re-throws in the error state).
  createEffect(() => {
    if (spec.state !== "ready") {
      return;
    }

    const id = window.location.hash.slice(1);

    if (id) {
      document.getElementById(id)?.scrollIntoView();
    }
  });

  return (
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
        <Switch
          fallback={
            <Show when={spec()}>
              {(markdown) => (
                <article
                  class="spec-doc"
                  innerHTML={renderMarkdown(markdown())}
                />
              )}
            </Show>
          }
        >
          <Match when={spec.loading}>
            <p role="status" class="spec-status">
              Loading the spec…
            </p>
          </Match>
          <Match when={spec.error}>
            <div class="spec-error" role="alert">
              <p class="spec-error-line">⚠ Couldn't load the spec.</p>
              <button
                type="button"
                class="retry"
                onClick={() => void refetch()}
              >
                Retry
              </button>
            </div>
          </Match>
        </Switch>
      </main>
      <Footer />
    </>
  );
};

export default SpecPage;
