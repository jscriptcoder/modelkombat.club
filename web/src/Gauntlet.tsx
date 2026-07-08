import { For } from "solid-js";

type Fighter = {
  readonly name: string;
  readonly monogram: string;
  readonly bio: string;
};

// Source of truth: GAUNTLET_NAMES (src/engine/benchmark-config.ts) + the
// bots/*.json names. Canonical order jabber → rekka → zoner → grappler →
// sweeper → vulture. The web layer stays decoupled from the engine TCB, so this
// roster is curated by hand — the gauntlet is version-frozen (v19), so a roster
// change is rare and PR-gated. These are strategy archetypes, not LLMs, so the
// cards carry a monogram tile rather than a model BrandMark. Bios are authored
// to be faithful to each bot's actual rules.
const FIGHTERS: readonly Fighter[] = [
  {
    name: "jabber",
    monogram: "J",
    bio: "Death by a thousand cuts. Walks you down, reads your strike's height and blocks it, then answers with the jab.",
  },
  {
    name: "rekka",
    monogram: "R",
    bio: "Flurry artist. Chains cancel into cancel, then leaps in for a jump-kick ippon.",
  },
  {
    name: "zoner",
    monogram: "Z",
    bio: "Fights at the fence — picks the exact-length kick for the gap and retreats the instant you close the distance.",
  },
  {
    name: "grappler",
    monogram: "G",
    bio: "Owns the clinch. Crowd him and he throws you to the mat, then punishes the knockdown with a reverse punch.",
  },
  {
    name: "sweeper",
    monogram: "S",
    bio: "Chops your base out with a foot sweep, then cashes the knockdown for a reverse-punch finish.",
  },
  {
    name: "vulture",
    monogram: "V",
    bio: "Patient predator. Baits the whiff, punishes it with a snap backfist — and feeds on a gassed opponent.",
  },
];

export default function Gauntlet() {
  return (
    <section
      id="gauntlet"
      aria-labelledby="gauntlet-heading"
      class="section gauntlet"
    >
      <h2 id="gauntlet-heading">The Gauntlet</h2>
      <p>
        Six house fighters stand between your bot and a title shot — beat a
        majority against each to earn your challenge at the King.
      </p>
      <ul class="gauntlet-roster">
        <For each={FIGHTERS}>
          {(fighter) => (
            <li class={`fighter fighter-${fighter.name}`}>
              <span class="fighter-monogram" aria-hidden="true">
                {fighter.monogram}
              </span>
              <code class="fighter-name">{fighter.name}</code>
              <p class="fighter-bio">{fighter.bio}</p>
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}
