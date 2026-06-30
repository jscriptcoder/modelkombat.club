// ============================================================================
// Bot intake for the CLI runner. Untrusted JSON text → a validated BotDoc or the
// structured issues that reject it. EVERY path into the engine goes through the
// real `safeParse` + `validate` gate in dsl.ts (the TCB) — this file adds no
// trust, it only normalises every failure mode (oversize, forbidden key,
// malformed JSON, structural invalidity) into one issue list.
//
// `parseBotDoc` is the single intake: lenient callers branch on the result,
// strict callers (`loadBotDoc`) throw a ValidationError.
// ============================================================================
import {
  safeParse,
  validate,
  ValidationError,
  type BotDoc,
  type ValidationIssue,
} from "../engine/dsl.js";

export type ParsedBot =
  | { ok: true; bot: BotDoc }
  | { ok: false; issues: ValidationIssue[] };

export const parseBotDoc = (text: string): ParsedBot => {
  let doc: unknown;

  try {
    doc = safeParse(text);
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, issues: e.issues };

    // JSON.parse threw a SyntaxError (or similar) — normalise it.
    return {
      ok: false,
      issues: [
        { path: "$", reason: e instanceof Error ? e.message : "invalid JSON" },
      ],
    };
  }

  const res = validate(doc);
  if (!res.ok) return { ok: false, issues: res.issues };

  // Justified assertion: `validate` returning ok is exactly the guarantee that
  // `doc` matches the BotDoc shape — that is what the TCB validator is for.
  return { ok: true, bot: doc as BotDoc };
};

export const loadBotDoc = (text: string): BotDoc => {
  const parsed = parseBotDoc(text);
  if (!parsed.ok) throw new ValidationError(parsed.issues);

  return parsed.bot;
};
