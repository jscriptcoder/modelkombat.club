import { createSignal, For, Show, type Component } from "solid-js";

import "../../shared/app.css";
import "./ring.css";
import CopyButton from "../../shared/components/CopyButton";
import ModelLogo from "../../shared/components/ModelLogo";
import {
  fightError,
  type FightError,
  type ValidationIssue,
} from "./ring-fight-error";
import { validateHandle } from "./ring-handle";
import { FIGHT_PATH } from "../../shared/lib/paths";

// The result of a POST /fight: the HTTP status plus the parsed JSON body. `body` is `unknown`
// because a non-2xx carries a problem+json, not a report — the human still sees and copies it.
export type FightResponse = { status: number; body: unknown };

type PostFight = (input: {
  doc: unknown;
  handle: string;
  // Whether this POST COMPETES (X-Compete: true — mutate the arena) or is a footprint-free PRACTICE
  // run (evaluate only). A bare submit practices; the claim button opts in.
  compete: boolean;
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
// or the abort rejects. `X-Compete` carries the intent: "false" is a footprint-free PRACTICE run
// (the API's default — evaluate only, write nothing), "true" COMPETES (mutate the arena). A bare
// submit practices; claiming the throne sends "true".
const postFightToApi: PostFight = async ({ doc, handle, compete }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(FIGHT_PATH, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-author-handle": handle,
        "x-compete": compete ? "true" : "false",
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

// A clearer's placement rides back as a committed `title` (it COMPETED and now holds the slot) or a
// footprint-free `projection` (it PRACTICED — a preview of where it would land, mutating nothing).
// Same inner shape either way (C7); the field name is the ground truth, so a consumer keying on
// `title` can't misread a preview as a real crown (API decision #5). `committed` drives every
// present-vs-hypothetical difference below: headline tense, the throne link, and the claim button.
type Placement = { committed: boolean; block: Record<string, unknown> };

const readPlacement = (body: unknown): Placement | null => {
  if (!isRecord(body)) return null;

  if (isRecord(body.title)) return { committed: true, block: body.title };

  if (isRecord(body.projection)) {
    return { committed: false, block: body.projection };
  }

  return null;
};

// The committed headline for a competitor that COMPETED and now holds its placement (C7): crowned
// (a dethrone — the House seed guarantees a non-empty board, so there is no "first King" case),
// entered as a defender, or unplaced.
const committedHeadline = (block: Record<string, unknown>): string => {
  if (block.outcome === "crowned") {
    return "New champion — you dethroned the reigning King! 👑";
  }

  if (block.outcome === "entered") {
    return typeof block.rank === "number"
      ? `You joined the arena at #${block.rank}! ⚔️`
      : "You joined the arena! ⚔️";
  }

  if (block.outcome === "unplaced") {
    return "You fought the champions, but didn't crack the top ranks.";
  }

  return "Fight complete.";
};

// The hypothetical headline for a PRACTICE projection — where the bot WOULD land if it claimed,
// framed in the conditional so a preview never reads as a real result. Same outcome branches.
const projectionHeadline = (block: Record<string, unknown>): string => {
  if (block.outcome === "crowned") {
    return "This bot would dethrone the reigning King. 👑";
  }

  if (block.outcome === "entered") {
    return typeof block.rank === "number"
      ? `This bot would enter the arena at #${block.rank}. ⚔️`
      : "This bot would enter the arena. ⚔️";
  }

  if (block.outcome === "unplaced") {
    return "This bot fought the champions, but wouldn't crack the top ranks.";
  }

  return "This bot fought the champions.";
};

// Map a /fight body to the author-facing headline. There is no gauntlet gate — every valid bot lands
// a placement: committed (it competed) or hypothetical (a practice projection).
const outcomeHeadline = (body: unknown): string => {
  const placement = readPlacement(body);

  if (placement === null) return "Fight complete.";

  return placement.committed
    ? committedHeadline(placement.block)
    : projectionHeadline(placement.block);
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

// A 0–1 win rate → a whole-number percentage. Bouts run in multiples of 1/20, so the percentage
// is an integer; rounding pins it and clears float noise (0.55 * 100 = 55.00000000000001).
const formatRate = (winRate: number): string => `${Math.round(winRate * 100)}%`;

// The per-defender result as TEXT (never colour alone). You "beat" a defender by winning more than
// half the head-to-head bouts — the strict-`>`-half convention arena ranking uses.
const beatLabel = (winRate: number): string =>
  winRate > 0.5 ? "beat" : "lost";

// A scouted defender — identity ONLY. `readIncumbent` extracts exactly these three fields, so a
// payload smuggling extra fields (e.g. the defender's `rules` DSL) can never leak into the card.
type Incumbent = { name: string; model: string | null; handle: string | null };

// One arena-board row: a defender's identity + the challenger's win rate vs it, plus whether it is
// the reigning King (board[0]). The card reads these; the fuller telemetry rides in the raw block.
type BoardRow = { defender: Incumbent; winRate: number; isKing: boolean };

// The placement-block view-model, for a committed title OR a practice projection. `linksToThrone`
// is true only for a COMMITTED crown (the throne is now yours to view) — never on a preview. `board`
// is the per-defender board in rank order (empty for a first crown). `defendersLabel` reads "you
// fought" once committed, "you'd face" on a preview. `claimLabel` is the deliberate opt-in button's
// text — present only on a projection that would take a seat (crowned/entered), null otherwise.
type TitleView = {
  linksToThrone: boolean;
  board: BoardRow[];
  defendersLabel: string;
  claimLabel: string | null;
};

const readIncumbent = (value: unknown): Incumbent | null => {
  if (!isRecord(value) || typeof value.name !== "string") return null;

  return {
    name: value.name,
    model: typeof value.model === "string" ? value.model : null,
    handle: typeof value.handle === "string" ? value.handle : null,
  };
};

// Shape the /fight `title.board` into rows, dropping any entry without a well-formed defender
// identity or numeric win rate (the same identity-only discipline as `readIncumbent`). board[0]
// is the reigning King — the board is rank-ordered.
const readBoard = (value: unknown): BoardRow[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry: unknown, index) => {
    if (!isRecord(entry) || typeof entry.winRate !== "number") return [];

    const defender = readIncumbent(entry.defender);

    return defender === null
      ? []
      : [{ defender, winRate: entry.winRate, isKing: index === 0 }];
  });
};

// The claim button's label for a PRACTICE projection that would take a seat, or null when there is
// nothing to claim (an unplaced preview, or an already-committed title). Outcome-aware so the CTA
// says exactly what the click does: a crown TAKES the throne; an entrant CLAIMS a defender's place.
const claimLabelFor = (committed: boolean, outcome: unknown): string | null => {
  if (committed) return null;
  if (outcome === "crowned") return "Take the throne";
  if (outcome === "entered") return "Claim your place";

  return null;
};

// Shape the /fight placement block (committed `title` or practice `projection`) into the view-model,
// or null when there is nothing to show — an uncleared/error body, an unrecognised outcome, or a
// non-crown with no board AND nothing to claim — so the card omits the section. A committed crown
// always shows (its throne link); a projection that would place always shows (its claim button); any
// placement with a board shows its rows.
const titleView = (body: unknown): TitleView | null => {
  const placement = readPlacement(body);

  if (placement === null) return null;

  const { committed, block } = placement;
  const { outcome, board } = block;

  if (
    outcome !== "crowned" &&
    outcome !== "entered" &&
    outcome !== "unplaced"
  ) {
    return null;
  }

  const rows = readBoard(board);
  const linksToThrone = committed && outcome === "crowned";
  const claimLabel = claimLabelFor(committed, outcome);

  const defendersLabel = committed
    ? "The arena defenders you fought"
    : "The arena defenders you'd face";

  // Nothing to render — no throne link, no board rows, and nothing to claim — omit (graceful degrade).
  return !linksToThrone && rows.length === 0 && claimLabel === null
    ? null
    : { linksToThrone, board: rows, defendersLabel, claimLabel };
};

// A warning triangle. Decorative — the adjacent message text carries the meaning — so it is hidden
// from assistive tech and inlined to stay CSP-safe (the CopyButton ClipboardIcon precedent). Drawn
// with strokes so the exclamation "!" reads on any background; the dot is a zero-length round-capped
// line.
const WarningIcon = () => (
  <svg class="ring-field-error-icon" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 2.2 14.6 13.6H1.4z" />
    <line x1="8" y1="6.2" x2="8" y2="9.6" />
    <line x1="8" y1="11.4" x2="8" y2="11.6" />
  </svg>
);

// One field's inline error slot, rendered directly under its control. Always mounted — even when
// empty — so the form never reflows as the message toggles: the slot reserves one line's height in
// CSS and the message fades in. `role="alert"` is added only when a message is present, so an empty
// slot is silent to assistive tech (and leaves exactly one live alert for the response-error states
// to own).
const FieldError: Component<{ id: string; message: string }> = (props) => (
  <p
    id={props.id}
    class="ring-field-error"
    classList={{ "ring-field-error-shown": props.message !== "" }}
    role={props.message !== "" ? "alert" : undefined}
  >
    <Show when={props.message}>
      <WarningIcon />
      <span class="ring-field-error-text">{props.message}</span>
    </Show>
  </p>
);

const RingPage: Component<RingPageProps> = (props) => {
  const [docText, setDocText] = createSignal("");
  const [handle, setHandle] = createSignal(recallHandle());
  const [parseError, setParseError] = createSignal("");
  const [handleError, setHandleError] = createSignal("");
  const [sendError, setSendError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [result, setResult] = createSignal<FightResponse | null>(null);

  // The title-fight view-model for the current result — null until a placed result with a
  // well-formed title/projection arrives (so error results render no title block).
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

  const mirrorMessage = (): string | null => {
    const err = responseError();

    return err?.kind === "mirror" ? err.message : null;
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

  // Edit a field (doc or handle) AND invalidate any result on screen: a projection's claim button is
  // a promise to compete the exact bot that was previewed, so the moment either input changes, the
  // stale preview (and its claim) must clear — a later claim can never compete a silently-edited bot.
  // The author re-runs practice to get a fresh projection. One rule, shared by both fields.
  const editField = (set: (value: string) => void, value: string): void => {
    set(value);
    setResult(null);
  };

  // Run a /fight, in one of two modes. `compete: false` is the default footprint-free PRACTICE run
  // (a bare submit, and every retry — after a lost throne race, re-previewing the moved arena is the
  // honest next step); `compete: true` is the deliberate claim fired by the projection's claim button.
  const runFight = async (compete: boolean): Promise<void> => {
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
        compete,
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
          void runFight(false);
        }}
      >
        <div class="ring-field">
          <label class="ring-label" for="bot-document">
            Bot document (JSON)
          </label>
          <textarea
            id="bot-document"
            class="ring-textarea"
            rows="7"
            value={docText()}
            onInput={(e) => editField(setDocText, e.currentTarget.value)}
            onFocus={(e) => e.currentTarget.select()}
            aria-invalid={parseError() !== "" ? "true" : undefined}
            aria-describedby="bot-document-error"
          />
          <FieldError id="bot-document-error" message={parseError()} />
        </div>

        <div class="ring-field">
          <label class="ring-label" for="author-handle">
            Author handle
          </label>
          <div class="ring-handle-row">
            <input
              id="author-handle"
              class="ring-input"
              type="text"
              value={handle()}
              onInput={(e) => editField(setHandle, e.currentTarget.value)}
              aria-invalid={handleError() !== "" ? "true" : undefined}
              aria-describedby="author-handle-error"
            />
            <button type="submit" class="ring-submit" disabled={loading()}>
              Send into the ring
            </button>
          </div>
          <p class="ring-handle-note">
            Your handle and bot name are public if you win.
          </p>
          <FieldError id="author-handle-error" message={handleError()} />
        </div>
      </form>

      <Show when={loading()}>
        <p class="ring-status" role="status">
          Fighting the champions — this can take a few seconds.
        </p>
      </Show>

      <Show when={sendError()}>
        <div class="ring-send-error" role="alert">
          <p class="ring-send-error-line">{sendError()}</p>
          <button
            type="button"
            class="retry"
            onClick={() => void runFight(false)}
          >
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
                          onClick={() => void runFight(false)}
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
                          onClick={() => void runFight(false)}
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </Show>

                  <Show when={mirrorMessage()}>
                    {(message) => (
                      <div class="ring-send-error" role="alert">
                        <p class="ring-send-error-line">{message()}</p>
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

            <Show when={title()}>
              {(t) => (
                <section class="ring-title-fight" aria-label="Title fight">
                  <Show when={t().linksToThrone}>
                    <a class="ring-throne-link" href="/#king">
                      See the throne
                    </a>
                  </Show>

                  <Show when={t().board.length > 0}>
                    <p class="ring-defenders-label">{t().defendersLabel}</p>
                    <ul class="ring-defender-list" aria-label="Arena defenders">
                      <For each={t().board}>
                        {(row) => (
                          <li class="ring-defender-row">
                            <ModelLogo model={row.defender.model} />
                            <code class="ring-defender-name">
                              {row.defender.name}
                            </code>
                            <Show when={row.isKing}>
                              <span class="ring-defender-crown">King</span>
                            </Show>
                            <Show when={row.defender.handle}>
                              {(handle) => (
                                <span class="ring-defender-handle">
                                  by {handle()}
                                </span>
                              )}
                            </Show>
                            <span class="ring-defender-rate">
                              {formatRate(row.winRate)}
                            </span>
                            <span
                              class="ring-defender-result"
                              classList={{
                                "ring-defender-result-beat": row.winRate > 0.5,
                              }}
                            >
                              {beatLabel(row.winRate)}
                            </span>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>

                  <Show when={t().claimLabel}>
                    {(label) => (
                      <button
                        type="button"
                        class="ring-claim"
                        disabled={loading()}
                        onClick={() => void runFight(true)}
                      >
                        {label()}
                      </button>
                    )}
                  </Show>
                </section>
              )}
            </Show>

            <div class="ring-raw">
              <pre class="ring-raw-json" aria-label="Raw fight result (JSON)">
                {JSON.stringify(response().body, null, 2)}
              </pre>
              <CopyButton
                value={JSON.stringify(response().body, null, 2)}
                label="Copy result for your LLM"
                copy={props.copy}
              />
            </div>
          </section>
        )}
      </Show>
    </main>
  );
};

export default RingPage;
