import { REPLAY_PATH } from "../../shared/lib/paths";
import type { ReplayItem, ReplaySummary } from "./replay-contract";

// The viewer's data load: `GET /replay` (the newest-first list) → take the first (newest) fight →
// `GET /replay/{id}` (its reconstructed tape). Returns `empty` when there are no watchable fights.
// A non-2xx on either call (store 503, a transient item 404, any 5xx) throws — the page turns that
// into the retryable error state. The `fetch` is a parameter so tests drive it with a fake, exactly
// as RingPage injects `postFight`; production binds the real global `fetch`.

export type ReplayLoad =
  | { kind: "empty" }
  | { kind: "ready"; item: ReplayItem };

export type ReplayLoader = (fetchFn?: typeof fetch) => Promise<ReplayLoad>;

const getJson = async <T>(fetchFn: typeof fetch, path: string): Promise<T> => {
  const response = await fetchFn(path);

  if (!response.ok) {
    throw new Error(`GET ${path} → ${response.status}`);
  }

  return (await response.json()) as T;
};

export const loadReplay: ReplayLoader = async (fetchFn = fetch) => {
  const list = await getJson<ReplaySummary[]>(fetchFn, REPLAY_PATH);

  const newest = list[0];

  if (newest === undefined) {
    return { kind: "empty" };
  }

  const item = await getJson<ReplayItem>(
    fetchFn,
    `${REPLAY_PATH}/${newest.id}`,
  );

  return { kind: "ready", item };
};

// The /watch/{id} permalink load: a single `GET /replay/{id}`. A `404` is a first-class
// `not-found` (an evicted / version-rotted / never-existed id — the viewer's no-retry state), NOT
// an error; any other non-2xx throws so the page can offer retry (as the list load does).
export type ReplayByIdLoad =
  | { kind: "found"; item: ReplayItem }
  | { kind: "not-found" };

export type ReplayByIdLoader = (
  id: string,
  fetchFn?: typeof fetch,
) => Promise<ReplayByIdLoad>;

export const loadById: ReplayByIdLoader = async (id, fetchFn = fetch) => {
  const response = await fetchFn(`${REPLAY_PATH}/${id}`);

  if (response.status === 404) {
    return { kind: "not-found" };
  }

  if (!response.ok) {
    throw new Error(`GET ${REPLAY_PATH}/${id} → ${response.status}`);
  }

  return { kind: "found", item: (await response.json()) as ReplayItem };
};
