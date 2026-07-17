import "../../shared/app.css";
import Footer from "../../shared/components/Footer";
import Nav from "../../shared/components/Nav";
import ReplayPage from "./ReplayPage";

// The /watch page shell — the viewer's analog of RingApp. It wraps the fight list / player in the
// shared site header and footer so /watch is part of the site, not a dead-end. The nav carries no
// `current`: /watch ships dark — it is not advertised as a nav destination and the home teaser
// stays a non-link; surfacing it is a parked follow-up (replay-viewer-decisions.md → dark launch).
// The static <title> / description live in replay.html; /watch is client-rendered, so no onMount
// head sync is needed here.
export default function ReplayApp() {
  return (
    <>
      <Nav />
      <ReplayPage />
      <Footer />
    </>
  );
}
