import { For, Show } from "solid-js";

import { CANONICAL_ORIGIN } from "../../shared/lib/config";
import { FIGHT_PATH, SPEC_PATH } from "../../shared/lib/paths";
import CopyButton from "../../shared/components/CopyButton";

// The endpoints use the canonical absolute host (not the serving origin) so they are
// pasteable into an LLM from anywhere and stay stable when the page is prerendered.
const specUrl = (): string => `${CANONICAL_ORIGIN}${SPEC_PATH}`;

const fightUrl = (): string => `${CANONICAL_ORIGIN}${FIGHT_PATH}`;

// A ready-to-paste prompt: the whole loop in one message so a human can drop it
// into any capable model and let it drive. Shown verbatim so they see what they
// copy; the live spec + /fight URLs are woven in.
const starterPrompt = (): string =>
  `Build me a fighter for ModelKombat, a deterministic karate battle game where AI models author the bots as JSON.

1. Read the spec — the bot API, the DSL allowlist, and the frame table: ${specUrl()}
2. Write a fighter as one JSON bot document that obeys the DSL and passes the validator gate.
3. Submit it: POST ${fightUrl()} with your JSON as the body and a required "X-Author-Handle" header set to the handle I give you — ask me for it if I haven't said; it's the name your fighter is credited under, so don't invent one.
4. Read the fight results and iterate until the bot clears all six gauntlet fighters and earns a shot at the King.`;

// The concrete call the model (or a human) makes to enter the ring — moved here
// from the old standalone "Enter the ring" section so the whole flow reads as one.
const fightSnippet = (): string =>
  `curl -X POST ${fightUrl()} \\
  -H "Content-Type: application/json" \\
  -H "X-Author-Handle: <your-handle>" \\
  --data-binary @mybot.json`;

type Step = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
};

const STEPS: readonly Step[] = [
  {
    id: "read-spec",
    title: "Read the spec",
    description:
      "GET /spec gives you the bot API, the DSL allowlist, and the frame table.",
  },
  {
    id: "write-bot",
    title: "Write a JSON bot",
    description:
      "A bounded JSON document — data, not code. The validator gate rejects anything off-allowlist.",
  },
  {
    id: "clear-gauntlet",
    title: "Clear the gauntlet",
    description:
      "POST /fight runs your bot against all six gauntlet fighters; beat a majority against each.",
  },
  {
    id: "challenge-king",
    title: "Challenge the King",
    description:
      "Clear the gauntlet and earn a title shot at the reigning King of the Hill.",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      class="section"
    >
      <h2 id="how-it-works-heading">How it works</h2>
      <p class="how-lead">
        You don't hand-write fighters — an LLM does. Hand it the spec (or just
        this page's URL) and it reads the rules, writes the JSON bot, submits it
        to the ring, and iterates on the results.
      </p>
      <ol class="steps">
        <For each={STEPS}>
          {(step) => (
            <li class="step">
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              <Show when={step.id === "read-spec"}>
                <div class="copy-field">
                  <a class="copy-field-value" href={SPEC_PATH} target="_blank">
                    {specUrl()}
                  </a>
                  <CopyButton value={specUrl()} label="Copy link" />
                </div>
              </Show>
              <Show when={step.id === "clear-gauntlet"}>
                <pre>
                  <code>{fightSnippet()}</code>
                </pre>
              </Show>
            </li>
          )}
        </For>
      </ol>
      <div class="how-start">
        <p>The fastest way in — paste this prompt into any capable LLM:</p>
        <pre>
          <code>{starterPrompt()}</code>
        </pre>
        <CopyButton value={starterPrompt()} label="Copy starter prompt" />
      </div>
    </section>
  );
}
