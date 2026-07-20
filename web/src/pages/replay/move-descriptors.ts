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
//
// `footL` — the REAR leg — is what separates a roundhouse from a front kick (S4 · Slice 6). Both kicks
// drive a foot to the same solved target, so under M3 (only the driven endpoint moves) driving the
// same foot would render them identically; the roundhouse takes the M12i escape hatch and drives the
// OTHER leg, which is the one distinction a 2-D side view can show that a lateral hip turn cannot.
//
// `elbowR` / `kneeR` (+ their L mirrors) — the close-range INVERSION (S5). Every endpoint above drives
// a hand / foot and lets the bend rule DERIVE the mid-joint; an empi (elbow) or hiza-geri (knee) leads
// with the MID-JOINT — it drives to the target while the trailing fist / foot folds back behind it
// (see `tuck`). scene.ts writes the driven joint back over the derived bend, so the elbow / knee keeps
// the reach and the endpoint keeps its fold.
export type StrikeLimb =
  | "handR"
  | "handL"
  | "footR"
  | "footL"
  | "elbowR"
  | "elbowL"
  | "kneeR"
  | "kneeL";

// Where the driven endpoint sits while the technique is WINDING UP or RECOVERING (S2). A chambered
// technique is a different SHAPE, not a shorter reach (M3) — scaling the extension down reads as a
// weak strike rather than a wind-up — so the descriptor authors one extra point in the same local-px
// frame as the stance constants. Optional: a move with no chamber keeps its stance endpoint through
// those phases, which is still a wind-up (arm returns to guard between strikes), just an unauthored
// one. Mid-joints re-derive from the endpoints at every phase, so a chambered limb bends for free.
// Where the technique's OTHER hand goes at contact — `hikite`, the fist withdrawn to the hip as the
// punch lands (S4). A second authored endpoint, and the first crack in M3's "only the driven endpoint
// moves": the rear-hand drive alone reads faintly, because both arms hang off one shared shoulder, so
// the extended arm lands in nearly the same place whichever hand throws. Pulling the off hand back is
// what makes the punch read from the punching side. Optional — a move that authors none keeps its
// stance hand, which is what every move did before this existed.
// Where the trailing fist / foot folds when the driven `limb` is a MID-JOINT (S5) — the fold is
// RELATIVE to the driven elbow / knee (M13c), so it rides with the joint across every phase (chamber
// and contact alike) for free. Only a mid-joint move authors one; an endpoint-driving move leaves it
// absent and its endpoint is the driven point itself.
export type MoveDescriptor = {
  limb: StrikeLimb;
  chamber?: Joint;
  offHand?: Joint;
  tuck?: Joint;
};

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
  // Chamber: the rear fist waits at the flank, drawn back behind its stance position. Off hand: the
  // front fist withdraws toward the hip as the punch lands. Both sit at the same rib height, which is
  // what a loaded and a pulling fist share anatomically.
  //
  // The off hand was authored at the hip first — where karate actually puts it — then pulled forward
  // to the flank in slice 4, because the rigid girdle slid the FRONT shoulder to x 23 and an authored
  // point must stay inside the ARM'S REACH of its shoulder (~31 local px, two ARM_BONEs) or deriveBend
  // straightens the limb and the withdrawn fist renders as a stretched line. S4 · Slice 5 rotates the
  // girdle instead, so the front shoulder holds at x 7 and the reachable envelope opens back to the
  // hip — which is where this pays off. The same bone-length constraint S2 · Slice 3 established still
  // bounds it (span 30.4 vs a 31.3 reach), so it is eye-tuned right up to that edge, not past it.
  [
    "gyaku-zuki",
    { limb: "handL", chamber: { x: -26, y: -50 }, offHand: { x: -20, y: -50 } },
  ],
  // mawashi-geri (roundhouse): the second move with real screen time (~13%), and the one that forces
  // M3's expressiveness limit. A front kick and a roundhouse both drive a FOOT to the same solved
  // target, so driving the same foot renders them on the identical pixel — the wall the girdle was
  // built to break, now on kicks. The girdle cannot help (it separates moves only when they drive
  // DIFFERENT limbs, M12i), so the roundhouse drives the REAR leg (`footL`): the rear foot swings
  // across to the near edge while the front foot holds as the support leg, a picture the front kick
  // never draws. Chamber: the rear knee cocked up and back, so the wind-up reads as a leg loading to
  // whip around rather than the front leg's straight knee-up. Eye-tuned in /dojo, relations pinned.
  ["mawashi-geri", { limb: "footL", chamber: { x: -8, y: -30 } }],
  // empi (elbow strike): the first CLOSE-RANGE technique, and the first that leads with a MID-JOINT.
  // The ELBOW is the driven point — it drives to the opponent's near edge at the band while the fist
  // folds back behind it (`tuck`, relative to the elbow so it rides across every phase, M13c). Every
  // other strike drives an ENDPOINT and lets the bend rule derive the elbow; this inverts that, and
  // scene.ts writes the driven elbow back over the derived bend (S5 · Slice 1). Chamber: the elbow
  // cocked BACK and up (a loaded elbow) before it drives forward to contact — the fist rides with it
  // via the same relative tuck. Both eye-tuned in /dojo, relations pinned.
  [
    "empi",
    { limb: "elbowR", chamber: { x: -10, y: -42 }, tuck: { x: -12, y: -8 } },
  ],
  // hiza-geri (knee strike): the LEG mirror of empi, and the second move to lead with a MID-JOINT. The
  // KNEE is the driven point — it drives up to the opponent's near edge at the mid band while the foot
  // folds back behind and below it (`tuck`, relative to the knee so it rides across every phase, M13c).
  // Rooted at the single `hip` (no girdle), a knee strike neither steps nor leans (M13f); the OTHER leg
  // (footL) holds as the support. scene.ts writes the driven knee back over the derived hip→foot bend,
  // exactly as it does the elbow for empi (S5 · Slice 2). Chamber: the knee cocked LOW (near hip
  // height) before it drives up and forward to the band — the foot rides with it via the same relative
  // tuck. Both eye-tuned in /dojo, relations pinned.
  [
    "hiza-geri",
    { limb: "kneeR", chamber: { x: 6, y: -30 }, tuck: { x: -8, y: 14 } },
  ],
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

// Where this move's OTHER hand is pulled to at contact (`hikite`), or `null` when the move authors
// none — in which case the caller leaves that hand at its stance position (M7). TOTAL, same as the
// two lookups above.
export const offHandFor = (move: string | undefined): Joint | null =>
  DESCRIPTORS.get(move ?? "")?.offHand ?? null;

// Where this move's trailing fist / foot folds, RELATIVE to the driven mid-joint (S5) — or `null` when
// the move drives an endpoint and has no fold (every move but empi / hiza-geri today, plus the usual
// unknown-id / "" / absent-field fallbacks). TOTAL, same shape as chamberFor / offHandFor.
export const tuckFor = (move: string | undefined): Joint | null =>
  DESCRIPTORS.get(move ?? "")?.tuck ?? null;
