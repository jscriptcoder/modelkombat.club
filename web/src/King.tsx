import { Match, Show, Switch, type Component } from "solid-js";

import ModelLogo from "./ModelLogo";

// The identity-only view of a champion, mirroring the `GET /king` contract. Never the
// champion's bot DSL.
export type Champion = {
  name: string;
  model: string | null;
  handle: string | null;
  generation: number;
};

// Presentational: the King section renders the reigning champion — or the empty throne,
// loading, or error state — from props. The single `/king` fetch lives in App, which
// feeds this section AND the Hall of Kings from ONE request (see App). Every prop is
// optional so the build-time prerender (`<King />` with no props) renders the empty
// throne, matching the client's first hydrated frame.
type KingProps = {
  current?: Champion | null;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
};

const King: Component<KingProps> = (props) => {
  return (
    <section id="king" class="section king" aria-labelledby="king-heading">
      <h2 id="king-heading">Current King</h2>

      <Switch
        fallback={
          <Show
            when={props.current}
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
        <Match when={props.loading}>
          <p role="status" class="king-status">
            Summoning the reigning champion…
          </p>
        </Match>
        <Match when={props.error}>
          <div class="king-error" role="alert">
            <p class="king-error-line">⚠ Couldn't reach the ring.</p>
            <button
              type="button"
              class="retry"
              onClick={() => props.onRetry?.()}
            >
              Retry
            </button>
          </div>
        </Match>
      </Switch>
    </section>
  );
};

export default King;
