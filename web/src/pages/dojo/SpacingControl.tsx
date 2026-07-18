import { For, Show, type Component, type Setter } from "solid-js";

import { MAX_GAP, MIN_GAP, REACH_PRESETS } from "./reach-presets";

// The shared spacing control (one, not per-figure): it sets the distance between the two fighters.
// A reach-preset dropdown SNAPS the gap to a real engine move's reach (calibrate contact at true
// fight distances); a range slider sets any value freely. Both drive one `gap` signal in DojoApp;
// the numeric gap is shown for read-off. The tape builder turns `gap` into the centered positions.

// The slider moves in 1-world-unit steps (SCALE = 1000 sub-units/unit): fine enough to feel free,
// coarse enough that a dragged value can still land exactly on a preset reach (all multiples of 1000).
const GAP_STEP = 1_000;

// The codebase's "k sub-units" shorthand for a reach/gap (240000 → "240k") — how moves are named.
const formatGap = (gap: number) => `${gap / 1_000}k`;

// The sentinel the dropdown shows when the gap is a free slider value matching no preset reach.
const CUSTOM = "custom";

type SpacingControlProps = {
  gap: number;
  onChange: Setter<number>;
};

const SpacingControl: Component<SpacingControlProps> = (props) => {
  // The preset whose reach equals the current gap, or undefined when the gap is a free (slider) value.
  const matchingPreset = () => REACH_PRESETS.find((p) => p.reach === props.gap);

  // Snap to the chosen preset's reach; the CUSTOM sentinel (shown only for a free gap) is a no-op.
  const onPreset = (move: string) => {
    const preset = REACH_PRESETS.find((p) => p.move === move);

    if (preset) props.onChange(preset.reach);
  };

  return (
    <fieldset class="spacing-controls">
      <legend>Spacing</legend>

      <div class="control-select">
        {/* A <select> is not associated by <label for> (Slice 2 gotcha) — name it from the span. */}
        <span id="spacing-preset">Reach preset</span>
        <select
          aria-labelledby="spacing-preset"
          value={matchingPreset()?.move ?? CUSTOM}
          onChange={(e) => onPreset(e.currentTarget.value)}
        >
          {/* The Custom row appears only while the gap sits between presets, so it can read back. */}
          <Show when={!matchingPreset()}>
            <option value={CUSTOM}>Custom</option>
          </Show>
          <For each={REACH_PRESETS}>
            {(preset) => (
              <option value={preset.move}>
                {`${preset.move} (${formatGap(preset.reach)})`}
              </option>
            )}
          </For>
        </select>
      </div>

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
};

export default SpacingControl;
