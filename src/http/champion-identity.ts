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

// The C0 control range (codes 0–31) and DEL (127). These never carry display meaning but
// can corrupt a terminal / log line or smuggle intent, so any code point in that set is a
// control character to strip.
const CONTROL_MAX = 0x1f;
const DEL = 0x7f;

// Drop control characters from an identity string before it leaves over HTTP. Printable
// characters (incl. spaces and markup like `<script>`) are kept verbatim — the client
// renders those inertly (Solid escapes them). Code-point comparison (not a control-literal
// regex) keeps the boundaries explicit and the source free of embedded control bytes.
const sanitize = (value: string): string =>
  [...value]
    .filter((ch) => {
      const code = ch.charCodeAt(0);

      return code > CONTROL_MAX && code !== DEL;
    })
    .join("");

export const championIdentity = (record: ThroneRecord): ChampionIdentity => ({
  name: sanitize(record.champion.name),
  model: record.champion.model == null ? null : sanitize(record.champion.model),
  handle: record.handle == null ? null : sanitize(record.handle),
  generation: record.generation,
});
