import { For, Match, Show, Switch, type Component } from "solid-js";

import { CANONICAL_ORIGIN } from "../../shared/lib/config";
import { KING_PATH } from "../../shared/lib/paths";
import { type Champion } from "./King";
import ModelLogo from "../../shared/components/ModelLogo";

// The three podium ranks, gold → bronze. A slot is filled from the ranked arena, or shown
// as a dimmed placeholder when the arena is smaller (never a fabricated champion).
const RANKS = ["Gold", "Silver", "Bronze"] as const;

// Presentational: The Arena renders the live ranked arena — the King (arena #1) as gold,
// then the defenders — or the empty arena, loading, or error state, from props. The single
// `/king` fetch lives in App, which feeds this section AND the King from ONE request (see
// App), so this composes `[current, ...recent]` into the podium: the reigning King heads it
// as gold, the ranked defenders follow. Every prop is optional so the build-time prerender
// (`<Podium />` with no props) renders the empty arena, matching the client's first hydrated
// frame.
type PodiumProps = {
  current?: Champion | null;
  recent?: Champion[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
};

const Podium: Component<PodiumProps> = (props) => {
  // The full ranked arena: the King (arena #1) heads the podium, the ranked defenders follow.
  // No King ⇒ an empty arena (the honest empty state below).
  const arena = (): Champion[] => {
    const king = props.current;

    return king ? [king, ...(props.recent ?? [])] : [];
  };

  return (
    <section
      id="champions"
      class="section champions"
      aria-labelledby="champions-heading"
    >
      <h2 id="champions-heading">The Arena</h2>

      <Switch
        fallback={
          <Show
            when={arena().length > 0}
            fallback={
              <>
                <p class="podium-empty">
                  No champions have been crowned yet — beat the champions to be
                  the first.
                </p>
                <p class="podium-empty-link">
                  Live standings are served as JSON at{" "}
                  <a href={KING_PATH}>{`${CANONICAL_ORIGIN}${KING_PATH}`}</a>.
                </p>
              </>
            }
          >
            <ol class="podium">
              <For each={RANKS}>
                {(rank, i) => {
                  const champion = (): Champion | undefined => arena()[i()];

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
                            {/* Gold (arena #1) is the reigning King — mark it as such. */}
                            <Show when={i() === 0}>
                              <p class="podium-king-badge">King</p>
                            </Show>
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
