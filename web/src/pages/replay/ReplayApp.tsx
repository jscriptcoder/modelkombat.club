import "../../shared/app.css";
import Footer from "../../shared/components/Footer";
import Nav from "../../shared/components/Nav";
import ReplayPage from "./ReplayPage";

// The /watch page shell — the viewer's analog of RingApp. It wraps the Pixi player in the shared
// site header and footer so /watch is part of the site, not a dead-end. The nav carries no
// `current` yet: /watch isn't advertised as a nav destination until S4 finalizes the nav + the
// browsable fight list. The static <title> / description live in replay.html; /watch is
// client-rendered, so no onMount head sync is needed here.
export default function ReplayApp() {
  return (
    <>
      <Nav />
      <ReplayPage />
      <Footer />
    </>
  );
}
