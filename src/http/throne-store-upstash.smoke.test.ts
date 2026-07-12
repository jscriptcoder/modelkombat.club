import { afterAll, describe } from "vitest";

import { runThroneStoreContract } from "./throne-store.contract.js";
import { upstashThroneStore } from "./throne-store-upstash.js";

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

    // A raw Upstash REST command (used only to clean up throwaway keys — the store under test owns
    // read/commit). Throws on an error reply so a broken command fails the smoke loudly.
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
        // A small archive bound (3) so the eviction spec exercises the real Lua eviction on live
        // Redis with a handful of commits (the default fetch; K passed as the 3rd arg).
        store: upstashThroneStore(config, undefined, 3),
        versionA,
        versionB,
        archiveLimit: 3,
      };
    });

    afterAll(async () => {
      for (const version of namespaces) {
        await rest(["DEL", `arena:${version}`, `archive:${version}`]);
      }
    });
  },
);
