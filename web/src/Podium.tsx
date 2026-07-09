import { For, Match, Show, Switch, type Component } from "solid-js";

import { type Champion } from "./King";
import ModelLogo from "./ModelLogo";

// The three podium ranks, gold → bronze. A slot is filled from `recent[i]`, or shown as
// a dimmed placeholder when the succession is shorter (never a fabricated champion).
const RANKS = ["Gold", "Silver", "Bronze"] as const;

// Presentational: the Hall of Kings renders the recent line of succession — or the empty
// hall, loading, or error state — from props. The single `/king` fetch lives in App,
// which feeds this section AND the King from ONE request (see App). Every prop is
// optional so the build-time prerender (`<Podium />` with no props) renders the empty
// hall, matching the client's first hydrated frame.
type PodiumProps = {
  recent?: Champion[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
};

const Podium: Component<PodiumProps> = (props) => {
  const recent = (): Champion[] => props.recent ?? [];

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
            when={recent().length > 0}
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
                  const champion = (): Champion | undefined => recent()[i()];

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
        <Match when={props.loading}>
          <p role="status" class="podium-status">
            Gathering the champions…
          </p>
        </Match>
        <Match when={props.error}>
          <div class="podium-error" role="alert">
            <p class="podium-error-line">⚠ Couldn't reach the ring.</p>
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

export default Podium;
