import { afterAll, describe } from "vitest";

import { runThroneStoreContract } from "./throne-store.contract.js";
import { upstashThroneStore } from "./throne-store-upstash.js";
import type { ThroneRecord } from "./throne-store.js";

// Post-deploy smoke: env-gated, so it runs ONLY when live Upstash creds are present (e.g. after
// `vercel env pull`). Skipped in the ordinary suite — the in-memory fake carries the contract
// there; this proves the SAME contract holds on real Redis (persistence + atomic CAS across the
// network). Each case uses a throwaway version namespace + `afterAll` cleanup, so it never
// touches the live `v19` throne (decision D1). Live Redis is intentionally not exercised in CI.
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const live = Boolean(url && token);

describe.skipIf(!live)(
  "upstashThroneStore — live Upstash contract (smoke)",
  () => {
    const config = { url: String(url), token: String(token) };
    const namespaces: string[] = [];

    // A raw Upstash REST command (used only to observe lineage + clean up — the store under test
    // owns read/crown). Throws on an error reply so a broken command fails the smoke loudly.
    const rest = async (command: unknown[]): Promise<unknown> => {
      const res = await fetch(config.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
      });

      const body = (await res.json()) as { result?: unknown; error?: unknown };

      if ("error" in body && body.error !== undefined) {
        throw new Error(`Upstash smoke command failed: ${String(body.error)}`);
      }

      return body.result;
    };

    runThroneStoreContract(() => {
      const ns = crypto.randomUUID();
      const versionA = `smoke-${ns}-a`;
      const versionB = `smoke-${ns}-b`;

      namespaces.push(versionA, versionB);

      return {
        store: upstashThroneStore(config),
        readLineage: async (version) => {
          const entries = (await rest([
            "LRANGE",
            `champions:${version}`,
            "0",
            "-1",
          ])) as string[];

          return entries.map((entry) => JSON.parse(entry) as ThroneRecord);
        },
        versionA,
        versionB,
      };
    });

    afterAll(async () => {
      for (const version of namespaces) {
        await rest(["DEL", `throne:${version}`, `champions:${version}`]);
      }
    });
  },
);
