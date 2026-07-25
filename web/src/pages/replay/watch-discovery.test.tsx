import { describe, expect, it } from "vitest";

// The fight archive has to be findable by machines, not only by a human clicking "Fights" in the
// nav. Two static surfaces advertise it: sitemap.xml (for crawlers) and llms.txt (for a reading
// LLM that was handed the site URL). Fetching the served files exercises the crawler's-eye view,
// and the real browser DOMParser gives a genuine XML well-formedness check with no XML dep.
const WATCH_URL = "https://modelkombat.club/watch";
const REPLAY_URL = "https://modelkombat.club/replay";

const locsIn = (xml: string): ReadonlyArray<string | null> => {
  const doc = new DOMParser().parseFromString(xml, "application/xml");

  // A <parsererror> node is how DOMParser reports malformed XML. Checked here rather than in one
  // test, so every sitemap assertion below is reading a document a crawler could actually parse.
  expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);

  return [...doc.getElementsByTagName("loc")].map((el) => el.textContent);
};

// llms.txt is flat Markdown whose `##` headings ARE its structure: the section an entry sits in
// tells the reading LLM whether it needs that URL to author a bot. Asserting against a named
// section's body rather than the whole file is what makes "listed under Optional" testable.
const sectionOf = (txt: string, heading: string): string => {
  const body = txt.split(`\n## ${heading}\n`)[1];

  if (body === undefined) {
    throw new Error(`llms.txt has no "## ${heading}" section`);
  }

  return body.split("\n## ")[0];
};

// Pins an assertion to one endpoint's own bullet, so a caveat that drifted onto a neighbouring
// entry cannot satisfy it.
const entryMentioning = (section: string, marker: string): string => {
  const entry = section.split("\n").find((line) => line.includes(marker));

  if (entry === undefined) {
    throw new Error(`llms.txt has no entry mentioning "${marker}"`);
  }

  return entry;
};

const sitemap = () => fetch("/sitemap.xml").then((res) => res.text());

// Newlines are normalised because llms.txt is not pinned to LF in .gitattributes: on a Windows
// checkout with core.autocrlf it is served CRLF, while Vercel serves the LF original. Which one
// a reading LLM receives is not the behavior under test — the sections and their entries are.
const llmsTxt = () =>
  fetch("/llms.txt")
    .then((res) => res.text())
    .then((txt) => txt.replace(/\r\n/g, "\n"));

describe("fight-archive discoverability surfaces", () => {
  it("lists the fight viewer exactly once in a well-formed sitemap.xml", async () => {
    const locs = locsIn(await sitemap());

    expect(locs.filter((loc) => loc === WATCH_URL)).toHaveLength(1);
  });

  it("keeps individual fight permalinks out of the sitemap", async () => {
    const locs = locsIn(await sitemap());

    // A /watch/{id} id is a content hash of the bout, and the archive is bounded: an evicted
    // fight takes its permalink with it. Indexing them would publish links that rot into 404s,
    // so only the list page — stable across evictions — is offered to crawlers.
    expect(locs.filter((loc) => loc?.startsWith(`${WATCH_URL}/`))).toEqual([]);
  });

  it("documents GET /replay as an API endpoint under both of its public URL forms", async () => {
    const api = sectionOf(await llmsTxt(), "API endpoints");

    // The list and the item are separate URLs and a reading LLM needs both: one to find a fight,
    // the other to read it.
    expect(api).toContain(`[GET /replay](${REPLAY_URL})`);
    expect(entryMentioning(api, REPLAY_URL)).toContain("`/replay/{id}`");
  });

  it("never advertises the internal query-string form of a fight URL", async () => {
    // `/replay?id=…` is a vercel.json rewrite TARGET — an implementation detail of how
    // /replay/{id} gets served. Publishing it in llms.txt would freeze an internal route into
    // contract with every LLM that reads the file.
    expect(await llmsTxt()).not.toContain("?id=");
  });

  it("promises behavior and never the DSL from a fight, and says how big one is", async () => {
    const entry = entryMentioning(
      sectionOf(await llmsTxt(), "API endpoints"),
      REPLAY_URL,
    );

    // Two things an author must know before fetching: the archive cannot leak a rival's bot
    // document, and a single bout is heavy enough that fetching many blind will hurt.
    expect(entry).toContain("behavior only, never the bot DSL");
    expect(entry).toContain("roughly 100–300 KB");
  });

  it("offers the viewer as an optional human surface, not as an endpoint to author against", async () => {
    const txt = await llmsTxt();

    expect(sectionOf(txt, "Optional")).toContain(
      `[Watch the fights](${WATCH_URL})`,
    );
    // /watch renders stickmen for a person; nothing about it helps a model author a bot, so it
    // must not sit among the endpoints an author is told to call.
    expect(sectionOf(txt, "API endpoints")).not.toContain(WATCH_URL);
  });
});
