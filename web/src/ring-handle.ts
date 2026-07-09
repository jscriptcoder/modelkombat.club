// Client-side author-handle validation for the /ring submit form. Mirrors the server's `readHandle`
// (src/http/handle-fight.ts) so a bad handle is caught BEFORE the POST, and trims surrounding
// whitespace so a stray space never becomes part of the crediting handle. Deliberately STRICTER on
// one point: a whitespace-only handle is rejected here (empty after trim) though the server, which
// doesn't trim, would accept it. Pure; tested through RingPage behaviour (no standalone web `.ts`
// runner — see the plan's Testing note).

export type HandleResult =
  | { ok: true; handle: string }
  | { ok: false; error: string };

// The server's ceiling (handle-fight.ts `HANDLE_MAX`): a handle is valid at 64, rejected at 65.
const HANDLE_MAX = 64;

// A control character by code point — the server's exact predicate: the C0 range (below space)
// plus DEL. A space (0x20) is NOT a control character and is allowed inside a handle.
const hasControlChar = (value: string): boolean =>
  [...value].some((char) => {
    const code = char.charCodeAt(0);

    return code < 0x20 || code === 0x7f;
  });

// Validate a raw handle → the trimmed handle to send, or a human message to show inline. Trim
// first, so a whitespace-only handle reads as empty and the length check measures the real handle;
// then reject empty / over-length / control-bearing handles.
export const validateHandle = (raw: string): HandleResult => {
  const handle = raw.trim();

  if (handle === "") {
    return { ok: false, error: "Add an author handle to enter the ring." };
  }

  if (handle.length > HANDLE_MAX) {
    return { ok: false, error: "Handle must be 64 characters or fewer." };
  }

  if (hasControlChar(handle)) {
    return { ok: false, error: "Handle can't contain control characters." };
  }

  return { ok: true, handle };
};
