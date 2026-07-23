import { describe, expect, it } from "vitest";

import handler from "./fight.js";
import { LIMITS, validate, type BotDoc } from "../src/engine/dsl.js";
import { BENCHMARK_VERSION, SEEDS } from "../src/engine/benchmark-config.js";

// A complete, well-formed bot (real `BotDoc` type — no redefined schema). It is
// NOT a gauntlet member, so it fights all 6 (no mirror skip). Invalid cases spread
// an override onto it (the handler validates `unknown`, so no assertion is needed).
const validBot = (): BotDoc => ({
  version: 1,
  name: "candidate",
  model: "Claude Opus 4.8",
  rules: [
    {
      when: {
        op: "gte",
        args: [
          { op: "field", path: "self.canAct" },
          { op: "const", value: 1 },
        ],
      },
      do: { type: "move", dir: 1 },
    },
  ],
  default: { type: "idle" },
});

const fightRequest = (
  method: string,
  body?: string,
  headers?: Record<string, string>,
): Request =>
  new Request("https://mk.example/fight", { method, body, headers });

// A valid-bot JSON body padded with trailing whitespace to an EXACT length, to
// probe the `LIMITS.maxBytes` boundary (still valid JSON — parses to the same bot).
const validBotBodyOfLength = (length: number): string => {
  const base = JSON.stringify(validBot());

  return base + " ".repeat(length - base.length);
};

type BoardRow = {
  defender: { name: string; model: string | null; handle: string | null };
  winRate: number;
  wins: number;
  losses: number;
  draws: number;
  bouts: number;
  endReasons: { gap: number; time: number; senshu: number; overtime: number };
};

describe("POST /fight — stateless arena placement", () => {
  it("fights a valid bot against the seeded arena directly (no gauntlet gate) and projects its placement", async () => {
    const res = await handler.fetch(
      fightRequest("POST", JSON.stringify(validBot()), {
        "X-Author-Handle": "candidate-author",
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );

    const body = (await res.json()) as {
      version: string;
      projection?: { outcome: string; rank?: number; board?: BoardRow[] };
    };

    expect(body.version).toBe(BENCHMARK_VERSION);
    // the gauntlet gate is gone: the body is { version, title|projection } — no `cleared` verdict,
    // no `gauntlet` scorecard, no `diagnostics` block (S2 drop-the-gauntlet).
    expect(body).not.toHaveProperty("cleared");
    expect(body).not.toHaveProperty("gauntlet");
    // a bare submit PRACTICES by default → a projection, never a committed title
    expect(body).not.toHaveProperty("title");

    // the walk-only bot scores nothing, so against the FULL v20 House seed (three champions) it is
    // unplaced — but it still fought all three, so the projection carries a per-defender board.
    expect(body.projection?.outcome).toBe("unplaced");
    expect(body.projection?.board).toHaveLength(3);

    const boutsPerDefender = SEEDS.length * 2; // both sides

    for (const row of body.projection?.board ?? []) {
      expect(row.wins + row.losses + row.draws).toBe(boutsPerDefender);
      expect(row.winRate).toBeCloseTo(row.wins / boutsPerDefender);

      // every bout ended by exactly one reason ⇒ the reason counts sum to the bouts
      const { gap, time, senshu, overtime } = row.endReasons;

      expect(gap + time + senshu + overtime).toBe(boutsPerDefender);
    }

    // no opponent playbook leaked — the board carries defender IDENTITY only, never the doc
    expect(JSON.stringify(body)).not.toContain('"rules"');
  });

  it("never fights an invalid bot → 422 invalid-bot with the validator issues", async () => {
    const bad = { ...validBot(), version: 2 };

    const res = await handler.fetch(fightRequest("POST", JSON.stringify(bad)));

    expect(res.status).toBe(422);
    expect(res.headers.get("content-type")).toBe(
      "application/problem+json; charset=utf-8",
    );

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.type).toBe("/problems/invalid-bot");
    expect(body.errors).toEqual(validate(bad).issues);
  });

  it("rejects a non-POST method with 405 method-not-allowed and Allow: POST", async () => {
    const res = await handler.fetch(fightRequest("GET"));

    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.type).toBe("/problems/method-not-allowed");
    expect(body.title).toContain("/fight"); // the message names the rejected route
  });

  it("requires the X-Author-Handle header → 400 malformed-request when it is absent", async () => {
    const res = await handler.fetch(
      fightRequest("POST", JSON.stringify(validBot())),
    );

    expect(res.status).toBe(400);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.type).toBe("/problems/malformed-request");
    expect(body.title).toContain("X-Author-Handle");
  });

  it("rejects an unparseable JSON body with 400 malformed-request", async () => {
    const res = await handler.fetch(fightRequest("POST", "{"));

    expect(res.status).toBe(400);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.type).toBe("/problems/malformed-request");
  });

  it("rejects an oversize body with 413 payload-too-large", async () => {
    const res = await handler.fetch(
      fightRequest("POST", validBotBodyOfLength(LIMITS.maxBytes + 1)),
    );

    expect(res.status).toBe(413);

    const body = (await res.json()) as Record<string, unknown>;

    expect(body.type).toBe("/problems/payload-too-large");
  });
});
