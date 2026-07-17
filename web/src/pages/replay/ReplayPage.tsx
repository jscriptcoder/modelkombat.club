import { Show, type Component } from "solid-js";

import "../../shared/app.css";
import "./replay.css";
import { replayIdFromPath } from "./replay-route";
import type { ReplayByIdLoad, ReplayListLoad } from "./replay-loader";
import ReplayFight from "./ReplayFight";
import ReplayList from "./ReplayList";
import type { Viewport } from "./scene";

// The /watch shell dispatches on the URL: /watch/{id} → the permalink player (ReplayFight); bare
// /watch → the browsable fight list (ReplayList). The two views own their own data loads; this only
// picks which mounts, so each view's fetch runs on exactly its branch. The `/watch/(.*)` rewrite
// (vercel.json) serves this SPA for deep links, and the browser keeps the real path — so
// `location.pathname` is the source of truth.
type ReplayPageProps = {
  // The route seam. Injected in tests to select the view without touching history; defaults to the
  // live browser path.
  path?: string;
  // The bare-/watch list loader (forwarded to ReplayList). Injected in tests.
  loadList?: () => Promise<ReplayListLoad>;
  // The /watch/{id} by-id loader (forwarded to ReplayFight). Injected in tests.
  loadFight?: (id: string) => Promise<ReplayByIdLoad>;
  // Canvas size, forwarded to the fight player (the list has no canvas).
  viewport?: Viewport;
};

const ReplayPage: Component<ReplayPageProps> = (props) => {
  const id = () => replayIdFromPath(props.path ?? window.location.pathname);

  return (
    <main class="replay" id="top">
      <Show when={id()} fallback={<ReplayList load={props.loadList} />}>
        {(fightId) => (
          <ReplayFight
            id={fightId()}
            load={props.loadFight}
            viewport={props.viewport}
          />
        )}
      </Show>
    </main>
  );
};

export default ReplayPage;
