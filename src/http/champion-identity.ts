// The reigning champion's PUBLIC identity — the only projection of a `ThroneRecord`
// exposed over HTTP. Identity fields ONLY: the champion's bot document (its `rules`
// DSL) is never surfaced, preserving the King's competitive edge (decision 5). This is
// the shared shaper behind `GET /king` and `/fight`'s title `incumbent` block, so the
// "never leak the doc, default provenance to null" knowledge lives in exactly one place.
import type { ThroneRecord } from "./throne-store.js";

export type ChampionIdentity = {
  name: string;
  model: string | null;
  handle: string | null;
  generation: number;
};

export const championIdentity = (record: ThroneRecord): ChampionIdentity => ({
  name: record.champion.name,
  model: record.champion.model ?? null,
  handle: record.handle ?? null,
  generation: record.generation,
});
