import {
  createResource,
  For,
  Match,
  Show,
  Switch,
  type Component,
} from "solid-js";

import ModelLogo from "../../shared/components/ModelLogo";
import { WATCH_PATH } from "../../shared/lib/paths";
import { loadById, type ReplayByIdLoad } from "./replay-loader";
import ReplayPlayer from "./ReplayPlayer";
import type { Viewport } from "./scene";

// The /watch/{id} permalink player: resolves ONE fight by its content-hash id and plays it. Four
// states — loading, the mounted player, a no-retry "no longer available" state for a 404'd/evicted
// id, and a retryable transient error. A "← All fights" link is the only way back on this dark,
// nav-less route, so it rides both the player and the not-found state.
type ReplayFightProps = {
  id: string;
  // The data seam. Injected in tests to drive every state without a network; defaults to the live
  // GET /replay/{id} fetch. Mirrors how ReplayPage/RingPage inject their loaders.
  load?: (id: string) => Promise<ReplayByIdLoad>;
  viewport?: Viewport;
};

const ReplayFight: Component<ReplayFightProps> = (props) => {
  const [data, { refetch }] = createResource(() =>
    (props.load ?? loadById)(props.id),
  );

  // The loaded fight, or null unless the load resolved to a watchable fight — so only the `found`
  // branch mounts the player.
  const foundItem = () => {
    const current = data();

    return current?.kind === "found" ? current.item : null;
  };

  return (
    <Switch>
      <Match when={data.loading}>
        <p class="replay-status" role="status">
          Loading the fight…
        </p>
      </Match>

      <Match when={data.error}>
        <div class="replay-error" role="alert">
          <p class="replay-error-line">⚠ Couldn't load the fight.</p>
          <button type="button" class="retry" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      </Match>

      <Match when={data()?.kind === "not-found"}>
        <div class="replay-error" role="alert">
          <p class="replay-error-line">This fight is no longer available.</p>
          <a class="replay-back" href={WATCH_PATH}>
            ← All fights
          </a>
        </div>
      </Match>

      <Match when={foundItem()}>
        {(item) => {
          // The submission's sibling bouts, board order (King first). Read defensively — an
          // absent list is 0 siblings; a lone bout gets no switcher (nothing to switch to).
          const matchups = () => item().matchups ?? [];

          return (
            <div class="replay-fight">
              <a class="replay-back" href={WATCH_PATH}>
                ← All fights
              </a>

              <Show when={matchups().length > 1}>
                <nav class="replay-matchups" aria-label="Matchups">
                  <ul class="replay-matchup-list">
                    <For each={matchups()}>
                      {(bout) => (
                        <li class="replay-matchup">
                          <a
                            class="replay-matchup-link"
                            href={`${WATCH_PATH}/${bout.id}`}
                            aria-current={
                              bout.id === props.id ? "page" : undefined
                            }
                          >
                            <ModelLogo model={bout.fighters[1].model} />
                            <code class="replay-matchup-name">
                              {bout.fighters[1].name}
                            </code>
                          </a>
                        </li>
                      )}
                    </For>
                  </ul>
                </nav>
              </Show>

              <ReplayPlayer item={item()} viewport={props.viewport} />
            </div>
          );
        }}
      </Match>
    </Switch>
  );
};

export default ReplayFight;
