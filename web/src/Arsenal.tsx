import { For } from "solid-js";

type Move = {
  readonly id: string;
  readonly gloss: string;
};

type Family = {
  readonly name: string;
  readonly slug: string;
  readonly moves: readonly Move[];
};

// Source of truth: docs/move-roster.md (the 11 named MoveIds + `sweep` + `throw`)
// plus `tobi-geri` from CANONICAL_RULES. The web layer stays decoupled from the
// engine TCB, so this roster is curated by hand — keep it in sync when the move
// set changes.
const FAMILIES: readonly Family[] = [
  {
    name: "Strikes",
    slug: "strikes",
    moves: [
      { id: "kizami-zuki", gloss: "jab" },
      { id: "gyaku-zuki", gloss: "reverse punch" },
      { id: "uraken", gloss: "backfist" },
      { id: "shuto", gloss: "knife-hand" },
    ],
  },
  {
    name: "Kicks",
    slug: "kicks",
    moves: [
      { id: "mae-geri", gloss: "front kick" },
      { id: "mawashi-geri", gloss: "roundhouse kick" },
      { id: "yoko-geri", gloss: "side kick" },
      { id: "ushiro-geri", gloss: "back kick" },
    ],
  },
  {
    name: "Close-range",
    slug: "close-range",
    moves: [
      { id: "empi", gloss: "elbow strike" },
      { id: "hiza-geri", gloss: "knee strike" },
    ],
  },
  {
    name: "Takedowns",
    slug: "takedowns",
    moves: [
      { id: "throw", gloss: "throw" },
      { id: "sweep", gloss: "foot sweep" },
    ],
  },
  {
    name: "Aerial",
    slug: "aerial",
    moves: [{ id: "tobi-geri", gloss: "jumping kick" }],
  },
];

export default function Arsenal() {
  return (
    <section id="arsenal" aria-labelledby="arsenal-heading" class="section">
      <h2 id="arsenal-heading">The Arsenal</h2>
      <p>
        Thirteen real karate techniques — every fighter is built from these.
        Scores run 1 yuko · 2 waza-ari · 3 ippon.
      </p>
      <For each={FAMILIES}>
        {(family) => (
          <section
            class="arsenal-family"
            aria-labelledby={`arsenal-family-${family.slug}`}
          >
            <h3 id={`arsenal-family-${family.slug}`}>{family.name}</h3>
            <ul class="arsenal-moves">
              <For each={family.moves}>
                {(move) => (
                  <li class="move">
                    <code class="move-id">{move.id}</code>
                    <span class="move-gloss">{move.gloss}</span>
                  </li>
                )}
              </For>
            </ul>
          </section>
        )}
      </For>
    </section>
  );
}
