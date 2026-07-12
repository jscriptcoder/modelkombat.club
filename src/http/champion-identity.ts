// A champion's PUBLIC identity — the only projection of an arena member exposed over HTTP. Identity
// fields ONLY: the champion's bot document (its `rules` DSL) is never surfaced, preserving the
// King's competitive edge (decision 5). This is the shared shaper behind `GET /king`'s entries and
// `/fight`'s title `board[].defender` / `displaced` blocks, so the "never leak the doc, default
// provenance to null" knowledge lives in exactly one place.
import type { ArenaMember } from "./throne-store.js";

export type ChampionIdentity = {
  name: string;
  model: string | null;
  handle: string | null;
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

// The public identity of an arena member — the sanitized name + provenance, NEVER the bot document.
// Surfaced as `/king`'s entries and each `board[].defender` (the scouted defenders, board[0] = King)
// / `displaced` (relegated defender) block on a `/fight` placement.
export const memberIdentity = (member: ArenaMember): ChampionIdentity => ({
  name: sanitize(member.champion.name),
  model: member.champion.model == null ? null : sanitize(member.champion.model),
  handle: member.handle == null ? null : sanitize(member.handle),
});
