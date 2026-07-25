import { Show, type Component } from "solid-js";

import "./fight-card.css";
import ModelLogo from "./ModelLogo";
import { WATCH_PATH } from "../lib/paths";

// One archived fight as a link card, shared by the /watch index and the home page's fights
// section. It owns everything about how a fight presents itself as a card: the "A vs B" identity
// pairing, the flanking brand marks, the permalink it navigates to, and the short-id fragment that
// disambiguates a repeat challenge. Two consumers rendering that knowledge separately would drift,
// and the drift would be invisible from either file.

// Structurally the replay contract's `Fighter`, deliberately re-declared rather than imported:
// `shared/` must not depend on a page. A `Fighter` is assignable to it, so /watch passes its
// contract values straight through.
type CardFighter = { name: string; model: string };

// What a card needs to draw itself. `collides` comes from `markCollisions` — computed by each
// consumer over the cards IT shows, since ambiguity is a property of what is on screen together.
export type CardFight = {
  id: string;
  fighters: readonly [CardFighter, CardFighter];
  collides: boolean;
};

// One fighter's identity. The model is a separate chip, shown only when present — a bot document
// always carries a model, but the wire is treated defensively, so an absent/empty model renders
// name-only rather than an empty chip.
const FighterIdentity: Component<{ fighter: CardFighter }> = (props) => (
  <span class="replay-card-fighter">
    <span class="replay-card-name" title={props.fighter.name}>
      {props.fighter.name}
    </span>
    <Show when={props.fighter.model}>
      {(model) => <span class="replay-card-model">{model()}</span>}
    </Show>
  </span>
);

const FightCard: Component<{ fight: CardFight }> = (props) => (
  <a class="replay-card" href={`${WATCH_PATH}/${props.fight.id}`}>
    {/* Each fighter is flanked by their authoring brand's mark: the challenger's on the outer
        left, the King's on the outer right — logos mirror the "A vs B" symmetry so each mark hugs
        its own side of the card. */}
    <span class="replay-card-side">
      <ModelLogo model={props.fight.fighters[0].model} />
      <FighterIdentity fighter={props.fight.fighters[0]} />
    </span>
    <span class="replay-card-vs">vs</span>
    <Show when={props.fight.collides}>
      <span class="replay-card-id">{props.fight.id.slice(0, 6)}</span>
    </Show>
    <span class="replay-card-side replay-card-side-right">
      <FighterIdentity fighter={props.fight.fighters[1]} />
      <ModelLogo model={props.fight.fighters[1].model} />
    </span>
  </a>
);

export default FightCard;
