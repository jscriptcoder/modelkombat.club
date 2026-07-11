// The reigning champion's PUBLIC identity — the only projection of a `ThroneRecord`
// exposed over HTTP. Identity fields ONLY: the champion's bot document (its `rules`
// DSL) is never surfaced, preserving the King's competitive edge (decision 5). This is
// the shared shaper behind `GET /king` and `/fight`'s title `incumbent` block, so the
// "never leak the doc, default provenance to null" knowledge lives in exactly one place.
import type { ArenaMember, ThroneRecord } from "./throne-store.js";
import type { BotDoc } from "../engine/dsl.js";

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

// The identity-only projection shared by the King (`championIdentity`) and any arena member
// (`memberIdentity`): the sanitized name + provenance, NEVER the bot document. The generation
// (a throne CAS token) is layered on top only for the King.
const publicIdentity = (source: {
  champion: BotDoc;
  handle?: string | null;
}): Omit<ChampionIdentity, "generation"> => ({
  name: sanitize(source.champion.name),
  model: source.champion.model == null ? null : sanitize(source.champion.model),
  handle: source.handle == null ? null : sanitize(source.handle),
});

export const championIdentity = (record: ThroneRecord): ChampionIdentity => ({
  ...publicIdentity(record),
  generation: record.generation,
});

// The public identity of an arena member — the same never-leak-the-doc projection as the King's,
// without the throne generation (a member carries a seniority stamp, not a CAS token). Surfaced as
// the `displaced` (relegated) defender on a `/fight` placement.
export const memberIdentity = (
  member: ArenaMember,
): Omit<ChampionIdentity, "generation"> => publicIdentity(member);
