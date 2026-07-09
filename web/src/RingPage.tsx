import { createSignal, Show, type Component } from "solid-js";

import "./app.css";
import "./ring.css";
import CopyButton from "./CopyButton";

// The result of a POST /fight: the HTTP status plus the parsed JSON body. `body` is `unknown`
// because a non-2xx carries a problem+json, not a report — the human still sees and copies it.
export type FightResponse = { status: number; body: unknown };

type PostFight = (input: {
  doc: unknown;
  handle: string;
}) => Promise<FightResponse>;

type RingPageProps = {
  // The network seam. Injected in tests to drive every state without a real request, exactly as
  // King injects `fetchKing`; defaults to the live /fight POST below.
  postFight?: PostFight;
  // The clipboard write, forwarded to CopyButton — injected in tests, real clipboard by default.
  copy?: (text: string) => Promise<void>;
};

// A /fight can run ~140 bounded fights plus a cold start, so cap the wait: abort at 30s and let
// the caller surface a timeout rather than spin forever.
const TIMEOUT_MS = 30_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isAbortError = (error: unknown): boolean =>
  isRecord(error) && error.name === "AbortError";

// The default seam: post the document to /fight with the author handle, bounded by a 30s abort.
// A non-2xx still resolves (its problem+json body is meaningful content); only a network failure
// or the abort rejects.
const postFightToApi: PostFight = async ({ doc, handle }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch("/fight", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-author-handle": handle,
      },
      body: JSON.stringify(doc),
      signal: controller.signal,
    });

    const body: unknown = await response.json();

    return { status: response.status, body };
  } finally {
    clearTimeout(timeout);
  }
};

// Map a /fight report body to the author-facing headline. A bot that didn't clear stops at the
// gauntlet; a clearer reads its title outcome (first crown / dethrone / the King held on).
const outcomeHeadline = (body: unknown): string => {
  if (!isRecord(body) || body.cleared !== true) {
    return "Didn't clear the gauntlet.";
  }

  const outcome = isRecord(body.title) ? body.title.outcome : undefined;

  if (outcome === "throne-empty-crowned") {
    return "Cleared the gauntlet — you're the first King! 👑";
  }

  if (outcome === "crowned") {
    return "New champion — you dethroned the reigning King! 👑";
  }

  return "Cleared the gauntlet, but the King held the throne.";
};

const isSuccess = (status: number): boolean => status >= 200 && status < 300;

const RingPage: Component<RingPageProps> = (props) => {
  const [docText, setDocText] = createSignal("");
  const [handle, setHandle] = createSignal("");
  const [parseError, setParseError] = createSignal("");
  const [sendError, setSendError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [result, setResult] = createSignal<FightResponse | null>(null);

  const runFight = async (): Promise<void> => {
    setParseError("");
    setSendError("");
    setResult(null);

    let doc: unknown;

    try {
      doc = JSON.parse(docText());
    } catch {
      setParseError("That's not valid JSON.");

      return;
    }

    const post = props.postFight ?? postFightToApi;

    setLoading(true);

    try {
      setResult(await post({ doc, handle: handle() }));
    } catch (error) {
      setSendError(
        isAbortError(error)
          ? "The ring is taking too long — try again."
          : "Couldn't reach the ring — try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main class="ring" id="top">
      <h1 class="ring-title">Send your bot into the ring</h1>

      <form
        class="ring-form"
        onSubmit={(event) => {
          event.preventDefault();
          void runFight();
        }}
      >
        <label class="ring-label" for="bot-document">
          Bot document (JSON)
        </label>
        <textarea
          id="bot-document"
          class="ring-textarea"
          rows="14"
          value={docText()}
          onInput={(e) => setDocText(e.currentTarget.value)}
        />

        <label class="ring-label" for="author-handle">
          Author handle
        </label>
        <input
          id="author-handle"
          class="ring-input"
          type="text"
          value={handle()}
          onInput={(e) => setHandle(e.currentTarget.value)}
        />
        <p class="ring-handle-note">
          Your handle and bot name are public if you win.
        </p>

        <Show when={parseError()}>
          <p class="ring-error" role="alert">
            {parseError()}
          </p>
        </Show>

        <button type="submit" class="ring-submit">
          Send into the ring
        </button>
      </form>

      <Show when={loading()}>
        <p class="ring-status" role="status">
          Running the gauntlet — this can take a few seconds.
        </p>
      </Show>

      <Show when={sendError()}>
        <div class="ring-send-error" role="alert">
          <p class="ring-send-error-line">{sendError()}</p>
          <button type="button" class="retry" onClick={() => void runFight()}>
            Retry
          </button>
        </div>
      </Show>

      <Show when={result()}>
        {(response) => (
          <section class="ring-result" aria-label="Fight result">
            <Show
              when={isSuccess(response().status)}
              fallback={
                <p class="ring-banner">
                  The ring returned an error (HTTP {response().status}) — copy
                  the result below for your LLM.
                </p>
              }
            >
              <p class="ring-headline">{outcomeHeadline(response().body)}</p>
            </Show>

            <div class="ring-raw">
              <CopyButton
                value={JSON.stringify(response().body, null, 2)}
                label="Copy result for your LLM"
                copy={props.copy}
              />
              <pre class="ring-raw-json" aria-label="Raw fight result (JSON)">
                {JSON.stringify(response().body, null, 2)}
              </pre>
            </div>
          </section>
        )}
      </Show>
    </main>
  );
};

export default RingPage;
