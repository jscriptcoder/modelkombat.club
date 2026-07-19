// The local view-model mirror of the Slice 2 `/replay` JSON contract. `web/src` deliberately
// never imports from `src/` (the viewer consumes the tape as JSON, not the engine — decision 1),
// so the render-tape shape the API serves is re-declared here, exactly as `King.tsx` mirrors the
// `/king` contract and `RingPage.tsx` mirrors the `/fight` report. Kept type-only (no runtime
// logic): the fetch layer validates the wire, `scene` maps it, the page renders it.

// A fighter's public identity in a replay — name + model only (no handle; the archive carries
// none). `model` is a required string in the served payload (the bot document's `model` is
// required), but the fetch layer still treats the wire defensively.
export type Fighter = { name: string; model: string };

// One per-tick RENDER frame for a single fighter — the coherent post-tick body state the viewer
// draws. Mirrors the engine's `RenderFrame` (src/engine/sim.ts): position (`x`/`y`, fixed-point
// sub-units, SCALE=1000), `facing` (1 right / -1 left), the resolved pose fields, and the live
// score + stamina.
export type ReplayFrame = {
  x: number;
  y: number;
  facing: number;
  posture: number;
  attacking: boolean;
  attackBand: number;
  guardBand: number; // 0 none / 1 low / 2 mid / 3 high — the band a neutral blocker raises
  throwing: boolean;
  knockdown: boolean;
  points: number;
  stamina: number;
  // The committed action's reach in world sub-units (a strike's `spec.reach`, a throw's
  // `throw.reach`, 0 when idle) — the render-only engine field (src/engine/sim.ts) the viewer
  // aims the striking limb by. Optional + read defensively: the loader casts the wire wholesale,
  // so an absent / non-numeric / negative value is treated as 0 (⇒ no reach ⇒ stance pose, M7).
  attackReach?: number;
  // Which technique is committed (`MoveId | "sweep" | "throw"`, "" when none) and which phase of
  // it this frame shows (0 none / 1 startup / 2 active / 3 recovery) — the render-only engine
  // fields (src/engine/sim.ts) the viewer picks a per-move pose by. Optional + read defensively
  // like `attackReach`: an absent / unknown id falls back to the generic pose (M7).
  attackMove?: string;
  attackPhase?: number;
};

// One tick of the tape: the engine tick number plus both fighters' frames (challenger `a`, King `b`).
export type ReplayTick = { tick: number; a: ReplayFrame; b: ReplayFrame };
export type ReplayTape = ReplayTick[];

// `GET /replay` list item — an identities-only summary + the content-hash permalink id.
export type ReplaySummary = { id: string; fighters: [Fighter, Fighter] };

// `GET /replay/{id}` item — the reconstructed tape + both fighters' identities.
export type ReplayItem = { tape: ReplayTape; fighters: [Fighter, Fighter] };
