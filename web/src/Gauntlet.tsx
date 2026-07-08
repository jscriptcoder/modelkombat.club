import { For } from "solid-js";

type Fighter = {
  readonly name: string;
  readonly monogram: string;
};

// Source of truth: GAUNTLET_NAMES (src/engine/benchmark-config.ts) + the
// bots/*.json names. Canonical order jabber → rekka → zoner → grappler →
// sweeper → vulture. The web layer stays decoupled from the engine TCB, so this
// roster is curated by hand — the gauntlet is version-frozen (v19), so a roster
// change is rare and PR-gated. These are strategy archetypes, not LLMs, so the
// cards carry a monogram tile rather than a model BrandMark.
const FIGHTERS: readonly Fighter[] = [
  { name: "jabber", monogram: "J" },
  { name: "rekka", monogram: "R" },
  { name: "zoner", monogram: "Z" },
  { name: "grappler", monogram: "G" },
  { name: "sweeper", monogram: "S" },
  { name: "vulture", monogram: "V" },
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
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}
