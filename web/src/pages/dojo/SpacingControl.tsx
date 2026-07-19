import { type Component, type Setter } from "solid-js";

import { MAX_GAP, MIN_GAP } from "./reach-presets";

// The shared spacing control (one, not per-figure): it sets the distance between the two fighters,
// freely, anywhere in [0, longest reach]. The tape builder turns `gap` into the centered positions.
//
// It used to also carry a "Reach preset" dropdown that snapped the gap by naming a move. The
// per-figure move picker now does that as part of committing a technique (S3), so the dropdown was
// retired rather than left to disagree with it — two controls naming moves, only one of which also
// poses the fighter (decision 5: the picker ABSORBS the preset dropdown). What remains here is the
// half the picker does not do: leaving the snap behind to judge a move at a distance the engine
// would never produce, which is the whole point of the lab (M10 free combos).

// The slider moves in 1-world-unit steps (SCALE = 1000 sub-units/unit): fine enough to feel free,
// coarse enough that a dragged value can still land exactly on a preset reach (all multiples of 1000).
const GAP_STEP = 1_000;

// The codebase's "k sub-units" shorthand for a reach/gap (240000 → "240k") — how moves are named.
const formatGap = (gap: number) => `${gap / 1_000}k`;

type SpacingControlProps = {
  gap: number;
  onChange: Setter<number>;
};

const SpacingControl: Component<SpacingControlProps> = (props) => (
  <fieldset class="spacing-controls">
    <legend>Spacing</legend>

    <div class="control-slider">
      {/* Name the range input from the span via aria-labelledby — like the selects, `<label for>`
          does not reliably associate an accessible name in this testing stack (Slice 2 gotcha). */}
      <span id="spacing-gap-label">Gap</span>
      <input
        type="range"
        aria-labelledby="spacing-gap-label"
        min={MIN_GAP}
        max={MAX_GAP}
        step={GAP_STEP}
        value={props.gap}
        onInput={(e) => props.onChange(Number(e.currentTarget.value))}
      />
      <output class="control-gap-value">{formatGap(props.gap)}</output>
    </div>
  </fieldset>
);

export default SpacingControl;
