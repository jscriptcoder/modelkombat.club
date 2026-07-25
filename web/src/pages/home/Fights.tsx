import { For, Show, type Component } from "solid-js";

import { createClientResource } from "../../shared/lib/client-resource";
import FightCard from "../../shared/components/FightCard";
import { markCollisions } from "../replay/collisions";
import { WATCH_PATH } from "../../shared/lib/paths";
import { loadList, type ReplayListLoad } from "../replay/replay-loader";

// Three, not one: a single card reads as a demo, three imply a running ladder
// (watch-public-decisions.md D2).
const NEWEST_SHOWN = 3;

// The home page's window onto the fight archive. Cards LAYER ON TOP of a static signpost that is
// also the prerendered output, the loading state, the empty state and the error state (D4) — so a
// visitor who never asked to see fights is never shown a red error on a marketing page, and there
// is no layout shift when the cards arrive. /watch keeps the loud, retryable states; that is where
// someone who came to watch actually wants them.
//
// `id="fights"` outlives the nav's move to /watch, so every pre-existing `/#fights` link still
// resolves here.
type FightsProps = {
  // The data seam, mirroring ReplayList's. Injected in tests to drive every state without a
  // network; defaults to the live GET /replay list fetch — the same loader /watch uses, so the two
  // pages can never disagree about what an empty archive or a failed read means.
  load?: () => Promise<ReplayListLoad>;
};

const Fights: Component<FightsProps> = (props) => {
  // Client-deferred (see createClientResource): the prerendered HTML and the first hydrated frame
  // both render the signpost fallback, and the fetch fires only after hydration. This is what keeps
  // the no-JS crawler view a real link rather than an empty section.
  const [data] = createClientResource(() => (props.load ?? loadList)());

  const newest = () => {
    // Reading `error` is what makes swallowing it deliberate rather than accidental: this section
    // answers an archive failure with the signpost, never an alert (D4). Solid also treats an
    // unread resource error as UNHANDLED, so without this read a failed /replay would surface as
    // an unhandled rejection in the browser — noise on a page that decided not to care.
    if (data.error) {
      return null;
    }

    const current = data();

    // Collisions are marked over the cards THIS section shows, not the whole archive: a short id
    // fragment exists to tell two on-screen cards apart, and there is nothing else on screen here.
    return current?.kind === "ready"
      ? markCollisions(current.items.slice(0, NEWEST_SHOWN))
      : null;
  };

  return (
    <section
      id="fights"
      aria-labelledby="fights-heading"
      class="section fights"
    >
      <h2 id="fights-heading">🎬 Fight replays</h2>
      <p>
        Every title fight is bit-reproducible from its seed, so you can replay
        any bout tick-for-tick in the ring — the exact fight that decided the
        ladder, move for move.
      </p>

      <Show
        when={newest()}
        fallback={
          <a class="fights-cta" href={WATCH_PATH}>
            Watch the fights <span aria-hidden="true">→</span>
          </a>
        }
      >
        {(fights) => (
          <>
            <ul class="fights-list">
              <For each={fights()}>
                {(fight) => (
                  <li>
                    <FightCard fight={fight} />
                  </li>
                )}
              </For>
            </ul>
            {/* "all" is the point once cards are up: these three are a sample of the archive, and
                this is the way to the rest of it. */}
            <a class="fights-cta" href={WATCH_PATH}>
              Watch all fights <span aria-hidden="true">→</span>
            </a>
          </>
        )}
      </Show>
    </section>
  );
};

export default Fights;
