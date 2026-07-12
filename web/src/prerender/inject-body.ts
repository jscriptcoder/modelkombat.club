// The core of the build-time prerender step, kept as a pure string transform so it can
// be unit-tested without running a full build: drop the server-rendered body into the
// built HTML shell's empty `#root`. Fail-fast — if the shell has no `<div id="root">`
// to inject into, throw rather than silently emit an empty page (a quiet loss of
// crawler/LLM readability is exactly the regression this feature exists to prevent).
const EMPTY_ROOT = /<div id="root">\s*<\/div>/;

export const injectBody = (template: string, body: string): string => {
  if (!EMPTY_ROOT.test(template)) {
    throw new Error(
      'prerender: no empty <div id="root"></div> found in the HTML shell',
    );
  }

  return template.replace(EMPTY_ROOT, `<div id="root">${body}</div>`);
};

// Insert markup (e.g. Solid's hydration script) immediately before `</head>`. Fail-fast
// for the same reason as injectBody: a shell missing `</head>` means the build is broken,
// not something to paper over.
export const injectHead = (template: string, html: string): string => {
  if (!template.includes("</head>")) {
    throw new Error("prerender: no </head> found in the HTML shell");
  }

  return template.replace("</head>", `${html}</head>`);
};

// Replace the document `<title>` — the spec page names itself in the browser tab,
// distinct from the marketing home title the shell was built with. Fail-fast (as
// above) if the shell carries no `<title>`.
const TITLE = /<title>[\s\S]*?<\/title>/;

export const setTitle = (template: string, title: string): string => {
  if (!TITLE.test(template)) {
    throw new Error("prerender: no <title> found in the HTML shell");
  }

  return template.replace(TITLE, `<title>${title}</title>`);
};

// Point the canonical `<link>` at the given URL — the spec page's canonical is its own,
// not the home page's. Fail-fast if the shell has no canonical link.
const CANONICAL = /<link rel="canonical" href="[^"]*"\s*\/?>/;

export const setCanonical = (template: string, href: string): string => {
  if (!CANONICAL.test(template)) {
    throw new Error("prerender: no canonical <link> found in the HTML shell");
  }

  return template.replace(CANONICAL, `<link rel="canonical" href="${href}" />`);
};

// Remove EVERY `<script>` block so the page ships no client JS: the module bundle in the
// body and the JSON-LD block in the head both go. Fail-fast if the shell has no script at
// all — the built shell always carries the module script, so its absence means the build
// changed under us and the "fully static" guarantee is no longer meaningful to assert.
const SCRIPT = /<script\b[\s\S]*?<\/script>\s*/g;

export const stripScripts = (template: string): string => {
  if (!/<script\b/.test(template)) {
    throw new Error(
      "prerender: no <script> found to strip from the HTML shell",
    );
  }

  return template.replace(SCRIPT, "");
};
