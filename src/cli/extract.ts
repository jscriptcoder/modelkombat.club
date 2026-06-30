// ============================================================================
// Lenient bot-JSON extraction from a raw model reply — the intake stage for the
// `--from-reply` benchmark path. It SELECTS the JSON substring most likely to be
// the bot document; it never parses or validates. The unchanged `safeParse` +
// `validate` gate (the TCB) stays the sole authority on legality, so this adds no
// trust — only a deterministic, model-agnostic choice of which substring to feed
// it. See extract.test.ts for the selection rule.
// ============================================================================

// A markdown fence: ```<info>\n<content>```. Non-greedy content so each block
// matches the smallest span up to its own closing fence. Group 1 = info string,
// group 2 = raw content. The `g` flag is required by `matchAll`.
const FENCE_RE = /```([^\n]*)\n([\s\S]*?)```/g;

// The last fenced block tagged `json` or untagged, with non-empty content.
const fencedCandidate = (text: string): string | null => {
  let last: string | null = null;

  for (const m of text.matchAll(FENCE_RE)) {
    const lang = m[1].trim().toLowerCase();
    if (lang !== "" && lang !== "json") continue;

    const content = m[2].trim();
    if (content === "") continue;

    last = content;
  }

  return last;
};

// The last balanced top-level `{…}` span, ignoring braces inside JSON string
// literals (string state + backslash escapes are tracked so a `{` or `}` in a
// string value never moves the depth).
const lastTopLevelObject = (text: string): string | null => {
  let last: string | null = null;
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
      continue;
    }

    if (ch === "}" && depth > 0) {
      depth--;
      if (depth === 0) last = text.slice(start, i + 1);
    }
  }

  return last;
};

/** The bot-JSON substring most likely intended, or null. Selects; never parses. */
export const extractBotJson = (text: string): string | null =>
  fencedCandidate(text) ?? lastTopLevelObject(text);
