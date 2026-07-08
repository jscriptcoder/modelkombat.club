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
