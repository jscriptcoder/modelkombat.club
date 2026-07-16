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
  throwing: boolean;
  knockdown: boolean;
  points: number;
  stamina: number;
};

// One tick of the tape: the engine tick number plus both fighters' frames (challenger `a`, King `b`).
export type ReplayTick = { tick: number; a: ReplayFrame; b: ReplayFrame };
export type ReplayTape = ReplayTick[];

// `GET /replay` list item — an identities-only summary + the content-hash permalink id.
export type ReplaySummary = { id: string; fighters: [Fighter, Fighter] };

// `GET /replay/{id}` item — the reconstructed tape + both fighters' identities.
export type ReplayItem = { tape: ReplayTape; fighters: [Fighter, Fighter] };
