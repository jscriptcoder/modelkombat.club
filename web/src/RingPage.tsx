import { createSignal, For, Show, type Component } from "solid-js";

import "./app.css";
import "./ring.css";
import CopyButton from "./CopyButton";
import ModelLogo from "./ModelLogo";
import {
  fightError,
  type FightError,
  type ValidationIssue,
} from "./ring-fight-error";
import { validateHandle } from "./ring-handle";

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

// Parse the pasted document, distinguishing "no input yet" from "malformed JSON" so each gets its
// own message: a trim-empty document → a prompt to paste; a `JSON.parse` throw → the invalid-JSON
// message. Runs before the POST, so neither case ever reaches the ring.
type DocResult = { ok: true; doc: unknown } | { ok: false; error: string };

const parseDoc = (raw: string): DocResult => {
  if (raw.trim() === "") {
    return { ok: false, error: "Paste your bot JSON to continue." };
  }

  try {
    return { ok: true, doc: JSON.parse(raw) };
  } catch {
    return { ok: false, error: "That's not valid JSON." };
  }
};

// The author handle is remembered across visits — a quality-of-life touch (the handle is
// public-if-you-win, not a secret). Reads/writes are wrapped: private-mode or disabled storage
// throws on access, and a remembered handle simply isn't available then (silent degrade).
const HANDLE_STORAGE_KEY = "modelkombat.ring.handle";

const recallHandle = (): string => {
  try {
    return localStorage.getItem(HANDLE_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
};

const rememberHandle = (handle: string): void => {
  try {
    localStorage.setItem(HANDLE_STORAGE_KEY, handle);
  } catch {
    // Storage blocked (private mode / disabled) — the handle just isn't remembered.
  }
};

// One per-opponent scorecard row, shaped from the /fight report's `gauntlet.perOpponent`. Local
// types (not imported from `src/`) keep the web layer decoupled — the King.tsx precedent.
type ScoreRow = { name: string; winRate: number; passed: boolean };

// Extract the per-opponent rows from an unknown /fight body, preserving the report's order (the
// frozen GAUNTLET_NAMES order). A body without a well-formed `gauntlet.perOpponent` — an error
// response, or a shape we don't recognise — yields no rows, so the card simply doesn't render.
const scoreRows = (body: unknown): ScoreRow[] => {
  if (!isRecord(body)) return [];

  const gauntlet = body.gauntlet;

  if (!isRecord(gauntlet) || !Array.isArray(gauntlet.perOpponent)) return [];

  return gauntlet.perOpponent.flatMap((row: unknown) =>
    isRecord(row) &&
    typeof row.name === "string" &&
    typeof row.winRate === "number" &&
    typeof row.passed === "boolean"
      ? [{ name: row.name, winRate: row.winRate, passed: row.passed }]
      : [],
  );
};

// A 0–1 win rate → a whole-number percentage. Bouts run in multiples of 1/20, so the percentage
// is an integer; rounding pins it and clears float noise (0.55 * 100 = 55.00000000000001).
const formatRate = (winRate: number): string => `${Math.round(winRate * 100)}%`;

// The pass/fail signal as TEXT — never colour alone (accessibility). The strict-`>`-half gate is
// already resolved server-side in `passed`; the card only names it.
const resultLabel = (passed: boolean): string => (passed ? "beat" : "lost");

// The scouted incumbent King — identity ONLY. `readIncumbent` extracts exactly these three fields,
// so a payload smuggling extra fields (e.g. the King's `rules` DSL) can never leak into the card.
type Incumbent = { name: string; model: string | null; handle: string | null };

// The title-fight scout: who you faced + how the championship bout went. Absent for the first
// crown (an empty throne has no incumbent to scout).
type TitleScout = { incumbent: Incumbent; winRate: number; bouts: number };

// The title block's view-model. `linksToThrone` is true for the two crownings (the throne is now
// yours to view); false when the King held on (the scout already shows them). `scout` is null only
// for the first crown.
type TitleView = { linksToThrone: boolean; scout: TitleScout | null };

const readIncumbent = (value: unknown): Incumbent | null => {
  if (!isRecord(value) || typeof value.name !== "string") return null;

  return {
    name: value.name,
    model: typeof value.model === "string" ? value.model : null,
    handle: typeof value.handle === "string" ? value.handle : null,
  };
};

// Shape the /fight `title` block into the view-model, or null when there is no well-formed title —
// an uncleared report, an error body, or an unrecognised outcome — so the card omits the block.
const titleView = (body: unknown): TitleView | null => {
  if (!isRecord(body) || !isRecord(body.title)) return null;

  const title = body.title;

  if (title.outcome === "throne-empty-crowned") {
    return { linksToThrone: true, scout: null };
  }

  if (title.outcome === "crowned" || title.outcome === "king-retained") {
    const incumbent = readIncumbent(title.incumbent);

    if (
      incumbent === null ||
      typeof title.winRate !== "number" ||
      typeof title.bouts !== "number"
    ) {
      return null;
    }

    return {
      linksToThrone: title.outcome === "crowned",
      scout: { incumbent, winRate: title.winRate, bouts: title.bouts },
    };
  }

  return null;
};

const RingPage: Component<RingPageProps> = (props) => {
  const [docText, setDocText] = createSignal("");
  const [handle, setHandle] = createSignal(recallHandle());
  const [parseError, setParseError] = createSignal("");
  const [handleError, setHandleError] = createSignal("");
  const [sendError, setSendError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [result, setResult] = createSignal<FightResponse | null>(null);

  // The per-opponent scorecard rows for the current result — empty until a report with a
  // well-formed gauntlet arrives (so an error response renders no card). Derived so the guard
  // and the list read from one source.
  const rows = (): ScoreRow[] => {
    const current = result();

    return current ? scoreRows(current.body) : [];
  };

  // The title-fight view-model for the current result — null until a cleared report with a
  // well-formed title arrives (so uncleared/error results render no title block).
  const title = (): TitleView | null => {
    const current = result();

    return current ? titleView(current.body) : null;
  };

  // The classified error for the current result — null for a 2xx or an unrecognised status (which
  // falls back to the generic banner). Derived so every error branch reads from one source.
  const responseError = (): FightError | null => {
    const current = result();

    return current && !isSuccess(current.status)
      ? fightError(current.status, current.body)
      : null;
  };

  const validatorIssues = (): ValidationIssue[] | null => {
    const err = responseError();

    return err?.kind === "validator" ? err.issues : null;
  };

  const throneMovedMessage = (): string | null => {
    const err = responseError();

    return err?.kind === "throne-moved" ? err.message : null;
  };

  const transportMessage = (): string | null => {
    const err = responseError();

    return err?.kind === "transport" ? err.message : null;
  };

  // The generic HTTP banner shows ONLY for a non-2xx we didn't specifically recognise — so a
  // recognised error's specific message (or the handle-field message) replaces it.
  const showGenericBanner = (): boolean => {
    const current = result();

    return (
      current !== null && !isSuccess(current.status) && responseError() === null
    );
  };

  const runFight = async (): Promise<void> => {
    setParseError("");
    setHandleError("");
    setSendError("");
    setResult(null);

    const parsed = parseDoc(docText());
    const handleCheck = validateHandle(handle());

    if (!parsed.ok) setParseError(parsed.error);
    if (!handleCheck.ok) setHandleError(handleCheck.error);
    if (!parsed.ok || !handleCheck.ok) return;

    // Remember the handle for next time — at POST-fire time, so a returning author never retypes
    // it even if this fight fails.
    rememberHandle(handleCheck.handle);

    const post = props.postFight ?? postFightToApi;

    setLoading(true);

    try {
      const response = await post({
        doc: parsed.doc,
        handle: handleCheck.handle,
      });

      setResult(response);

      // A server-side handle rejection (belt-and-braces — the client already validated) surfaces
      // on the handle field, mirroring the client-side inline error rather than a banner.
      const err = !isSuccess(response.status)
        ? fightError(response.status, response.body)
        : null;

      if (err?.kind === "handle") setHandleError(err.message);
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

        <Show when={handleError()}>
          <p class="ring-handle-error" role="alert">
            {handleError()}
          </p>
        </Show>

        <Show when={parseError()}>
          <p class="ring-error" role="alert">
            {parseError()}
          </p>
        </Show>

        <button type="submit" class="ring-submit" disabled={loading()}>
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
                <>
                  <Show when={validatorIssues()}>
                    {(issues) => (
                      <section
                        class="ring-validator"
                        aria-label="Validation issues"
                      >
                        <p class="ring-validator-intro">
                          The ring rejected this bot. Fix these and resubmit:
                        </p>
                        <ul class="ring-issue-list">
                          <For each={issues()}>
                            {(issue) => (
                              <li class="ring-issue">{`${issue.path}: ${issue.reason}`}</li>
                            )}
                          </For>
                        </ul>
                      </section>
                    )}
                  </Show>

                  <Show when={throneMovedMessage()}>
                    {(message) => (
                      <div class="ring-send-error" role="alert">
                        <p class="ring-send-error-line">{message()}</p>
                        <button
                          type="button"
                          class="retry"
                          onClick={() => void runFight()}
                        >
                          Resubmit
                        </button>
                      </div>
                    )}
                  </Show>

                  <Show when={transportMessage()}>
                    {(message) => (
                      <div class="ring-send-error" role="alert">
                        <p class="ring-send-error-line">{message()}</p>
                        <button
                          type="button"
                          class="retry"
                          onClick={() => void runFight()}
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </Show>

                  <Show when={showGenericBanner()}>
                    <p class="ring-banner">
                      The ring returned an error (HTTP {response().status}) —
                      copy the result below for your LLM.
                    </p>
                  </Show>
                </>
              }
            >
              <p class="ring-headline">{outcomeHeadline(response().body)}</p>
            </Show>

            <Show when={rows().length > 0}>
              <section class="ring-scorecard" aria-label="Gauntlet scorecard">
                <ul class="ring-score-list">
                  <For each={rows()}>
                    {(row) => (
                      <li class="ring-score-row">
                        <code class="ring-score-name">{row.name}</code>
                        <span class="ring-score-rate">
                          {formatRate(row.winRate)}
                        </span>
                        <span
                          class="ring-score-result"
                          classList={{ "ring-score-result-passed": row.passed }}
                        >
                          {resultLabel(row.passed)}
                        </span>
                      </li>
                    )}
                  </For>
                </ul>
              </section>
            </Show>

            <Show when={title()}>
              {(t) => (
                <section class="ring-title-fight" aria-label="Title fight">
                  <Show when={t().linksToThrone}>
                    <a class="ring-throne-link" href="/#king">
                      See the throne
                    </a>
                  </Show>

                  <Show when={t().scout}>
                    {(s) => (
                      <div class="ring-incumbent">
                        <p class="ring-incumbent-label">
                          Title fight vs the King
                        </p>
                        <ModelLogo model={s().incumbent.model} />
                        <code class="ring-incumbent-name">
                          {s().incumbent.name}
                        </code>
                        <Show when={s().incumbent.handle}>
                          {(handle) => (
                            <p class="ring-incumbent-handle">by {handle()}</p>
                          )}
                        </Show>
                        <p class="ring-title-result">
                          <span class="ring-title-winrate">
                            {formatRate(s().winRate)}
                          </span>{" "}
                          across{" "}
                          <span class="ring-title-bouts">{s().bouts}</span>{" "}
                          bouts
                        </p>
                      </div>
                    )}
                  </Show>
                </section>
              )}
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
