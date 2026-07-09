import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import RingPage, { type FightResponse } from "./RingPage";

// This project doesn't enable Vitest `globals`, so @solidjs/testing-library's auto-cleanup never
// registers. Clean up explicitly so each test is isolated — otherwise leaked `id="bot-document"`
// nodes break the label→control accessible-name lookup (which resolves ids against the whole doc).
afterEach(cleanup);

// A well-formed /fight report body, overridable per test. `title` is added only for cleared bots.
const reportBody = (
  overrides?: Record<string, unknown>,
): Record<string, unknown> => ({
  version: "v19",
  cleared: false,
  gauntlet: { seeds: [1, 2, 3], perOpponent: [] },
  diagnostics: { degrade: {} },
  ...overrides,
});

// A `postFight` stub resolving a given HTTP status + body — the injected network seam.
const resolves =
  (response: FightResponse): (() => Promise<FightResponse>) =>
  () =>
    Promise.resolve(response);

// A `postFight` that never settles — holds the in-flight (loading) state.
const pending = (): (() => Promise<FightResponse>) => () =>
  new Promise<FightResponse>(() => {});

// A `postFight` that rejects with a given error — drives the transport-error states.
const rejectsWith =
  (error: unknown): (() => Promise<FightResponse>) =>
  () =>
    Promise.reject(error);

// Drive a full valid submission: type the doc + handle, then click "Send into the ring".
const submit = (
  ui: ReturnType<typeof render>,
  doc: unknown,
  handle: string,
): void => {
  fireEvent.input(ui.getByRole("textbox", { name: /bot document/i }), {
    target: { value: JSON.stringify(doc) },
  });
  fireEvent.input(ui.getByRole("textbox", { name: /handle/i }), {
    target: { value: handle },
  });
  fireEvent.click(ui.getByRole("button", { name: /send into the ring/i }));
};

// The /ring submit surface: paste an LLM-authored bot document + an author handle, send it into
// the ring, and see the outcome + the raw /fight response to hand back to the LLM. The network is
// a `postFight` prop seam (default posts to /fight) so these browser-mode tests drive every state
// without a real request — the same injection pattern as King (`fetchKing`) and CopyButton (`copy`).

describe("RingPage — the /ring submit surface", () => {
  it("renders the bot-document field, the handle field, and the submit button", () => {
    const { getByRole } = render(() => <RingPage />);

    // A screen-reader user reaches each control by its accessible name (label → control).
    expect(getByRole("textbox", { name: /bot document/i })).toBeTruthy();
    expect(getByRole("textbox", { name: /handle/i })).toBeTruthy();
    expect(getByRole("button", { name: /send into the ring/i })).toBeTruthy();
  });

  it("warns that the handle and bot name become public on a win", () => {
    const { getByText } = render(() => <RingPage />);

    // Sets expectations before submission — the handle is unverified and shown publicly if crowned.
    expect(getByText(/public if you win/i)).toBeTruthy();
  });

  it("sends the parsed bot document and handle into the ring on submit", () => {
    const postFight = vi.fn(resolves({ status: 200, body: reportBody() }));
    const ui = render(() => <RingPage postFight={postFight} />);
    const doc = { name: "brawler", model: null, rules: [] };

    submit(ui, doc, "grandmaster");

    // The seam receives the PARSED document (not the raw string) and the typed handle.
    expect(postFight).toHaveBeenCalledWith({ doc, handle: "grandmaster" });
  });

  it("announces the outcome for each fight result", async () => {
    const cases: ReadonlyArray<{
      body: Record<string, unknown>;
      headline: RegExp;
    }> = [
      {
        body: reportBody({ cleared: false }),
        headline: /didn't clear the gauntlet/i,
      },
      {
        body: reportBody({
          cleared: true,
          title: { outcome: "throne-empty-crowned" },
        }),
        headline: /first King/i,
      },
      {
        body: reportBody({ cleared: true, title: { outcome: "crowned" } }),
        headline: /new champion/i,
      },
      {
        body: reportBody({
          cleared: true,
          title: { outcome: "king-retained" },
        }),
        headline: /King held the throne/i,
      },
    ];

    for (const { body, headline } of cases) {
      const ui = render(() => (
        <RingPage postFight={resolves({ status: 200, body })} />
      ));

      submit(ui, { name: "b", model: null, rules: [] }, "h");

      expect(await ui.findByText(headline)).toBeTruthy();

      ui.unmount();
    }
  });

  it("shows the raw /fight response as pretty JSON for the author to inspect", async () => {
    const body = reportBody({ cleared: true, title: { outcome: "crowned" } });

    const ui = render(() => (
      <RingPage postFight={resolves({ status: 200, body })} />
    ));

    submit(ui, { name: "b", model: null, rules: [] }, "h");

    // The exact machine-readable payload is shown verbatim (2-space pretty-printed) to hand back.
    // Compare textContent directly — Testing Library's text matchers collapse whitespace, which
    // would hide the newlines/indentation that make this copyable.
    const raw = await ui.findByLabelText(/raw fight result/i);

    expect(raw.textContent).toBe(JSON.stringify(body, null, 2));
    // Once the result is in, the in-flight status is gone (no stuck "running…" spinner).
    expect(ui.queryByText(/running the gauntlet/i)).toBeNull();
  });

  it("copies the exact pretty-printed response for handing back to the LLM", async () => {
    const copy = vi.fn(() => Promise.resolve());
    const body = reportBody({ cleared: false });

    const ui = render(() => (
      <RingPage postFight={resolves({ status: 200, body })} copy={copy} />
    ));

    submit(ui, { name: "b", model: null, rules: [] }, "h");

    const copyButton = await ui.findByRole("button", { name: /copy .*llm/i });

    fireEvent.click(copyButton);

    expect(copy).toHaveBeenCalledWith(JSON.stringify(body, null, 2));
  });

  it("rejects invalid JSON inline without calling the ring", () => {
    const postFight = vi.fn(resolves({ status: 200, body: reportBody() }));
    const ui = render(() => <RingPage postFight={postFight} />);

    fireEvent.input(ui.getByRole("textbox", { name: /bot document/i }), {
      target: { value: "{ not valid json" },
    });
    fireEvent.input(ui.getByRole("textbox", { name: /handle/i }), {
      target: { value: "h" },
    });
    fireEvent.click(ui.getByRole("button", { name: /send into the ring/i }));

    expect(ui.getByText(/not valid json/i)).toBeTruthy();
    expect(postFight).not.toHaveBeenCalled();
  });

  it("shows an in-flight status while the fight runs", async () => {
    const ui = render(() => <RingPage postFight={pending()} />);

    submit(ui, { name: "b", model: null, rules: [] }, "h");

    // A live region sets expectations during the (multi-second) gauntlet run.
    const status = await ui.findByRole("status");

    expect(status.textContent).toMatch(/running the gauntlet/i);
  });

  it("surfaces a timeout with a retry when the fight aborts", async () => {
    const ui = render(() => (
      <RingPage
        postFight={rejectsWith(new DOMException("aborted", "AbortError"))}
      />
    ));

    submit(ui, { name: "b", model: null, rules: [] }, "h");

    // An AbortError (the 30s ceiling firing) reads as a distinct timeout, not a generic failure.
    expect(await ui.findByText(/taking too long/i)).toBeTruthy();
    expect(await ui.findByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("surfaces a generic transport error with a retry on network failure", async () => {
    const ui = render(() => (
      <RingPage postFight={rejectsWith(new Error("offline"))} />
    ));

    submit(ui, { name: "b", model: null, rules: [] }, "h");

    expect(await ui.findByText(/couldn't reach the ring/i)).toBeTruthy();
    expect(await ui.findByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("re-runs the fight when the author retries after a failure", async () => {
    let calls = 0;

    const flaky = (): Promise<FightResponse> => {
      calls += 1;

      return calls === 1
        ? Promise.reject(new Error("offline"))
        : Promise.resolve({
            status: 200,
            body: reportBody({ cleared: false }),
          });
    };

    const ui = render(() => <RingPage postFight={flaky} />);

    submit(ui, { name: "b", model: null, rules: [] }, "h");

    const retry = await ui.findByRole("button", { name: /retry/i });

    fireEvent.click(retry);

    // The second attempt succeeds and the outcome REPLACES the error — the stale failure
    // message must be cleared, not left sitting above the fresh result.
    expect(await ui.findByText(/didn't clear the gauntlet/i)).toBeTruthy();
    expect(ui.queryByText(/couldn't reach the ring/i)).toBeNull();
  });

  it("shows a neutral banner and the raw body for a non-2xx response", async () => {
    const problem = {
      type: "/problems/malformed-request",
      title: "Invalid bot document",
      issues: [{ path: "/rules", message: "required" }],
    };

    const ui = render(() => (
      <RingPage postFight={resolves({ status: 400, body: problem })} />
    ));

    submit(ui, { name: "b", model: null, rules: [] }, "h");

    // A non-2xx is framed neutrally, with the raw problem+json still shown to copy for the LLM...
    expect(
      await ui.findByText(/the ring returned an error \(http 400\)/i),
    ).toBeTruthy();

    const raw = await ui.findByLabelText(/raw fight result/i);

    expect(raw.textContent).toBe(JSON.stringify(problem, null, 2));

    // ...but no outcome headline is claimed for an error response.
    expect(
      ui.queryByText(/didn't clear|new champion|first King|held the throne/i),
    ).toBeNull();
  });

  it("posts the bot to /fight with the author-handle header by default", async () => {
    const body = reportBody({ cleared: false });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    try {
      const ui = render(() => <RingPage />);
      const doc = { name: "brawler", model: null, rules: [] };

      submit(ui, doc, "grandmaster");

      // Waiting for the rendered outcome proves the default seam actually posted and parsed.
      expect(await ui.findByText(/didn't clear the gauntlet/i)).toBeTruthy();

      expect(fetchSpy).toHaveBeenCalledWith(
        "/fight",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "x-author-handle": "grandmaster",
          }),
          body: JSON.stringify(doc),
          signal: expect.anything(),
        }),
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
