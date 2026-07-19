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

// Which skeleton endpoint a committed strike drives toward the opponent. The reach-to-target solve
// (`reachTargetX`) is identical whichever it is — only the endpoint it lands on differs, so a kick
// tracks true opponent distance exactly as a punch does, and the knee re-derives off the moved
// `hip → footR` for free (the bend rule runs on the FINAL endpoints).
export type StrikeLimb = "handR" | "footR";

export type MoveDescriptor = { limb: StrikeLimb };

const DESCRIPTORS = new Map<string, MoveDescriptor>([
  // mae-geri (front kick): the front leg snaps out to the band, so the FOOT is the driven endpoint
  // and the front hand simply stays in its stance.
  ["mae-geri", { limb: "footR" }],
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
