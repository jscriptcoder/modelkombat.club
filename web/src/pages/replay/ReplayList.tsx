import { createResource, For, Match, Switch, type Component } from "solid-js";

import FightCard from "../../shared/components/FightCard";
import { RING_PATH } from "../../shared/lib/paths";
import { markCollisions } from "./collisions";
import { loadList, type ReplayListLoad } from "./replay-loader";

// The /watch index: the King's title fights as a newest-first card list. Each card is a plain
// <a href="/watch/{id}"> — full-page navigation into the permalink player (ReplayFight), no router.
// Four states mirror the by-id player's shell: loading, the card grid, an honest empty state, and a
// retryable transient error. Identity-only: a fighter's name + model, name alone when a model is
// absent, the (possibly long) name CSS-truncated with the full value in a `title` tooltip.
type ReplayListProps = {
  // The data seam. Injected in tests to drive every state without a network; defaults to the live
  // GET /replay list fetch. Mirrors how ReplayFight/RingPage inject their loaders.
  load?: () => Promise<ReplayListLoad>;
};

const ReplayList: Component<ReplayListProps> = (props) => {
  const [data, { refetch }] = createResource(() => (props.load ?? loadList)());

  const readyItems = () => {
    const current = data();

    return current?.kind === "ready" ? current.items : null;
  };

  return (
    <>
      <h1 class="replay-title">Watch the King's title fights</h1>
      {/* Deliberately outside the <Switch>: the archive is scoped to the running season, and the
          state that most needs saying so is the EMPTY one — right after a season wipe this is the
          sentence that explains an empty list. Naming no version keeps it true across bumps. */}
      <p class="replay-season">
        These are the current season's title fights. Earlier seasons are
        archived and not browsable yet.
      </p>

      <Switch>
        <Match when={data.loading}>
          <p class="replay-status" role="status">
            Loading fights…
          </p>
        </Match>

        <Match when={data.error}>
          <div class="replay-error" role="alert">
            <p class="replay-error-line">⚠ Couldn't load the fights.</p>
            <button type="button" class="retry" onClick={() => void refetch()}>
              Retry
            </button>
          </div>
        </Match>

        <Match when={readyItems()}>
          {(items) => (
            <ul class="replay-list">
              {/* Repeat-challenge fights (identical challenger↔King name pair) are otherwise
                  indistinguishable — flag them so only those cards show a short id fragment. */}
              <For each={markCollisions(items())}>
                {(fight) => (
                  <li>
                    <FightCard fight={fight} />
                  </li>
                )}
              </For>
            </ul>
          )}
        </Match>

        <Match when={data()?.kind === "empty"}>
          <div class="replay-empty">
            <p class="replay-empty-line">No fights to watch yet.</p>
            <p class="replay-empty-link">
              <a href={RING_PATH}>Send a bot into the ring</a> to crown the
              first King.
            </p>
          </div>
        </Match>
      </Switch>
    </>
  );
};

export default ReplayList;
