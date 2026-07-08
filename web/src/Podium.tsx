import { For, Match, Show, Switch, type Component } from "solid-js";

import { createClientResource } from "./client-resource";
import { type Champion } from "./King";
import ModelLogo from "./ModelLogo";

// The recent line of succession, mirroring the `GET /king` `recent` contract — the
// bounded, identity-only tail of the throne's lineage (never the champions' DSL).
type KingResponse = { current: Champion | null; recent: Champion[] };

// Default fetcher: read the live endpoint and project its `recent` array. A non-2xx
// (including a 503 store-unavailable) THROWS — driving the resource's error state,
// deliberately distinct from an empty Hall (a 200 with `recent: []`). Injectable via
// props so tests drive every state deterministically without the network.
const fetchRecentFromApi = async (): Promise<Champion[]> => {
  const res = await fetch("/king");

  if (!res.ok) {
    throw new Error(`/king responded ${res.status}`);
  }

  const body = (await res.json()) as KingResponse;

  return body.recent;
};

// The three podium ranks, gold → bronze. A slot is filled from `recent[i]`, or shown as
// a dimmed placeholder when the succession is shorter (never a fabricated champion).
const RANKS = ["Gold", "Silver", "Bronze"] as const;

const Podium: Component<{ fetchRecent?: () => Promise<Champion[]> }> = (
  props,
) => {
  // Client-only fetch over a prerendered empty-hall fallback (see createClientResource).
  const [recent, { refetch }] = createClientResource(
    props.fetchRecent ?? fetchRecentFromApi,
  );

  return (
    <section
      id="champions"
      class="section champions"
      aria-labelledby="champions-heading"
    >
      <h2 id="champions-heading">Hall of Kings</h2>

      <Switch
        fallback={
          <Show
            when={(recent()?.length ?? 0) > 0}
            fallback={
              <p class="podium-empty">
                No champions have been crowned yet — clear the gauntlet to be
                the first.
              </p>
            }
          >
            <ol class="podium">
              <For each={RANKS}>
                {(rank, i) => {
                  const champion = () => recent()?.[i()];

                  return (
                    <li
                      class={`podium-step ${rank.toLowerCase()}`}
                      classList={{ "podium-step-empty": !champion() }}
                    >
                      <span class="podium-rank">{rank}</span>
                      <Show
                        when={champion()}
                        fallback={
                          <span class="podium-placeholder" aria-hidden="true">
                            —
                          </span>
                        }
                      >
                        {(present) => (
                          <div class="podium-champion">
                            <div class="podium-head">
                              <ModelLogo model={present().model} />
                            </div>
                            <p class="podium-name" title={present().name}>
                              {present().name}
                            </p>
                            <Show when={present().model}>
                              {(model) => <p class="podium-model">{model()}</p>}
                            </Show>
                            <p class="podium-gen">Gen {present().generation}</p>
                            <Show when={present().handle}>
                              {(handle) => (
                                <p class="podium-handle">by {handle()}</p>
                              )}
                            </Show>
                          </div>
                        )}
                      </Show>
                    </li>
                  );
                }}
              </For>
            </ol>
          </Show>
        }
      >
        <Match when={recent.loading}>
          <p role="status" class="podium-status">
            Gathering the champions…
          </p>
        </Match>
        <Match when={recent.error}>
          <div class="podium-error" role="alert">
            <p class="podium-error-line">⚠ Couldn't reach the ring.</p>
            <button type="button" class="retry" onClick={() => void refetch()}>
              Retry
            </button>
          </div>
        </Match>
      </Switch>
    </section>
  );
};

export default Podium;
