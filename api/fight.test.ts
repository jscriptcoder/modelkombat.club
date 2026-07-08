import { describe, expect, it } from "vitest";

import handler from "./fight.js";
import { LIMITS, validate, type BotDoc } from "../src/engine/dsl.js";
import {
  BENCHMARK_VERSION,
  GAUNTLET_NAMES,
  SEEDS,
} from "../src/engine/benchmark-config.js";

// A complete, well-formed bot (real `BotDoc` type — no redefined schema). It is
// NOT a gauntlet member, so it fights all 6 (no mirror skip). Invalid cases spread
// an override onto it (the handler validates `unknown`, so no assertion is needed).
const validBot = (): BotDoc => ({
  version: 1,
  name: "candidate",
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

type ReportOpponent = {
  name: string;
  winRate: number;
  wins: number;
  losses: number;
  draws: number;
  net: number;
  passed: boolean;
  endReasons: { gap: number; time: number; senshu: number; overtime: number };
};

describe("POST /fight — the stateless gauntlet gate", () => {
  it("scores a valid bot against the frozen gauntlet and returns the report", async () => {
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
      cleared: boolean;
      gauntlet: { seeds: number[]; perOpponent: ReportOpponent[] };
      diagnostics: {
        degrade: Record<
          "unaffordable" | "out-of-band" | "locked" | "inert" | "wrong-context",
          number
        >;
      };
    };

    expect(body.version).toBe(BENCHMARK_VERSION);
    expect(body.gauntlet.seeds).toEqual([...SEEDS]); // fixed + disclosed
    // one entry per frozen gauntlet member, in the frozen order
    expect(body.gauntlet.perOpponent.map((o) => o.name)).toEqual([
      ...GAUNTLET_NAMES,
    ]);

    const fightsPerMember = SEEDS.length * 2; // both sides

    for (const o of body.gauntlet.perOpponent) {
      expect(o.wins + o.losses + o.draws).toBe(fightsPerMember);
      expect(o.winRate).toBeCloseTo(o.wins / fightsPerMember);
      expect(o.passed).toBe(o.winRate > 0.5);

      // every bout ended by exactly one reason ⇒ the reason counts sum to the fights
      const { gap, time, senshu, overtime } = o.endReasons;

      expect(gap + time + senshu + overtime).toBe(fightsPerMember);
    }

    // cleared = the strict >50%-vs-each gate over the derived per-member figures
    const gate =
      body.gauntlet.perOpponent.length === GAUNTLET_NAMES.length &&
      body.gauntlet.perOpponent.every((o) => o.passed);

    expect(body.cleared).toBe(gate);

    // degrade diagnostics: all five reason buckets present and non-negative
    const { degrade } = body.diagnostics;

    expect(Object.keys(degrade).sort()).toEqual([
      "inert",
      "locked",
      "out-of-band",
      "unaffordable",
      "wrong-context",
    ]);

    for (const count of Object.values(degrade)) {
      expect(count).toBeGreaterThanOrEqual(0);
    }

    // no throne yet (S4), and no opponent playbook leaked (visibility principle)
    expect(body).not.toHaveProperty("title");
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
