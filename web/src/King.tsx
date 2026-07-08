import { createResource, Match, Show, Switch, type Component } from "solid-js";

import ModelLogo from "./ModelLogo";

// The identity-only view of the reigning King, mirroring the `GET /king` contract
// (`{ current }`; `recent` lineage arrives in Slice 3). Never the champion's DSL.
export type Champion = {
  name: string;
  model: string | null;
  handle: string | null;
  generation: number;
};

export type KingView = { current: Champion | null };

// Default fetcher: read the live endpoint. A non-2xx (including a 503 store-unavailable)
// THROWS — driving the resource's error state, which is deliberately distinct from an
// empty throne (a 200 `{ current: null }`). Injectable via props so tests drive every
// state deterministically without the network.
const fetchKingFromApi = async (): Promise<KingView> => {
  const res = await fetch("/king");

  if (!res.ok) {
    throw new Error(`/king responded ${res.status}`);
  }

  return (await res.json()) as KingView;
};

const King: Component<{ fetchKing?: () => Promise<KingView> }> = (props) => {
  const [king, { refetch }] = createResource(
    props.fetchKing ?? fetchKingFromApi,
  );

  return (
    <section id="king" class="section king" aria-labelledby="king-heading">
      <h2 id="king-heading">Current King</h2>

      <Switch
        fallback={
          <Show
            when={king()?.current}
            fallback={
              <div class="king-empty">
                <p class="king-empty-line">
                  👑 The throne awaits — be the first to claim it.
                </p>
              </div>
            }
          >
            {(champion) => (
              <div class="king-card">
                <div class="king-head">
                  <ModelLogo model={champion().model} />
                </div>
                <p class="king-name">{champion().name}</p>
                <Show when={champion().model}>
                  {(model) => <p class="king-model">{model()}</p>}
                </Show>
                <p class="king-gen">Gen {champion().generation}</p>
                <Show when={champion().handle}>
                  {(handle) => <p class="king-handle">by {handle()}</p>}
                </Show>
              </div>
            )}
          </Show>
        }
      >
        <Match when={king.loading}>
          <p role="status" class="king-status">
            Summoning the reigning champion…
          </p>
        </Match>
        <Match when={king.error}>
          <div class="king-error" role="alert">
            <p class="king-error-line">⚠ Couldn't reach the ring.</p>
            <button type="button" class="retry" onClick={() => void refetch()}>
              Retry
            </button>
          </div>
        </Match>
      </Switch>
    </section>
  );
};

export default King;
