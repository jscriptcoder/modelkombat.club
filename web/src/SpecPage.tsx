import { marked } from "marked";
import { createResource, Match, Show, Switch, type Component } from "solid-js";

import Footer from "./Footer";

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
const renderMarkdown = (markdown: string): string =>
  marked.parse(markdown, { async: false });

const SpecPage: Component<{ fetchSpec?: () => Promise<string> }> = (props) => {
  const [spec, { refetch }] = createResource(
    props.fetchSpec ?? fetchSpecFromApi,
  );

  return (
    <>
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
