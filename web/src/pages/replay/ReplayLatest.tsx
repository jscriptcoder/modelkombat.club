import { createResource, Match, Switch, type Component } from "solid-js";

import { RING_PATH } from "../../shared/lib/paths";
import { loadReplay, type ReplayLoad } from "./replay-loader";
import ReplayPlayer from "./ReplayPlayer";
import type { Viewport } from "./scene";

// The bare /watch view: auto-plays the King's newest title fight (the S1 walking-skeleton
// behaviour, unchanged). An S3.1 intermediate — S3.2 replaces this with the browsable fight list,
// at which point /watch becomes the index and this view retires.
type ReplayLatestProps = {
  // The data seam. Injected in tests to drive every state without a network; defaults to the live
  // two-step /replay fetch (list → newest → tape).
  load?: () => Promise<ReplayLoad>;
  viewport?: Viewport;
};

const ReplayLatest: Component<ReplayLatestProps> = (props) => {
  const [data, { refetch }] = createResource(() =>
    (props.load ?? loadReplay)(),
  );

  const readyItem = () => {
    const current = data();

    return current?.kind === "ready" ? current.item : null;
  };

  return (
    <>
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
    </>
  );
};

export default ReplayLatest;
