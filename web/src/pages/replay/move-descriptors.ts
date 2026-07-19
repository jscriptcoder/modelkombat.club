// The per-move POSE descriptor table: how each arsenal technique is DRAWN. Until this table
// existed, all 13 moves rendered the same picture — the front hand at a band height — so a front
// kick and a reverse punch were indistinguishable on screen.
//
// Purely AESTHETIC authoring data, tuned by eye in `/dojo`. Deliberately NOT merged with
// `reach-presets.ts` (decision 10): that table is a value-by-value MIRROR of the engine's move
// data and is pinned by a drift test, whereas everything here is a drawing choice with no engine
// counterpart and is free to be re-tuned. Two tables, two test disciplines.
//
// Moves absent from the table fall back to the generic hand pose, so the viewer stays fully usable
// while descriptors are authored one slice at a time.

// A pose coordinate in the local-px authoring frame. Imported TYPE-ONLY from scene.ts, which imports
// `limbFor` back from here — a type-only cycle is erased at compile time, so there is no runtime
// cycle and no need to hoist the type into a third module.
import type { Joint } from "./scene";

// Which skeleton endpoint a committed strike drives toward the opponent. The reach-to-target solve
// (`reachTargetX`) is identical whichever it is — only the endpoint it lands on differs, so a kick
// tracks true opponent distance exactly as a punch does, and the knee re-derives off the moved
// `hip → footR` for free (the bend rule runs on the FINAL endpoints).
//
// `handL` — the REAR hand — is what separates a reverse punch from a jab (S4). It also collides with
// the guard arm, which `poseFor` resolves in favour of the strike; see the precedence rule there.
export type StrikeLimb = "handR" | "handL" | "footR";

// Where the driven endpoint sits while the technique is WINDING UP or RECOVERING (S2). A chambered
// technique is a different SHAPE, not a shorter reach (M3) — scaling the extension down reads as a
// weak strike rather than a wind-up — so the descriptor authors one extra point in the same local-px
// frame as the stance constants. Optional: a move with no chamber keeps its stance endpoint through
// those phases, which is still a wind-up (arm returns to guard between strikes), just an unauthored
// one. Mid-joints re-derive from the endpoints at every phase, so a chambered limb bends for free.
export type MoveDescriptor = { limb: StrikeLimb; chamber?: Joint };

const DESCRIPTORS = new Map<string, MoveDescriptor>([
  // mae-geri (front kick): the front leg snaps out to the band, so the FOOT is the driven endpoint
  // and the front hand simply stays in its stance. Its chamber is the classic knee-up: the foot
  // drawn BACK under the hip (stance foot sits at x 14, the hip at x 0) and LIFTED off the ground,
  // so the derived knee rises toward hip height and the foot hangs beneath it. First authored from
  // anatomy rather than by eye — re-tuned in `/dojo` once the technique can be played (S2 slice 2).
  ["mae-geri", { limb: "footR", chamber: { x: 4, y: -22 } }],
  // gyaku-zuki (reverse punch): thrown with the REAR hand, which is the whole difference between it
  // and the jab — both are straight thrusts to the same bands, so the arm that travels is what a
  // spectator reads. The workhorse of every fight (~80% of committed screen time), and the first
  // authored move that appears on /watch at all. Chamber follows in S4 · Slice 2.
  ["gyaku-zuki", { limb: "handL" }],
]);

// What an undescribed move draws: today's generic front-hand strike (M7). Every move rendered this
// way before descriptors existed, so the fallback is not a degraded state — it is the status quo.
export const GENERIC_LIMB: StrikeLimb = "handR";

// The described move ids, exposed so a test can assert every key is a real arsenal move — a typo'd
// key would never match a tape's `attackMove` and would silently fall back forever.
export const DESCRIBED_MOVES: readonly string[] = [...DESCRIPTORS.keys()];

// Which endpoint this move drives. TOTAL: an unknown id, the engine's "" sentinel, and an absent
// field (the loader casts the wire wholesale, so the key may not be there) all fall back to the
// generic hand. A `Map` lookup — not a plain-object index — so an inherited key like "constructor"
// can never resolve to a descriptor.
export const limbFor = (move: string | undefined): StrikeLimb =>
  DESCRIPTORS.get(move ?? "")?.limb ?? GENERIC_LIMB;

// Where this move's driven endpoint sits while winding up / recovering, or `null` when the move
// authors no chamber (unknown id, the "" sentinel, an absent field, or simply not yet authored) —
// in which case the caller leaves the endpoint at its stance position (M7). TOTAL, same as limbFor.
export const chamberFor = (move: string | undefined): Joint | null =>
  DESCRIPTORS.get(move ?? "")?.chamber ?? null;
