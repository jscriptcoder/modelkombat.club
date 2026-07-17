import { REPLAY_PATH } from "../../shared/lib/paths";
import type { ReplayItem, ReplaySummary } from "./replay-contract";

// The viewer's data loads, both driven by an injected `fetch` (tests pass a fake — no network —
// exactly as RingPage injects `postFight`; production binds the real global `fetch`).

const getJson = async <T>(fetchFn: typeof fetch, path: string): Promise<T> => {
  const response = await fetchFn(path);

  if (!response.ok) {
    throw new Error(`GET ${path} → ${response.status}`);
  }

  return (await response.json()) as T;
};

// The /watch index load: a single `GET /replay` → the newest-first summary list (order preserved
// verbatim — the API sorts it). An empty list is a first-class `empty` (the honest empty state),
// a non-empty list is `ready`; any non-2xx throws so the page can offer retry.
export type ReplayListLoad =
  | { kind: "empty" }
  | { kind: "ready"; items: ReplaySummary[] };

export type ReplayListLoader = (
  fetchFn?: typeof fetch,
) => Promise<ReplayListLoad>;

export const loadList: ReplayListLoader = async (fetchFn = fetch) => {
  const items = await getJson<ReplaySummary[]>(fetchFn, REPLAY_PATH);

  return items.length === 0 ? { kind: "empty" } : { kind: "ready", items };
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
