import { createResource, Match, Switch, type Component } from "solid-js";

import "../../shared/app.css";
import "./replay.css";
import { RING_PATH } from "../../shared/lib/paths";
import { loadReplay, type ReplayLoad } from "./replay-loader";
import ReplayPlayer from "./ReplayPlayer";
import type { Viewport } from "./scene";

type ReplayPageProps = {
  // The data seam. Injected in tests to drive every state without a network; defaults to the live
  // two-step /replay fetch (list → newest → tape). Mirrors RingPage's `postFight`.
  load?: () => Promise<ReplayLoad>;
  // Canvas size, forwarded to the player — overridden in tests, a sensible default in production.
  viewport?: Viewport;
};

const ReplayPage: Component<ReplayPageProps> = (props) => {
  const [data, { refetch }] = createResource(() =>
    (props.load ?? loadReplay)(),
  );

  // The loaded fight, or null unless the load resolved to a watchable fight — so only the `ready`
  // branch mounts the player.
  const readyItem = () => {
    const current = data();

    return current?.kind === "ready" ? current.item : null;
  };

  return (
    <main class="replay" id="top">
      <h1 class="replay-title">Watch the King's latest fight</h1>

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

        <Match when={readyItem()}>
          {(item) => <ReplayPlayer item={item()} viewport={props.viewport} />}
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
    </main>
  );
};

export default ReplayPage;
