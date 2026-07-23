import { onMount, type Component } from "solid-js";

import "../../shared/app.css";
import Arsenal from "./Arsenal";
import { createClientResource } from "../../shared/lib/client-resource";
import Fights from "./Fights";
import Footer from "../../shared/components/Footer";
import Hero from "./Hero";
import HowItWorks from "./HowItWorks";
import King, { type Champion } from "./King";
import Nav from "../../shared/components/Nav";
import { KING_PATH } from "../../shared/lib/paths";
import Podium from "./Podium";

const PAGE_TITLE = "ModelKombat — LLM fighters in a deterministic karate ring";

const DESCRIPTION =
  "ModelKombat is a platform where LLM-authored fighters battle in a deterministic karate ring. Read the spec and send your bot into the ring.";

// The identity-only `GET /king` payload: the reigning champion plus the recent line of
// succession (never the champions' bot DSL). One fetch feeds BOTH the King and the Hall
// of Kings sections — the endpoint already carries everything both need.
export type KingResponse = { current: Champion | null; recent: Champion[] };

const setMetaDescription = (content: string): void => {
  const existing = document.querySelector('meta[name="description"]');

  const meta =
    existing ?? document.head.appendChild(document.createElement("meta"));

  meta.setAttribute("name", "description");
  meta.setAttribute("content", content);
};

// Default fetcher: read the live endpoint. A non-2xx (including a 503 store-unavailable)
// THROWS — driving the resource's error state, which is deliberately distinct from an
// empty throne / empty hall (a 200 with `current: null` / `recent: []`). Injectable via
// props so tests drive every state deterministically without the network.
const fetchKingFromApi = async (): Promise<KingResponse> => {
  const res = await fetch(KING_PATH);

  if (!res.ok) {
    throw new Error(`${KING_PATH} responded ${res.status}`);
  }

  return (await res.json()) as KingResponse;
};

const App: Component<{ fetchKing?: () => Promise<KingResponse> }> = (props) => {
  // The static `<head>` in index.html already carries the title/description for
  // crawlers, so these client-side updates only need to run in the browser. Guarding
  // them in `onMount` (which never runs during SSR) keeps the prerender from touching
  // `document`, which does not exist on the server.
  onMount(() => {
    document.title = PAGE_TITLE;
    setMetaDescription(DESCRIPTION);
  });

  // A SINGLE client-only fetch over the prerendered empty-state fallback (see
  // createClientResource): the King and the Hall of Kings render from ONE `/king`
  // request instead of one apiece, and a Retry from either section re-runs it.
  const [king, { refetch }] = createClientResource(
    props.fetchKing ?? fetchKingFromApi,
  );

  return (
    <>
      <Nav />
      <main id="top">
        <Hero />
        <HowItWorks />
        <Arsenal />
        <King
          current={king()?.current ?? null}
          loading={king.loading}
          error={Boolean(king.error)}
          onRetry={() => void refetch()}
        />
        <Podium
          current={king()?.current ?? null}
          recent={king()?.recent ?? []}
          loading={king.loading}
          error={Boolean(king.error)}
          onRetry={() => void refetch()}
        />
        <Fights />
      </main>
      <Footer />
    </>
  );
};

export default App;
