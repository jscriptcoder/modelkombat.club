// Classify a non-2xx /fight response into the specific, human-facing state it should drive: a
// validator issue list (422), a throne-moved resubmit (409), a retryable transport error (413/405),
// or a handle-field message (a 400 naming the handle header). Returns null for an unrecognised
// status, so the caller falls back to the generic HTTP banner. Keys on the RFC 9457 problem+json
// the API returns (src/http/envelope.ts): `status` + `type` + `title` (the human string — this
// envelope has no `detail` member) + a validator `errors` array. Pure; tested through RingPage
// behaviour (no standalone web `.ts` runner — see the plan's Testing note).

export type ValidationIssue = { path: string; reason: string };

export type FightError =
  | { kind: "validator"; issues: ValidationIssue[] }
  | { kind: "handle"; message: string }
  | { kind: "throne-moved"; message: string }
  | { kind: "mirror"; message: string }
  | { kind: "transport"; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// The problem's human string — carried as `title` (this envelope has no `detail` member).
const titleOf = (body: unknown): string =>
  isRecord(body) && typeof body.title === "string" ? body.title : "";

// The problem's machine-readable `type` URI — used to split the two 409s (a lost CAS race vs a
// byte-identical arena mirror), which share a status but drive different UI (retry vs edit-the-doc).
const typeOf = (body: unknown): string =>
  isRecord(body) && typeof body.type === "string" ? body.type : "";

// The validator's structured issues (the 422 `errors` array), keeping only well-formed
// { path, reason } entries so a malformed payload can't inject arbitrary shapes into the list.
const issuesOf = (body: unknown): ValidationIssue[] => {
  const errors = isRecord(body) ? body.errors : undefined;

  return Array.isArray(errors)
    ? errors.flatMap((issue) =>
        isRecord(issue) &&
        typeof issue.path === "string" &&
        typeof issue.reason === "string"
          ? [{ path: issue.path, reason: issue.reason }]
          : [],
      )
    : [];
};

export const fightError = (
  status: number,
  body: unknown,
): FightError | null => {
  if (status === 422) {
    return { kind: "validator", issues: issuesOf(body) };
  }

  if (status === 409) {
    // A byte-identical arena mirror (C4) shares 409 with a lost throne CAS but needs a different
    // message + no retry (resubmitting the same bot just 409s again) — split them by `type`.
    return typeOf(body) === "/problems/arena-mirror"
      ? { kind: "mirror", message: titleOf(body) }
      : { kind: "throne-moved", message: titleOf(body) };
  }

  if (status === 413 || status === 405) {
    return { kind: "transport", message: titleOf(body) };
  }

  // A 400 shares one `type` (`/problems/malformed-request`) between a bad handle and a bad body;
  // only the handle case names the header, so route those to the handle field.
  if (status === 400 && titleOf(body).includes("X-Author-Handle")) {
    return { kind: "handle", message: titleOf(body) };
  }

  return null;
};
