import { createSignal, For, onMount, Show, type Component } from "solid-js";

import MovePreview from "./MovePreview";
import type { PreviewStageProps } from "./PreviewStage";
import { SPEC_GUIDE_PATH } from "../../shared/lib/paths";

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
  readonly descriptor: string;
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
      {
        id: "kizami-zuki",
        gloss: "jab",
        badge: YUKO,
        descriptor:
          "Fast lead-hand poke — the tempo-setter that opens the cancel chain.",
      },
      {
        id: "gyaku-zuki",
        gloss: "reverse punch",
        badge: YUKO,
        descriptor:
          "The power hand and cancel hub — every combo routes through it.",
      },
      {
        id: "uraken",
        gloss: "backfist",
        badge: YUKO,
        descriptor:
          "Cheapest, shortest hand — a gas-proof jodan snap and combo starter.",
      },
      {
        id: "shuto",
        gloss: "knife-hand",
        badge: YUKO,
        descriptor:
          "The longest-reaching hand, out-ranging even the reverse punch.",
      },
    ],
  },
  {
    name: "Kicks",
    slug: "kicks",
    moves: [
      {
        id: "mae-geri",
        gloss: "front kick",
        badge: WAZA_ARI,
        descriptor:
          "The straight-line body kick — a reliable waza-ari from mid range.",
      },
      {
        id: "mawashi-geri",
        gloss: "roundhouse kick",
        badge: HEAD_BONUS,
        descriptor:
          "Arcs to the body for two, or over the guard to the head for the ippon.",
      },
      {
        id: "yoko-geri",
        gloss: "side kick",
        badge: WAZA_ARI,
        descriptor:
          "A beyond-neutral thrust that out-reaches even the roundhouse.",
      },
      {
        id: "ushiro-geri",
        gloss: "back kick",
        badge: HEAD_BONUS,
        descriptor:
          "The longest, most committed strike — a turn-away thrust you'll see coming.",
      },
    ],
  },
  {
    name: "Close-range",
    slug: "close-range",
    moves: [
      {
        id: "empi",
        gloss: "elbow strike",
        badge: WAZA_ARI,
        descriptor:
          "Shortest reach in the game — a point-blank two-point payoff.",
      },
      {
        id: "hiza-geri",
        gloss: "knee strike",
        badge: KNOCKDOWN,
        descriptor:
          "The only standing mid-band knockdown — it sets up a three-point finish.",
      },
    ],
  },
  {
    name: "Takedowns",
    slug: "takedowns",
    moves: [
      {
        id: "throw",
        gloss: "throw",
        badge: IPPON,
        descriptor:
          "Clean takedown for the instant ippon — the anti-turtle answer.",
      },
      {
        id: "sweep",
        gloss: "foot sweep",
        badge: KNOCKDOWN,
        descriptor:
          "Chops the base out; scores nothing, but the okizeme finish pays three.",
      },
    ],
  },
  {
    name: "Aerial",
    slug: "aerial",
    moves: [
      {
        id: "tobi-geri",
        gloss: "jumping kick",
        badge: HEAD_BONUS,
        descriptor:
          "Leap in from range for a head-height ippon — the only airborne strike.",
      },
    ],
  },
];

// The one move that carries an animated preview in this slice (S2 walking skeleton); S3 broadens the
// eye control to the whole roster.
const PREVIEW_MOVE = "gyaku-zuki";

// Props are the injectable Pixi-stage loader (default = the real dynamic import, in MovePreview) so
// tests drive the preview through a spy stage without a WebGL mount.
type ArsenalProps = {
  loadStage?: () => Promise<Component<PreviewStageProps>>;
};

const Arsenal: Component<ArsenalProps> = (props) => {
  // The eye control is a client-only enhancement: revealed on mount, so no-JS / prerender renders the
  // Arsenal exactly as before (no dead affordance). `onMount` never runs under SSR.
  const [mounted, setMounted] = createSignal(false);

  onMount(() => setMounted(true));

  // The open move (one preview at a time) and the eye control's on-screen rect, so the popover sits
  // beside the icon that opened it.
  const [openMove, setOpenMove] = createSignal<string | null>(null);
  const [anchor, setAnchor] = createSignal<DOMRect | null>(null);

  const open = (id: string, control: HTMLElement): void => {
    setAnchor(control.getBoundingClientRect());
    setOpenMove(id);
  };

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
                    <div class="move-header">
                      <code class="move-id">{move.id}</code>
                      <span class="move-gloss">{move.gloss}</span>
                      <Show when={mounted() && move.id === PREVIEW_MOVE}>
                        <button
                          type="button"
                          class="move-preview-eye"
                          data-move-preview
                          aria-label={`Preview ${move.id}`}
                          aria-expanded={openMove() === move.id}
                          onPointerEnter={(event) =>
                            open(move.id, event.currentTarget)
                          }
                          onClick={(event) =>
                            open(move.id, event.currentTarget)
                          }
                          onFocus={(event) =>
                            open(move.id, event.currentTarget)
                          }
                          onPointerLeave={() => setOpenMove(null)}
                        >
                          <span aria-hidden="true">👁</span>
                        </button>
                      </Show>
                      <span
                        class="move-badge"
                        role="img"
                        aria-label={move.badge.label}
                      >
                        {move.badge.text}
                      </span>
                    </div>
                    <p class="move-descriptor">{move.descriptor}</p>
                  </li>
                )}
              </For>
            </ul>
          </section>
        )}
      </For>
      <MovePreview
        move={openMove()}
        onClose={() => setOpenMove(null)}
        anchor={anchor()}
        loadStage={props.loadStage}
      />
      <p class="arsenal-spec">
        <a href={`${SPEC_GUIDE_PATH}#frame-table`} target="_blank">
          Reach, frames, stamina, cancels — see the full frame table{" "}
          <span aria-hidden="true">↗</span>
        </a>
      </p>
    </section>
  );
};

export default Arsenal;
