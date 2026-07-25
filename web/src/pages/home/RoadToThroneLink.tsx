import { type Component } from "solid-js";

import "./road-to-throne.css";
import { WATCH_PATH } from "../../shared/lib/paths";

// A champion's road to the throne: the 👁 link from their card to the fight that seated them.
// Rendered by both the Current King card and each Arena podium step — the same champion often
// appears in both — so the naming rule lives here once. A bare 👁 announces as "eye" and tells a
// screen-reader user nothing about where it leads, so the champion's name IS the link's accessible
// name and the glyph is decorative.
//
// A champion whose fight is unreachable renders no link at all (never a disabled one): callers
// guard on `replayId`, so this component only ever receives a real id.
const RoadToThroneLink: Component<{ name: string; replayId: string }> = (
  props,
) => (
  <a
    class="road-to-throne"
    href={`${WATCH_PATH}/${props.replayId}`}
    aria-label={`Watch ${props.name}'s road to the throne`}
  >
    <span aria-hidden="true">👁</span>
  </a>
);

export default RoadToThroneLink;
