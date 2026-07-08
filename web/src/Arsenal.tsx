import { For } from "solid-js";

// A score badge: the numeric glyph the eye reads, plus the label a screen
// reader announces (so "2·3" isn't voiced as "two middot three"). WKF scoring
// is 1 yuko / 2 waza-ari / 3 ippon.
type Badge = {
  readonly text: string;
  readonly label: string;
};

const YUKO: Badge = { text: "1", label: "scores 1 point" };
const WAZA_ARI: Badge = { text: "2", label: "scores 2 points" };
const IPPON: Badge = { text: "3", label: "scores 3 points" };

const HEAD_BONUS: Badge = {
  text: "2·3",
  label: "scores 2 points, 3 to the head",
};

const KNOCKDOWN: Badge = {
  text: "0→3",
  label: "scores no points on the hit, but knocks down for a 3-point finish",
};

type Move = {
  readonly id: string;
  readonly gloss: string;
  readonly badge: Badge;
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
      { id: "kizami-zuki", gloss: "jab", badge: YUKO },
      { id: "gyaku-zuki", gloss: "reverse punch", badge: YUKO },
      { id: "uraken", gloss: "backfist", badge: YUKO },
      { id: "shuto", gloss: "knife-hand", badge: YUKO },
    ],
  },
  {
    name: "Kicks",
    slug: "kicks",
    moves: [
      { id: "mae-geri", gloss: "front kick", badge: WAZA_ARI },
      { id: "mawashi-geri", gloss: "roundhouse kick", badge: HEAD_BONUS },
      { id: "yoko-geri", gloss: "side kick", badge: WAZA_ARI },
      { id: "ushiro-geri", gloss: "back kick", badge: HEAD_BONUS },
    ],
  },
  {
    name: "Close-range",
    slug: "close-range",
    moves: [
      { id: "empi", gloss: "elbow strike", badge: WAZA_ARI },
      { id: "hiza-geri", gloss: "knee strike", badge: KNOCKDOWN },
    ],
  },
  {
    name: "Takedowns",
    slug: "takedowns",
    moves: [
      { id: "throw", gloss: "throw", badge: IPPON },
      { id: "sweep", gloss: "foot sweep", badge: KNOCKDOWN },
    ],
  },
  {
    name: "Aerial",
    slug: "aerial",
    moves: [{ id: "tobi-geri", gloss: "jumping kick", badge: HEAD_BONUS }],
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
                    <span
                      class="move-badge"
                      role="img"
                      aria-label={move.badge.label}
                    >
                      {move.badge.text}
                    </span>
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
