import { cleanup, fireEvent, render, within } from "@solidjs/testing-library";
import { userEvent } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";

import RingPage, { type FightResponse } from "./RingPage";

// This project doesn't enable Vitest `globals`, so @solidjs/testing-library's auto-cleanup never
// registers. Clean up explicitly so each test is isolated — otherwise leaked `id="bot-document"`
// nodes break the label→control accessible-name lookup (which resolves ids against the whole doc).
afterEach(cleanup);

// The handle-prefill tests write to localStorage; reset it between tests so a remembered handle
// from one test can't leak into another's initial render (idempotency — front-end-testing skill).
afterEach(() => localStorage.clear());

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

// A valid bot document for the guard tests (the doc isn't what's under test there — the handle
// / empty-document guards are). Parsed back from its own JSON, it deep-equals this object.
const VALID_DOC = { name: "brawler", model: null, rules: [] };

// Type RAW (unstringified) field values, then submit — for guard tests whose inputs (empty /
// whitespace / untrimmed / control-char) the JSON-stringifying `submit` helper can't express.
const typeAndSend = (
  ui: ReturnType<typeof render>,
  rawDoc: string,
  rawHandle: string,
): void => {
  fireEvent.input(ui.getByRole("textbox", { name: /bot document/i }), {
    target: { value: rawDoc },
  });
  fireEvent.input(ui.getByRole("textbox", { name: /handle/i }), {
    target: { value: rawHandle },
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
        // crowned with NO incumbent ⇒ the first King (D-B: distinguished by incumbent presence)
        body: reportBody({
          cleared: true,
          title: { outcome: "crowned", rank: 1 },
        }),
        headline: /first King/i,
      },
      {
        // crowned WITH an incumbent ⇒ a dethrone
        body: reportBody({
          cleared: true,
          title: { outcome: "crowned", rank: 1, incumbent: INCUMBENT },
        }),
        headline: /new champion/i,
      },
      {
        body: reportBody({
          cleared: true,
          title: { outcome: "entered", rank: 2, incumbent: INCUMBENT },
        }),
        // pins the rank into the headline (not just "joined the arena") — the #-branch guard
        headline: /joined the arena at #2/i,
      },
      {
        body: reportBody({ cleared: true, title: { outcome: "unplaced" } }),
        headline: /didn't crack the top ranks/i,
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
      ui.queryByText(
        /didn't clear|new champion|first King|joined the arena|didn't crack/i,
      ),
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
          // a crown with NO incumbent is the first King (D-B) — the throne is yours, no one to scout
          body: titledBody({ outcome: "crowned", rank: 1 }),
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
    ).toBe("/#king");

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
    ).toBe("/#king");
    // ...and scouts the King you dethroned: model mark (accessible), name, handle...
    expect(within(region).getByRole("img", { name: /claude/i })).toBeTruthy();
    expect(cell(region, ".ring-incumbent-name")).toBe("old-king");
    expect(cell(region, ".ring-incumbent-handle")).toBe("by prev-champ");
    // ...plus the exact title-fight win rate and bout count.
    expect(cell(region, ".ring-title-winrate")).toBe("60%");
    expect(cell(region, ".ring-title-bouts")).toBe("20");
  });

  it("scouts the King you fought when you ENTER the arena as a defender, with no crown link", async () => {
    const ui = render(() => (
      <RingPage
        postFight={resolves({
          status: 200,
          body: titledBody({
            outcome: "entered",
            rank: 2,
            winRate: 0.45,
            bouts: 20,
            incumbent: INCUMBENT,
          }),
        })}
      />
    ));

    submit(ui, { name: "b", model: null, rules: [] }, "h");

    const region = await ui.findByRole("region", { name: /title fight/i });

    // You entered as a defender, so the King you fought is scouted with the title-fight result...
    expect(cell(region, ".ring-incumbent-name")).toBe("old-king");
    expect(cell(region, ".ring-title-winrate")).toBe("45%");
    expect(cell(region, ".ring-title-bouts")).toBe("20");
    // ...but you are not King — no crown link (the ranked podium is a later slice).
    expect(within(region).queryByRole("link", { name: /throne/i })).toBeNull();
  });

  it("scouts the King you fought even when UNPLACED (full parity), with no crown link", async () => {
    const ui = render(() => (
      <RingPage
        postFight={resolves({
          status: 200,
          body: titledBody({
            outcome: "unplaced",
            winRate: 0.2,
            bouts: 20,
            incumbent: INCUMBENT,
          }),
        })}
      />
    ));

    submit(ui, { name: "b", model: null, rules: [] }, "h");

    const region = await ui.findByRole("region", { name: /title fight/i });

    // Full parity: an unplaced clearer still fought the #1 King, so the same scout renders — the
    // King's identity plus the title-fight result...
    expect(cell(region, ".ring-incumbent-name")).toBe("old-king");
    expect(cell(region, ".ring-title-winrate")).toBe("20%");
    expect(cell(region, ".ring-title-bouts")).toBe("20");
    // ...but you did not place — no crown link...
    expect(within(region).queryByRole("link", { name: /throne/i })).toBeNull();
    // ...and the headline still names the miss.
    expect(ui.getByText(/didn't crack the top ranks/i)).toBeTruthy();
  });

  it("shows no title scout for an unplaced clearer whose title omits the King scout (graceful degrade)", async () => {
    const ui = render(() => (
      <RingPage
        postFight={resolves({
          status: 200,
          body: titledBody({ outcome: "unplaced" }),
        })}
      />
    ));

    submit(ui, { name: "b", model: null, rules: [] }, "h");

    // The scorecard proves the cleared result rendered...
    await ui.findByRole("region", { name: /gauntlet scorecard/i });

    // ...but with no incumbent/winRate/bouts in the title, the scout gracefully omits (no crash)...
    expect(ui.queryByRole("region", { name: /title fight/i })).toBeNull();
    expect(ui.queryByRole("link", { name: /throne/i })).toBeNull();
    // ...and the headline names the miss.
    expect(ui.getByText(/didn't crack the top ranks/i)).toBeTruthy();
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

    expect(
      ui.queryByRole("region", { name: /gauntlet scorecard/i }),
    ).toBeNull();
  });
});

// Slice 3 — input guards: the handle is validated + trimmed CLIENT-side (mirroring the server's
// `readHandle`), and an empty/whitespace document is caught with its own message — both BEFORE any
// POST, so a bad handle or no input never contests the throne. All asserted on the injected
// `postFight` (never called on rejection) + the inline message the author sees.
describe("RingPage — input guards: handle + empty document", () => {
  it("trims surrounding whitespace from the handle before sending", () => {
    const postFight = vi.fn(resolves({ status: 200, body: reportBody() }));
    const ui = render(() => <RingPage postFight={postFight} />);

    typeAndSend(ui, JSON.stringify(VALID_DOC), "  grandmaster  ");

    expect(postFight).toHaveBeenCalledWith({
      doc: VALID_DOC,
      handle: "grandmaster",
    });
  });

  it("keeps an internal space in the handle (0x20 is not a control character)", () => {
    const postFight = vi.fn(resolves({ status: 200, body: reportBody() }));
    const ui = render(() => <RingPage postFight={postFight} />);

    typeAndSend(ui, JSON.stringify(VALID_DOC), "ko ga");

    expect(postFight).toHaveBeenCalledWith({ doc: VALID_DOC, handle: "ko ga" });
  });

  it("rejects an empty handle inline without calling the ring", () => {
    const postFight = vi.fn(resolves({ status: 200, body: reportBody() }));
    const ui = render(() => <RingPage postFight={postFight} />);

    typeAndSend(ui, JSON.stringify(VALID_DOC), "");

    expect(ui.getByText(/add an author handle/i)).toBeTruthy();
    expect(postFight).not.toHaveBeenCalled();
  });

  it("rejects a whitespace-only handle inline without calling the ring", () => {
    const postFight = vi.fn(resolves({ status: 200, body: reportBody() }));
    const ui = render(() => <RingPage postFight={postFight} />);

    typeAndSend(ui, JSON.stringify(VALID_DOC), "    ");

    expect(ui.getByText(/add an author handle/i)).toBeTruthy();
    expect(postFight).not.toHaveBeenCalled();
  });

  // The length boundary mirrors the server's `> 64` reject (handle-fight.ts `HANDLE_MAX`): 64 is
  // the last accepted length, 65 the first rejected. The 63/64/65 triplet pins the `<=`/`<` mutant.
  it("accepts a 63-character handle", () => {
    const postFight = vi.fn(resolves({ status: 200, body: reportBody() }));
    const ui = render(() => <RingPage postFight={postFight} />);
    const handle = "a".repeat(63);

    typeAndSend(ui, JSON.stringify(VALID_DOC), handle);

    expect(postFight).toHaveBeenCalledWith({ doc: VALID_DOC, handle });
  });

  it("accepts a 64-character handle (the boundary)", () => {
    const postFight = vi.fn(resolves({ status: 200, body: reportBody() }));
    const ui = render(() => <RingPage postFight={postFight} />);
    const handle = "a".repeat(64);

    typeAndSend(ui, JSON.stringify(VALID_DOC), handle);

    expect(postFight).toHaveBeenCalledWith({ doc: VALID_DOC, handle });
  });

  it("rejects a 65-character handle inline without calling the ring", () => {
    const postFight = vi.fn(resolves({ status: 200, body: reportBody() }));
    const ui = render(() => <RingPage postFight={postFight} />);

    typeAndSend(ui, JSON.stringify(VALID_DOC), "a".repeat(65));

    expect(ui.getByText(/64 characters or fewer/i)).toBeTruthy();
    expect(postFight).not.toHaveBeenCalled();
  });

  it("rejects a handle carrying a control character without calling the ring", () => {
    // NUL/CR/LF never reach here (the Headers transport blocks them); the C0 controls below (US)
    // and DEL do, so the client guard mirrors the server's `code < 0x20 || code === 0x7f`.
    const controls = [
      { label: "US (0x1F)", code: 0x1f },
      { label: "DEL (0x7F)", code: 0x7f },
    ] as const;

    for (const { code } of controls) {
      const postFight = vi.fn(resolves({ status: 200, body: reportBody() }));
      const ui = render(() => <RingPage postFight={postFight} />);

      typeAndSend(
        ui,
        JSON.stringify(VALID_DOC),
        "bad" + String.fromCharCode(code) + "handle",
      );

      expect(ui.getByText(/control characters/i)).toBeTruthy();
      expect(postFight).not.toHaveBeenCalled();

      ui.unmount();
    }
  });

  it("asks for the bot JSON on an empty document without calling the ring", () => {
    const postFight = vi.fn(resolves({ status: 200, body: reportBody() }));
    const ui = render(() => <RingPage postFight={postFight} />);

    typeAndSend(ui, "", "grandmaster");

    expect(ui.getByText(/paste your bot json to continue/i)).toBeTruthy();
    // The no-input case is DISTINCT from malformed JSON — not the "not valid JSON" copy.
    expect(ui.queryByText(/not valid json/i)).toBeNull();
    expect(postFight).not.toHaveBeenCalled();
  });

  it("treats a whitespace-only document as empty", () => {
    const postFight = vi.fn(resolves({ status: 200, body: reportBody() }));
    const ui = render(() => <RingPage postFight={postFight} />);

    typeAndSend(ui, "   \n  ", "grandmaster");

    expect(ui.getByText(/paste your bot json to continue/i)).toBeTruthy();
    expect(postFight).not.toHaveBeenCalled();
  });
});

// Slice 3 — response failure states: a non-2xx is classified (422 validator / 409 throne-moved /
// 413·405 transport / 400 handle) into a precise, human-readable state that REPLACES Slice 1's
// generic banner; an unrecognised status falls back to that banner. The raw copy block persists in
// every case (the LLM-handoff artifact). Expected copy/statuses hardcoded (never imported) as the
// mutation guard — Stryker can't reach web/src (see the plan's Testing note).
describe("RingPage — response failure states", () => {
  it("lists the validator's issues for a 422 and replaces the generic banner", async () => {
    const problem = {
      type: "/problems/invalid-bot",
      title: "The bot document failed validation.",
      status: 422,
      errors: [
        { path: "/rules/0/when", reason: "unknown predicate" },
        { path: "/name", reason: "must be a string" },
      ],
    };

    const ui = render(() => (
      <RingPage postFight={resolves({ status: 422, body: problem })} />
    ));

    submit(ui, VALID_DOC, "grandmaster");

    // Each issue is rendered readably as "path: reason", in the API's order.
    const region = await ui.findByRole("region", {
      name: /validation issues/i,
    });

    const listed = within(region)
      .getAllByRole("listitem")
      .map((li) => li.textContent);

    expect(listed).toEqual([
      "/rules/0/when: unknown predicate",
      "/name: must be a string",
    ]);
    // The specific list replaces the generic HTTP banner...
    expect(ui.queryByText(/the ring returned an error/i)).toBeNull();
    // ...no outcome headline is claimed for an error...
    expect(
      ui.queryByText(
        /didn't clear|new champion|first King|joined the arena|didn't crack/i,
      ),
    ).toBeNull();
    // ...the pasted doc is kept so the author can fix it in place...
    expect(ui.getByRole("textbox", { name: /bot document/i })).toHaveProperty(
      "value",
      JSON.stringify(VALID_DOC),
    );
    // ...and the raw problem+json is still there to copy back to the LLM.
    const raw = await ui.findByLabelText(/raw fight result/i);

    expect(raw.textContent).toBe(JSON.stringify(problem, null, 2));
  });

  it("skips malformed validator issue entries, listing only well-formed ones", async () => {
    const problem = {
      type: "/problems/invalid-bot",
      title: "The bot document failed validation.",
      status: 422,
      errors: [
        { path: "/name", reason: "must be a string" },
        { path: "/rules", note: "missing reason" }, // malformed → skipped
        "not even an object", // malformed → skipped
      ],
    };

    const ui = render(() => (
      <RingPage postFight={resolves({ status: 422, body: problem })} />
    ));

    submit(ui, VALID_DOC, "grandmaster");

    // Only the { path, reason } entry renders — the defensive filter drops the rest (no
    // "undefined: undefined" row), the same identity-only discipline as the incumbent scout.
    const region = await ui.findByRole("region", {
      name: /validation issues/i,
    });

    const listed = within(region)
      .getAllByRole("listitem")
      .map((li) => li.textContent);

    expect(listed).toEqual(["/name: must be a string"]);
  });

  it("prompts a resubmit when the throne moved (409), replacing the banner", async () => {
    const problem = {
      type: "/problems/throne-moved",
      title:
        "The throne advanced to a new champion before your crown landed; resubmit to challenge the current King.",
      status: 409,
    };

    const ui = render(() => (
      <RingPage postFight={resolves({ status: 409, body: problem })} />
    ));

    submit(ui, VALID_DOC, "grandmaster");

    // Scope to the alert: the message also appears verbatim in the raw payload block below (by
    // design — that's the LLM copy), so a bare text query would be ambiguous.
    const alert = await ui.findByRole("alert");

    expect(alert.textContent).toMatch(/throne advanced/i);
    expect(await ui.findByRole("button", { name: /resubmit/i })).toBeTruthy();
    expect(ui.queryByText(/the ring returned an error/i)).toBeNull();
  });

  it("re-enters the ring when the author resubmits after a throne-moved", async () => {
    let calls = 0;

    const flaky = (): Promise<FightResponse> => {
      calls += 1;

      return calls === 1
        ? Promise.resolve({
            status: 409,
            body: {
              type: "/problems/throne-moved",
              title: "The throne advanced; resubmit to challenge the King.",
              status: 409,
            },
          })
        : Promise.resolve({
            status: 200,
            body: reportBody({
              cleared: true,
              title: { outcome: "crowned", rank: 1, incumbent: INCUMBENT },
            }),
          });
    };

    const ui = render(() => <RingPage postFight={flaky} />);

    submit(ui, VALID_DOC, "grandmaster");

    const resubmit = await ui.findByRole("button", { name: /resubmit/i });

    fireEvent.click(resubmit);

    // The second attempt lands the crown; the stale throne-moved prompt is cleared.
    expect(await ui.findByText(/new champion/i)).toBeTruthy();
    expect(ui.queryByText(/throne advanced|resubmit/i)).toBeNull();
  });

  it("shows a retryable transport error for a 413 payload-too-large", async () => {
    const problem = {
      type: "/problems/payload-too-large",
      title: "The bot document exceeds the maximum size.",
      status: 413,
    };

    const ui = render(() => (
      <RingPage postFight={resolves({ status: 413, body: problem })} />
    ));

    submit(ui, VALID_DOC, "grandmaster");

    const alert = await ui.findByRole("alert");

    expect(alert.textContent).toMatch(/exceeds the maximum size/i);
    expect(await ui.findByRole("button", { name: /retry/i })).toBeTruthy();
    expect(ui.queryByText(/the ring returned an error/i)).toBeNull();
  });

  it("shows a retryable transport error for a 405 method-not-allowed", async () => {
    const problem = {
      type: "/problems/method-not-allowed",
      title: "Only POST is supported on /fight.",
      status: 405,
    };

    const ui = render(() => (
      <RingPage postFight={resolves({ status: 405, body: problem })} />
    ));

    submit(ui, VALID_DOC, "grandmaster");

    const alert = await ui.findByRole("alert");

    expect(alert.textContent).toMatch(/only post is supported/i);
    expect(await ui.findByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("falls back to the generic banner for an unrecognized non-2xx", async () => {
    const ui = render(() => (
      <RingPage
        postFight={resolves({
          status: 500,
          body: { type: "about:blank", title: "Internal error" },
        })}
      />
    ));

    submit(ui, VALID_DOC, "grandmaster");

    // 500 isn't a status we specially recognise → the neutral HTTP banner is the fallback.
    expect(
      await ui.findByText(/the ring returned an error \(http 500\)/i),
    ).toBeTruthy();
  });

  it("surfaces a server handle rejection on the handle field, replacing the banner", async () => {
    const problem = {
      type: "/problems/malformed-request",
      title:
        "The X-Author-Handle header must be at most 64 characters and contain no control characters.",
      status: 400,
    };

    // A client-valid handle passes the client gate and POSTs; the (simulated) server rejects it —
    // the belt-and-braces path. The server's message surfaces on the handle field, not a banner.
    const ui = render(() => (
      <RingPage postFight={resolves({ status: 400, body: problem })} />
    ));

    submit(ui, VALID_DOC, "grandmaster");

    // The server message surfaces on the handle field (a role=alert), not a banner. Scope to it —
    // the same text also appears in the raw payload block below.
    const alert = await ui.findByRole("alert");

    expect(alert.textContent).toMatch(/x-author-handle header must be/i);
    expect(ui.queryByText(/the ring returned an error/i)).toBeNull();
  });
});

// Slice 3 — submit lifecycle: the button is disabled while a fight is in flight (no double throne
// contest), and the author's handle is remembered across visits (prefilled from + persisted to
// localStorage on any client-valid submit, per the confirmed decision — regardless of the fight
// outcome). Blocked storage (private mode) degrades silently.
describe("RingPage — submit lifecycle: disable + remembered handle", () => {
  const STORAGE_KEY = "modelkombat.ring.handle";

  it("disables the submit button while a fight is in flight", () => {
    const ui = render(() => <RingPage postFight={pending()} />);
    const button = ui.getByRole("button", { name: /send into the ring/i });

    // Enabled before submit...
    expect(button).toHaveProperty("disabled", false);

    submit(ui, VALID_DOC, "grandmaster");

    // ...disabled while the (never-settling) request is in flight — no second contest possible.
    expect(button).toHaveProperty("disabled", true);
  });

  it("re-enables the submit button once the result is in", async () => {
    const ui = render(() => (
      <RingPage postFight={resolves({ status: 200, body: reportBody() })} />
    ));

    const button = ui.getByRole("button", { name: /send into the ring/i });

    submit(ui, VALID_DOC, "grandmaster");

    await ui.findByLabelText(/raw fight result/i);

    expect(button).toHaveProperty("disabled", false);
  });

  it("prefills the handle from a remembered value", () => {
    localStorage.setItem(STORAGE_KEY, "returning-author");

    const ui = render(() => <RingPage />);

    expect(ui.getByRole("textbox", { name: /handle/i })).toHaveProperty(
      "value",
      "returning-author",
    );
  });

  it("remembers the handle (trimmed) after a valid submit", () => {
    const ui = render(() => (
      <RingPage postFight={resolves({ status: 200, body: reportBody() })} />
    ));

    typeAndSend(ui, JSON.stringify(VALID_DOC), "  keeper  ");

    expect(localStorage.getItem(STORAGE_KEY)).toBe("keeper");
  });

  it("remembers the handle even when the fight fails", () => {
    const ui = render(() => (
      <RingPage postFight={rejectsWith(new Error("offline"))} />
    ));

    submit(ui, VALID_DOC, "persisted-anyway");

    // Persisted at POST-fire time — the handle was valid regardless of the transport failure.
    expect(localStorage.getItem(STORAGE_KEY)).toBe("persisted-anyway");
  });

  it("does not remember an invalid handle", () => {
    const ui = render(() => (
      <RingPage postFight={resolves({ status: 200, body: reportBody() })} />
    ));

    // Empty handle → rejected client-side → no POST, and nothing worth remembering.
    typeAndSend(ui, JSON.stringify(VALID_DOC), "");

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("degrades to an empty handle field when storage reads are blocked", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });

    try {
      const ui = render(() => <RingPage />);

      expect(ui.getByRole("textbox", { name: /handle/i })).toHaveProperty(
        "value",
        "",
      );
    } finally {
      getItem.mockRestore();
    }
  });

  it("still enters the ring when storage writes are blocked", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });

    const postFight = vi.fn(resolves({ status: 200, body: reportBody() }));

    try {
      const ui = render(() => <RingPage postFight={postFight} />);

      submit(ui, VALID_DOC, "grandmaster");

      // A blocked write must not abort the submit — the fight still runs.
      expect(postFight).toHaveBeenCalledWith({
        doc: VALID_DOC,
        handle: "grandmaster",
      });
    } finally {
      setItem.mockRestore();
    }
  });
});

// Inline field errors: a rejected field is flagged on the control itself (aria-invalid, which the
// red border keys off) and its message rides in an always-mounted slot directly under the field —
// mounted even when empty so the form never reflows as the message toggles (reserved space), silent
// to assistive tech until it carries a message, and accompanied by a decorative warning icon.
describe("RingPage — inline field errors", () => {
  // Resolve the element a control points its aria-describedby at (the field's own error slot).
  const describedBy = (
    control: HTMLElement,
    container: Element,
  ): Element | null => {
    const id = control.getAttribute("aria-describedby");

    return id ? container.querySelector(`#${id}`) : null;
  };

  it("flags the bot-document field and describes it with the parse error", () => {
    const postFight = vi.fn(resolves({ status: 200, body: reportBody() }));
    const ui = render(() => <RingPage postFight={postFight} />);

    typeAndSend(ui, "", "grandmaster");

    const textarea = ui.getByRole("textbox", { name: /bot document/i });

    // The control carries the invalid state (what the red border and screen readers read)...
    expect(textarea.getAttribute("aria-invalid")).toBe("true");
    // ...and its described-by slot holds the parse message.
    expect(describedBy(textarea, ui.container)?.textContent).toMatch(
      /paste your bot json to continue/i,
    );
    // The other field, whose handle was valid, is left untouched.
    expect(
      ui.getByRole("textbox", { name: /handle/i }).getAttribute("aria-invalid"),
    ).not.toBe("true");
    // A field-level rejection never contests the throne.
    expect(postFight).not.toHaveBeenCalled();
  });

  it("flags the handle field and describes it with the handle error", () => {
    const postFight = vi.fn(resolves({ status: 200, body: reportBody() }));
    const ui = render(() => <RingPage postFight={postFight} />);

    typeAndSend(ui, JSON.stringify(VALID_DOC), "");

    const input = ui.getByRole("textbox", { name: /handle/i });

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(describedBy(input, ui.container)?.textContent).toMatch(
      /add an author handle/i,
    );
    // The document was valid, so the textarea is not flagged.
    expect(
      ui
        .getByRole("textbox", { name: /bot document/i })
        .getAttribute("aria-invalid"),
    ).not.toBe("true");
  });

  it("shows a decorative warning icon alongside the field error", () => {
    const ui = render(() => <RingPage />);

    typeAndSend(ui, "", "grandmaster");

    const slot = ui.container.querySelector("#bot-document-error");
    const icon = slot?.querySelector(".ring-field-error-icon");

    // The icon accompanies the message but is hidden from assistive tech — the text carries meaning.
    expect(icon).toBeTruthy();
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps both error slots mounted, empty and silent before any submit", () => {
    const ui = render(() => <RingPage />);

    // Neither control is flagged on first paint.
    expect(
      ui
        .getByRole("textbox", { name: /bot document/i })
        .getAttribute("aria-invalid"),
    ).not.toBe("true");
    expect(
      ui.getByRole("textbox", { name: /handle/i }).getAttribute("aria-invalid"),
    ).not.toBe("true");

    const docSlot = ui.container.querySelector("#bot-document-error");
    const handleSlot = ui.container.querySelector("#author-handle-error");

    // Both slots exist up front (reserved space — the form can't jump when a message appears)...
    expect(docSlot).toBeTruthy();
    expect(handleSlot).toBeTruthy();
    // ...but carry no message, no icon, and no alert role until there's something to announce.
    expect(docSlot?.textContent).toBe("");
    expect(handleSlot?.textContent).toBe("");
    expect(docSlot?.getAttribute("role")).toBeNull();
    expect(handleSlot?.getAttribute("role")).toBeNull();
    expect(ui.container.querySelector(".ring-field-error-icon")).toBeNull();
  });

  it("clears the flag and message once a later submit is valid", async () => {
    const ui = render(() => (
      <RingPage postFight={resolves({ status: 200, body: reportBody() })} />
    ));

    typeAndSend(ui, "", "grandmaster");

    const textarea = ui.getByRole("textbox", { name: /bot document/i });

    expect(textarea.getAttribute("aria-invalid")).toBe("true");

    // Fix the document and resubmit — the fresh valid run must clear the stale flag and message.
    typeAndSend(ui, JSON.stringify(VALID_DOC), "grandmaster");

    await ui.findByLabelText(/raw fight result/i);

    expect(textarea.getAttribute("aria-invalid")).not.toBe("true");
    expect(ui.container.querySelector("#bot-document-error")?.textContent).toBe(
      "",
    );
  });
});

// Select-all on focus: the /ring flow is paste-a-new-bot-over-the-last-one (the human couriers each
// LLM revision into the field), so selecting the whole document the moment the field is focused
// means the next paste REPLACES it — no manual select-all-then-delete between iterations. Verified
// in real Chromium (browser mode), where `select()` genuinely sets the selection range.
describe("RingPage — select-all on focus", () => {
  it("selects the entire bot document when the field gains focus", () => {
    const ui = render(() => <RingPage />);
    const textarea = ui.getByRole("textbox", { name: /bot document/i });

    // Narrow to <textarea> so the selection range is readable without a type assertion, and to
    // pin the control's element type (the selection API only exists on text controls).
    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error("expected the bot-document field to be a <textarea>");
    }

    const doc = JSON.stringify(VALID_DOC);

    // A previous bot is sitting in the field from the last iteration...
    fireEvent.input(textarea, { target: { value: doc } });
    // ...and the author focuses it to paste the next revision.
    fireEvent.focus(textarea);

    // The whole previous document is selected (start 0 → end = full length), so the next paste
    // overwrites it outright. Both bounds are asserted: a collapsed caret (start === end) can't
    // satisfy both when the document is non-empty.
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(doc.length);
  });

  // The real workflow is a MOUSE click into the field, not a synthetic focus. A genuine click
  // (real trusted input events via the browser driver) exercises the native mouseup, which on some
  // engines collapses a focus-time selection back to a caret — the classic select-on-focus failure.
  // This pins that the whole document stays selected through a real click, so a mouse-paste
  // overwrites it. fireEvent can't reproduce this path, so it's asserted with a real interaction.
  it("keeps the whole document selected after a real mouse click", async () => {
    const ui = render(() => <RingPage />);
    const textarea = ui.getByRole("textbox", { name: /bot document/i });

    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error("expected the bot-document field to be a <textarea>");
    }

    const doc = JSON.stringify(VALID_DOC);

    fireEvent.input(textarea, { target: { value: doc } });

    await userEvent.click(textarea);

    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(doc.length);
  });
});
