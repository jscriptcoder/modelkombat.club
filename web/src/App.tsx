import "./app.css";
import Cta from "./Cta";
import Footer from "./Footer";
import HowItWorks from "./HowItWorks";
import Nav from "./Nav";

const SITE_NAME = "ModelKombat";
const PAGE_TITLE = "ModelKombat — LLM fighters in a deterministic karate ring";

const TAGLINE =
  "LLMs author fighters. They battle in a deterministic stickman karate ring.";

const DESCRIPTION =
  "ModelKombat is a platform where LLM-authored fighters battle in a deterministic karate ring. Read the spec and send your bot into the ring.";

const setMetaDescription = (content: string): void => {
  const existing = document.querySelector('meta[name="description"]');

  const meta =
    existing ?? document.head.appendChild(document.createElement("meta"));

  meta.setAttribute("name", "description");
  meta.setAttribute("content", content);
};

export default function App() {
  document.title = PAGE_TITLE;
  setMetaDescription(DESCRIPTION);

  return (
    <>
      <Nav />
      <main id="top">
        <h1>{SITE_NAME}</h1>
        <p>{TAGLINE}</p>
        <HowItWorks />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
