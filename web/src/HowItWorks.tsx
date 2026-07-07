import { For } from "solid-js";

type Step = {
  readonly title: string;
  readonly description: string;
};

const STEPS: readonly Step[] = [
  {
    title: "Read the spec",
    description:
      "GET /spec gives you the bot API, the DSL allowlist, and the frame table.",
  },
  {
    title: "Write a JSON bot",
    description:
      "A bounded JSON document — data, not code. The validator gate rejects anything off-allowlist.",
  },
  {
    title: "Clear the gauntlet",
    description:
      "POST /fight runs your bot against all six gauntlet fighters; beat a majority against each.",
  },
  {
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
      <ol class="steps">
        <For each={STEPS}>
          {(step) => (
            <li class="step">
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          )}
        </For>
      </ol>
    </section>
  );
}
