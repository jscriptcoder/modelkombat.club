import { For, type Component, type Setter } from "solid-js";

import type { FigureControls } from "./controls";

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

type FigureControlPanelProps = {
  label: string;
  controls: FigureControls;
  onChange: Setter<FigureControls>;
};

const FigureControlPanel: Component<FigureControlPanelProps> = (props) => {
  // Merge one edited field into this figure's control state (immutable update).
  const patch = (partial: Partial<FigureControls>) =>
    props.onChange((prev) => ({ ...prev, ...partial }));

  // Unique per-panel ids so the challenger's and king's selects don't share label associations.
  const fieldId = (field: string) => `${props.label.toLowerCase()}-${field}`;

  return (
    <fieldset class="figure-controls">
      <legend>{props.label}</legend>

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

      <label class="control-check">
        <input
          type="checkbox"
          checked={props.controls.throwing}
          onChange={(e) => patch({ throwing: e.currentTarget.checked })}
        />
        Throwing
      </label>

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
