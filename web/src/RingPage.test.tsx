import { cleanup, fireEvent, render, within } from "@solidjs/testing-library";
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

// The frozen gauntlet order — hardcoded here (NOT imported from the component or engine) so a
// dropped, reordered, or renamed opponent row fails the test. This IS the mutation guard, since
// Stryker can't reach web/src (see the plan's Testing note). Mirrors GAUNTLET_NAMES.
const GAUNTLET_ORDER = [
  "jabber",
  "rekka",
  "zoner",
  "grappler",
  "sweeper",
  "vulture",
] as const;

// One `gauntlet.perOpponent` row (the /fight report shape), overridable per test. The extra
// fields (wins/losses/draws/net/endReasons) ride along verbatim in the raw block; the card reads
// name/winRate/passed.
const opp = (overrides?: Record<string, unknown>): Record<string, unknown> => ({
  name: "jabber",
  winRate: 0.4,
  wins: 8,
  losses: 12,
  draws: 0,
  net: -37,
  passed: false,
  endReasons: {},
  ...overrides,
});

// A six-row scorecard with distinct, exactly-representable win rates and pass/fail flags. `zoner`
// at 0.5 / passed:false pins BOTH the strict-`>` gate (an exact tie doesn't pass) and the
// 50%-boundary win-rate formatting. Duplicated verbatim in each expectation below.
const SCORECARD: ReadonlyArray<{
  name: string;
  winRate: number;
  passed: boolean;
  rate: string;
  result: string;
}> = [
  { name: "jabber", winRate: 0.4, passed: false, rate: "40%", result: "lost" },
  { name: "rekka", winRate: 0.55, passed: true, rate: "55%", result: "beat" },
  { name: "zoner", winRate: 0.5, passed: false, rate: "50%", result: "lost" },
  {
    name: "grappler",
    winRate: 0.65,
    passed: true,
    rate: "65%",
    result: "beat",
  },
  { name: "sweeper", winRate: 0.3, passed: false, rate: "30%", result: "lost" },
  { name: "vulture", winRate: 0.75, passed: true, rate: "75%", result: "beat" },
];

// A well-formed report carrying the six-row scorecard (uncleared by default).
const scoredBody = (
  overrides?: Record<string, unknown>,
): Record<string, unknown> =>
  reportBody({
    gauntlet: {
      seeds: [1, 2, 3],
      perOpponent: SCORECARD.map((row) =>
        opp({ name: row.name, winRate: row.winRate, passed: row.passed }),
      ),
    },
    ...overrides,
  });

// Read a labelled cell's text out of a scorecard row (the per-slot idiom from Gauntlet.test).
const cell = (row: HTMLElement, selector: string): string | null =>
  row.querySelector(selector)?.textContent ?? null;

// A cleared report carrying a `title` block, for the celebration/incumbent-scout tests.
const titledBody = (title: Record<string, unknown>): Record<string, unknown> =>
  scoredBody({ cleared: true, title });

// A scouted incumbent (identity only — the /fight contract never carries the King's DSL).
const INCUMBENT = {
  name: "old-king",
  model: "claude-opus-4",
  handle: "prev-champ",
};

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

// The fight card (Slice 2): the 200 report expands from a bare headline into a per-opponent
// scorecard + a title/incumbent block, while the Slice 1 raw-JSON + Copy block persists below it
// as the machine-readable source of truth. All behavior asserted on what the author sees; the
// expected rows/copy are hardcoded (never imported from the component) as the mutation guard.
describe("RingPage — the fight card", () => {
  it("renders one scorecard row per opponent, in the report's order", async () => {
    const ui = render(() => (
      <RingPage postFight={resolves({ status: 200, body: scoredBody() })} />
    ));

    submit(ui, { name: "b", model: null, rules: [] }, "h");

    const scorecard = await ui.findByRole("region", {
      name: /gauntlet scorecard/i,
    });

    const names = within(scorecard)
      .getAllByRole("listitem")
      .map((row) => cell(row, ".ring-score-name"));

    // Pins BOTH the count (exactly six rows, one per perOpponent entry) and the frozen
    // GAUNTLET_NAMES order — a dropped, extra, or reordered row fails here.
    expect(names).toEqual([...GAUNTLET_ORDER]);
  });

  it("shows each opponent's win rate as a percentage", async () => {
    const ui = render(() => (
      <RingPage postFight={resolves({ status: 200, body: scoredBody() })} />
    ));

    submit(ui, { name: "b", model: null, rules: [] }, "h");

    const scorecard = await ui.findByRole("region", {
      name: /gauntlet scorecard/i,
    });

    const rates = within(scorecard)
      .getAllByRole("listitem")
      .map((row) => cell(row, ".ring-score-rate"));

    // Exact percentages, in order, including the 0.5 → "50%" boundary — pins the `* 100` scaling
    // and rounding so a dropped multiply or an off-by-one rounding mutant fails.
    expect(rates).toEqual(SCORECARD.map((row) => row.rate));
  });

  it("marks each opponent beaten or lost with a text result, never colour alone", async () => {
    const ui = render(() => (
      <RingPage postFight={resolves({ status: 200, body: scoredBody() })} />
    ));

    submit(ui, { name: "b", model: null, rules: [] }, "h");

    const scorecard = await ui.findByRole("region", {
      name: /gauntlet scorecard/i,
    });

    const results = within(scorecard)
      .getAllByRole("listitem")
      .map((row) => cell(row, ".ring-score-result"));

    // The pass/fail signal is carried by "beat"/"lost" TEXT (not colour) — an accessibility
    // requirement AND the mutation guard for a flipped `passed` boolean. `zoner` at exactly 0.5
    // reads "lost" (strict-`>` gate), pinning the boundary.
    expect(results).toEqual(SCORECARD.map((row) => row.result));
  });

  it("celebrates the first crown with a throne link and no incumbent scout", async () => {
    const ui = render(() => (
      <RingPage
        postFight={resolves({
          status: 200,
          body: titledBody({ outcome: "throne-empty-crowned" }),
        })}
      />
    ));

    submit(ui, { name: "b", model: null, rules: [] }, "h");

    const region = await ui.findByRole("region", { name: /title fight/i });

    // The crown links to the (now-yours) throne.
    expect(
      within(region)
        .getByRole("link", { name: /throne/i })
        .getAttribute("href"),
    ).toBe("#king");

    // First King: there was no reigning champion to scout — no win rate / bouts line.
    expect(region.querySelector(".ring-incumbent")).toBeNull();
    expect(within(region).queryByText(/bouts/i)).toBeNull();
  });

  it("scouts the dethroned King on a crown: identity, win rate and bouts", async () => {
    const ui = render(() => (
      <RingPage
        postFight={resolves({
          status: 200,
          body: titledBody({
            outcome: "crowned",
            winRate: 0.6,
            seeds: [7, 8],
            bouts: 20,
            incumbent: INCUMBENT,
          }),
        })}
      />
    ));

    submit(ui, { name: "b", model: null, rules: [] }, "h");

    const region = await ui.findByRole("region", { name: /title fight/i });

    // A crown links to the throne...
    expect(
      within(region)
        .getByRole("link", { name: /throne/i })
        .getAttribute("href"),
    ).toBe("#king");
    // ...and scouts the King you dethroned: model mark (accessible), name, handle...
    expect(within(region).getByRole("img", { name: /claude/i })).toBeTruthy();
    expect(cell(region, ".ring-incumbent-name")).toBe("old-king");
    expect(cell(region, ".ring-incumbent-handle")).toBe("by prev-champ");
    // ...plus the exact title-fight win rate and bout count.
    expect(cell(region, ".ring-title-winrate")).toBe("60%");
    expect(cell(region, ".ring-title-bouts")).toBe("20");
  });

  it("shows the held throne's King and result, with no new-crown link", async () => {
    const ui = render(() => (
      <RingPage
        postFight={resolves({
          status: 200,
          body: titledBody({
            outcome: "king-retained",
            winRate: 0.45,
            seeds: [7, 8],
            bouts: 20,
            incumbent: INCUMBENT,
          }),
        })}
      />
    ));

    submit(ui, { name: "b", model: null, rules: [] }, "h");

    const region = await ui.findByRole("region", { name: /title fight/i });

    // The King held on, so the scout is shown with the losing title-fight result...
    expect(cell(region, ".ring-incumbent-name")).toBe("old-king");
    expect(cell(region, ".ring-title-winrate")).toBe("45%");
    expect(cell(region, ".ring-title-bouts")).toBe("20");
    // ...but the throne didn't change hands — no new-crown link.
    expect(within(region).queryByRole("link", { name: /throne/i })).toBeNull();
  });

  it("omits the by-line and shows a generic mark when the King has no handle or model", async () => {
    const ui = render(() => (
      <RingPage
        postFight={resolves({
          status: 200,
          body: titledBody({
            outcome: "crowned",
            winRate: 0.6,
            seeds: [7, 8],
            bouts: 20,
            incumbent: { name: "anon-king", model: null, handle: null },
          }),
        })}
      />
    ));

    submit(ui, { name: "b", model: null, rules: [] }, "h");

    const region = await ui.findByRole("region", { name: /title fight/i });

    expect(cell(region, ".ring-incumbent-name")).toBe("anon-king");
    // A null handle renders no by-line (King.tsx precedent); a null model → the generic mark.
    expect(region.querySelector(".ring-incumbent-handle")).toBeNull();
    expect(
      within(region).getByRole("img", { name: /mystery challenger/i }),
    ).toBeTruthy();
  });

  it("never renders the scouted King's DSL — identity only", async () => {
    const ui = render(() => (
      <RingPage
        postFight={resolves({
          status: 200,
          body: titledBody({
            outcome: "crowned",
            winRate: 0.6,
            seeds: [7, 8],
            bouts: 20,
            // A hostile payload smuggling the King's rules must never surface.
            incumbent: {
              ...INCUMBENT,
              rules: [{ when: "SMUGGLED_SECRET_RULE", do: "attack" }],
            },
          }),
        })}
      />
    ));

    submit(ui, { name: "b", model: null, rules: [] }, "h");

    const region = await ui.findByRole("region", { name: /title fight/i });

    // Identity still shows, but the DSL never leaks into the card.
    expect(cell(region, ".ring-incumbent-name")).toBe("old-king");
    expect(region.textContent).not.toMatch(/SMUGGLED_SECRET_RULE/);
  });

  it("shows no title block when the bot didn't clear the gauntlet", async () => {
    const ui = render(() => (
      <RingPage postFight={resolves({ status: 200, body: scoredBody() })} />
    ));

    submit(ui, { name: "b", model: null, rules: [] }, "h");

    // The scorecard proves the result rendered — but with no title celebration.
    await ui.findByRole("region", { name: /gauntlet scorecard/i });

    expect(ui.queryByRole("region", { name: /title fight/i })).toBeNull();
    expect(ui.queryByRole("link", { name: /throne/i })).toBeNull();
  });

  it("keeps the complete raw payload below the card as the source of truth", async () => {
    const body = titledBody({
      outcome: "crowned",
      winRate: 0.6,
      seeds: [7, 8],
      bouts: 20,
      incumbent: INCUMBENT,
    });

    const ui = render(() => (
      <RingPage postFight={resolves({ status: 200, body })} />
    ));

    submit(ui, { name: "b", model: null, rules: [] }, "h");

    const scorecard = await ui.findByRole("region", {
      name: /gauntlet scorecard/i,
    });

    const raw = await ui.findByLabelText(/raw fight result/i);

    // The card summarises the human-readable subset, but the raw block remains the byte-exact,
    // complete payload — so the machine detail the card omits (net, endReasons, degrade, seeds)
    // is still there for the author to copy back to their LLM.
    expect(raw.textContent).toBe(JSON.stringify(body, null, 2));

    // ...and it sits BELOW the card (AC-5): the scorecard precedes the raw block in document order.
    expect(
      scorecard.compareDocumentPosition(raw) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders no scorecard when the response carries no opponents", async () => {
    const ui = render(() => (
      <RingPage
        postFight={resolves({
          status: 400,
          body: { type: "/problems/malformed-request", title: "Invalid" },
        })}
      />
    ));

    submit(ui, { name: "b", model: null, rules: [] }, "h");

    // An error (or any body without `gauntlet.perOpponent`) still shows the raw block for the
    // LLM, but there are zero rows — so the scorecard region must not render (an empty scorecard
    // would be noise). Pins the `rows().length > 0` guard against a `>= 0` boundary mutant.
    await ui.findByLabelText(/raw fight result/i);

    expect(ui.queryByRole("region", { name: /gauntlet scorecard/i })).toBeNull();
  });
});
