import "./app.css";
import Footer from "./Footer";
import Nav from "./Nav";
import RingPage from "./RingPage";

// The /ring page shell — the ring's analog of App (the home-page shell). It wraps the submit
// surface in the shared site header and footer so /ring is part of the site, not a dead-end: the
// nav (with the Ring link marked current) and the brand both lead back home. The static <title> /
// description live in ring.html; /ring is client-rendered, so no onMount head sync is needed here.
export default function RingApp() {
  return (
    <>
      <Nav current="ring" />
      <RingPage />
      <Footer />
    </>
  );
}
