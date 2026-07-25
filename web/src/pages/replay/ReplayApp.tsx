import "../../shared/app.css";
import Footer from "../../shared/components/Footer";
import Nav from "../../shared/components/Nav";
import ReplayPage from "./ReplayPage";

// The /watch page shell — the viewer's analog of RingApp. It wraps the fight list / player in the
// shared site header and footer so /watch is part of the site, not a dead-end. The nav is told it
// is `current`: the dark launch is over — /watch is an advertised destination now, so the shared
// header names it as active exactly as it does on /ring.
// The static <title> / description live in replay.html; /watch is client-rendered, so no onMount
// head sync is needed here.
export default function ReplayApp() {
  return (
    <>
      <Nav current="watch" />
      <ReplayPage />
      <Footer />
    </>
  );
}
