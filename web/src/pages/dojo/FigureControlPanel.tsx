import { For, type Component, type Setter } from "solid-js";

import type { FigureControls } from "./controls";
import { MAX_GAP, MIN_GAP, REACH_PRESETS } from "./reach-presets";
import { BRANDS, type Brand } from "../../shared/lib/brand";

// One fighter's control panel: buttons + checkboxes + selects bound to that figure's raw pose fields.
// Deliberately raw fields (no mutually-exclusive action enum), so engine-impossible combos are
// reachable by design (M10). Rendered twice — once per fighter — reading/writing that figure's signal.

const POSTURES = [
  { value: 0, label: "Stand" },
  { value: 1, label: "Crouch" },
  { value: 2, label: "Air" },
] as const;

// −1 faces left, +1 faces right — the same convention the frame/scene flip uses.
const FACINGS = [
  { value: -1, label: "Face left" },
  { value: 1, label: "Face right" },
] as const;

// Height bands: 0 none / 1 low / 2 mid / 3 high (shared by attack + guard).
const BANDS = [
  { value: 0, label: "None" },
  { value: 1, label: "Low" },
  { value: 2, label: "Mid" },
  { value: 3, label: "High" },
] as const;

// The attack-reach slider travels the same [0, longest-reach] span as the spacing gap (0 = idle), in
// 1-world-unit steps — fine enough to feel free, coarse enough to land exactly on a preset reach.
const REACH_STEP = 1_000;

// The codebase's "k sub-units" shorthand for a reach (240000 → "240k"), for the slider's read-out.
const formatReach = (reach: number) => `${reach / 1_000}k`;

type FigureControlPanelProps = {
  label: string;
  controls: FigureControls;
  onChange: Setter<FigureControls>;
  // This figure's authoring brand — identity, kept separate from the pose `controls` (it never
  // flows through `controlsToFrame`); it rides the item, not the render frame.
  brand: Brand;
  onBrandChange: Setter<Brand>;
  // Selecting a technique is not a plain field patch — it STAMPS several controls at once and
  // restarts playback, so the page owns what a selection means and the panel only reports it.
  onSelectMove: (move: string) => void;
};

const FigureControlPanel: Component<FigureControlPanelProps> = (props) => {
  // Merge one edited field into this figure's control state (immutable update).
  const patch = (partial: Partial<FigureControls>) =>
    props.onChange((prev) => ({ ...prev, ...partial }));

  // Narrow the select's raw string value back to a Brand (the options ARE the brands, so a match
  // always exists; the generic fallback keeps it total without a type assertion).
  const toBrand = (value: string): Brand =>
    BRANDS.find((brand) => brand === value) ?? "generic";

  // Unique per-panel ids so the challenger's and king's selects don't share label associations.
  const fieldId = (field: string) => `${props.label.toLowerCase()}-${field}`;

  return (
    <fieldset class="figure-controls">
      <legend>{props.label}</legend>

      <div class="control-select">
        {/* Identity picker: the fighter's authoring-model brand glyph (its head). Named from the
            span via aria-labelledby, like the band selects — `<label for>` does not name a select. */}
        <span id={fieldId("brand")}>Brand</span>
        <select
          aria-labelledby={fieldId("brand")}
          value={props.brand}
          onChange={(e) => props.onBrandChange(toBrand(e.currentTarget.value))}
        >
          <For each={BRANDS}>
            {(brand) => <option value={brand}>{brand}</option>}
          </For>
        </select>
      </div>

      <div class="control-row" role="group" aria-label="Posture">
        <For each={POSTURES}>
          {(posture) => (
            <button
              type="button"
              class="control-segment"
              aria-pressed={
                props.controls.posture === posture.value ? "true" : "false"
              }
              onClick={() => patch({ posture: posture.value })}
            >
              {posture.label}
            </button>
          )}
        </For>
      </div>

      <div class="control-row" role="group" aria-label="Facing">
        <For each={FACINGS}>
          {(facing) => (
            <button
              type="button"
              class="control-segment"
              aria-pressed={
                props.controls.facing === facing.value ? "true" : "false"
              }
              onClick={() => patch({ facing: facing.value })}
            >
              {facing.label}
            </button>
          )}
        </For>
      </div>

      <label class="control-check">
        <input
          type="checkbox"
          checked={props.controls.attacking}
          onChange={(e) => patch({ attacking: e.currentTarget.checked })}
        />
        Attacking
      </label>

      <div class="control-select">
        {/* Which technique this fighter is committed to. Listed straight off the engine-mirror
            table, so the picker can never offer a move the engine doesn't have — and the "" idle
            row is the engine's own sentinel for nothing committed. Moves with no descriptor yet
            still draw (the renderer falls back to the generic hand, M7), so all 13 are selectable
            from the day the picker lands. Named from the span via aria-labelledby (M10). */}
        <span id={fieldId("move")}>Move</span>
        <select
          aria-labelledby={fieldId("move")}
          value={props.controls.attackMove}
          onChange={(e) => props.onSelectMove(e.currentTarget.value)}
        >
          <option value="">idle</option>
          <For each={REACH_PRESETS}>
            {(preset) => <option value={preset.move}>{preset.move}</option>}
          </For>
        </select>
      </div>

      <div class="control-select">
        {/* A <select> is not associated by <label for>, so name it from the visible span via
            aria-labelledby — the shown text stays the single source of the accessible name. */}
        <span id={fieldId("attack-band")}>Attack band</span>
        <select
          aria-labelledby={fieldId("attack-band")}
          value={props.controls.attackBand}
          onChange={(e) => patch({ attackBand: Number(e.currentTarget.value) })}
        >
          <For each={BANDS}>
            {(band) => <option value={band.value}>{band.label}</option>}
          </For>
        </select>
      </div>

      <div class="control-slider">
        {/* The committed reach (world sub-units) the strike aims by (Story 5): dial it to any move's
            distance so contact can be signed off by eye. Named from the span via aria-labelledby — a
            range input, like a select, is not associated by `<label for>` in this stack (Slice 2). */}
        <span id={fieldId("attack-reach")}>Attack reach</span>
        <input
          type="range"
          aria-labelledby={fieldId("attack-reach")}
          min={MIN_GAP}
          max={MAX_GAP}
          step={REACH_STEP}
          value={props.controls.attackReach}
          onInput={(e) => patch({ attackReach: Number(e.currentTarget.value) })}
        />
        <output class="control-gap-value">
          {formatReach(props.controls.attackReach)}
        </output>
      </div>

      <div class="control-select">
        <span id={fieldId("guard-band")}>Guard band</span>
        <select
          aria-labelledby={fieldId("guard-band")}
          value={props.controls.guardBand}
          onChange={(e) => patch({ guardBand: Number(e.currentTarget.value) })}
        >
          <For each={BANDS}>
            {(band) => <option value={band.value}>{band.label}</option>}
          </For>
        </select>
      </div>

      {/* No `throwing` checkbox: a throw is previewed by selecting `throw` in the move picker above,
          which the renderer dispatches off `attackMove` (S6 · Slice 3). The `frame.throwing` boolean
          is no longer read, so a checkbox for it would be a dead control. */}
      <label class="control-check">
        <input
          type="checkbox"
          checked={props.controls.knockdown}
          onChange={(e) => patch({ knockdown: e.currentTarget.checked })}
        />
        Knockdown
      </label>
    </fieldset>
  );
};

export default FigureControlPanel;
