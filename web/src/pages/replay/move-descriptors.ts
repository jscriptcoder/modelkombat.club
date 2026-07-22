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
// OTHER leg, which is the one distinction a 2-D side view can show that a lateral hip turn cannot. The
// back kick (`ushiro-geri`) joins it on the rear leg for the same reason, so the front-leg kicks
// (`mae-geri`, `yoko-geri`) and the rear-leg kicks (`mawashi-geri`, `ushiro-geri`) split into two
// pictures — the most a side view can separate four kicks that all solve to one target.
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
// A FIXED near-ground / fixed-height y (local px) the driven endpoint targets, OVERRIDING the band
// height (S6). A `sweep` has no meaningful band — the engine leaves it UNRESTRICTED, so `attackBand`
// is whatever the bot asked for — but it always reaps along the FLOOR, so its height is a drawing
// constant, not a band read. Mirrors how the throw grab pins to a fixed chest height rather than a
// band. Only a move whose height is band-independent authors one; every banded strike leaves it
// absent and takes `bandHeight(attackBand)` as before. Optional, so the reach solve still supplies x.
// A GRAB (throw): this move drives BOTH hands into a two-handed grip on the opponent's near edge
// rather than a single limb to a band (S6 · Slice 3). It is the last move to dispatch through the
// descriptor table — before this the throw was drawn off a separate `frame.throwing` boolean, the one
// non-descriptor render path left. A grab authors no `limb` (it drives two hands, not one) and no band
// (the grip is at a fixed chest height, solved in scene.ts); the flag is all the table carries — the
// grab GEOMETRY lives with the reach solve, exactly as band heights do for a strike.
// A per-move torso LEAN (per-move character S2): a horizontal shift (local px) of the upper body
// (head + shoulder) at the ACTIVE phase, an authored counterpart to the reach-derived hand lean in
// scene.ts. Sign matches that lean — `+` pitches FORWARD into the target, `−` leans BACK away from it
// (a counterbalance). Until now the lean was a DERIVED, hand-only value and a kick was held upright
// (M9); authoring one lets a move opt into a posture — `yoko-geri`'s bladed side kick leans back, the
// first kick to lean at all. Optional: a move that authors none stays upright exactly as today, so
// M9 becomes "a kick is upright BY DEFAULT, an authored lean is the exception". Horizontal only — a
// vertical pitch is not needed for the lean-back / lean-forward pair (D8) and can widen the field
// later. It shifts head + shoulder but not the girdle (a torso pitch is not an arm rotation) nor the
// hip (a kick's reach is still answered by its own hip step). Eye-tuned in /dojo, relation pinned.
// A per-move ARC via-waypoint (per-move character S3): a wind-up waypoint (local px, same frame as
// `chamber`) that the driven point's stance→chamber leg BOWS through, so the technique loads on a curve
// rather than a straight line. `mawashi-geri`'s rear foot swings up-and-around off it — the roundhouse's
// circular load, the one execution cue a 2-D side view can show that a lateral hip turn cannot. It rides
// the WIND-UP leg only, never the chamber→contact kime (S1 · S8): an arc there would soften the strike's
// snap. Applied as a quadratic Bézier that PINS both endpoints (stance and chamber), so the chamber is
// still reached at the last startup tick and CONTACT is byte-unchanged. Optional: a move that authors
// none keeps the straight ease exactly as today. Eye-tuned in /dojo, the bow's SIDE pinned, not the pixel.
export type MoveDescriptor = {
  // Absent for a grab — a throw drives two hands, not one endpoint. `limbFor` falls back to the generic
  // hand for it, which is never consulted because a grab suppresses its own strike layer (scene.ts).
  limb?: StrikeLimb;
  chamber?: Joint;
  offHand?: Joint;
  tuck?: Joint;
  targetY?: number;
  grab?: boolean;
  lean?: number;
  arc?: Joint;
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
  // The FRONT-hand trio (uraken / kizami-zuki / shuto): three techniques that all drive the front hand
  // (handR) to the same solved target, so under M3 they land the identical contact picture and used to
  // read apart only by reach — the hand analogue of the two same-limb kick pairs. What separates them is
  // HOW they WIND UP: each authors its OWN chamber (S1), so the startup POSITIONS are three different
  // shapes on /dojo + /watch even though contact is byte-unchanged (the reach solve at the active phase
  // ignores the chamber). Per-move character S5 then gives the two the jab cannot express their own wind-up
  // PATH: uraken and shuto author an `arc` via (the S3 lever, reused) so each hand LOADS on a curve, while
  // kizami-zuki (the jab) stays the straight ease — and the two curve to OPPOSITE sides, so they read apart
  // from each other, not just from the jab. Like every arc it rides the WIND-UP only; the whip / chop into
  // contact is the untouchable kime (S1 · S8), so contact is byte-unchanged. No new mechanism — the same
  // `chamber` + `arc` fields the kicks already use. Each chamber AND each via sits well inside an ARM'S
  // reach of the front shoulder (7, −64) so deriveBend never straightens the limb into a stretched line.
  // Eye-tunable in /dojo; the bow's SIDE + the pair's contrast are pinned, not the pixels.
  //
  // kizami-zuki (jab): fast and minimal — the lead fist waits high and slightly forward, near the guard,
  // barely cocked. The shortest wind-up of the three, which is what a jab IS. No arc — the straight jab is
  // the group's no-arc control, the way ushiro-geri is for the rear-foot pair.
  ["kizami-zuki", { limb: "handR", chamber: { x: 12, y: -50 } }],
  // uraken (backfist): the fist cocks ACROSS the centreline and high, loaded to whip back out — the
  // across-the-body start a straight jab never draws. Its wind-up ARCS (S5): the fist rises up-and-forward
  // off the straight stance→chamber line before swinging back across into the cocked chamber — a curved
  // backfist load, bowing to the opposite side from shuto's.
  [
    "uraken",
    { limb: "handR", chamber: { x: -8, y: -56 }, arc: { x: 8, y: -60 } },
  ],
  // shuto (knife-hand): chambered HIGH, up by the ear, to chop down-and-in — the highest cock of the
  // three, distinct from the jab's forward-low guard and the backfist's across-the-body load. Its wind-up
  // ARCS (S5) the OTHER way from uraken: the hand dips back before rising to the high by-the-ear cock, so
  // the knife-hand loads on a distinct curved path.
  [
    "shuto",
    { limb: "handR", chamber: { x: -2, y: -62 }, arc: { x: 2, y: -46 } },
  ],
  // mawashi-geri (roundhouse): the second move with real screen time (~13%), and the one that forces
  // M3's expressiveness limit. A front kick and a roundhouse both drive a FOOT to the same solved
  // target, so driving the same foot renders them on the identical pixel — the wall the girdle was
  // built to break, now on kicks. The girdle cannot help (it separates moves only when they drive
  // DIFFERENT limbs, M12i), so the roundhouse drives the REAR leg (`footL`): the rear foot swings
  // across to the near edge while the front foot holds as the support leg, a picture the front kick
  // never draws. Chamber: the rear knee cocked up and back, so the wind-up reads as a leg loading to
  // whip around rather than the front leg's straight knee-up.
  //
  // What separates it from the OTHER rear-leg kick (`ushiro-geri`, a straight back-thrust) is EXECUTION
  // (per-move character S3): the foot ARCS up-and-around as it winds up, bowing out (−x) off the straight
  // stance→chamber line before folding into the cocked chamber — the roundhouse's circular load. The arc
  // rides the wind-up only; the kime snap into contact is untouched (S8), so contact is byte-unchanged.
  // Eye-tuned in /dojo, the bow's SIDE pinned, not the pixel.
  [
    "mawashi-geri",
    { limb: "footL", chamber: { x: -8, y: -30 }, arc: { x: -26, y: -16 } },
  ],
  // yoko-geri (side kick): the FRONT leg thrusts edge-on to the mid band, so the FOOT drives (footR),
  // exactly like mae-geri — NOT the hand it fell back to before authoring. Being the arsenal's
  // second-longest reach (315k), that fallback telescoped an ARM the whole way across the gap and read
  // as a stretched limb rather than a kick (spotted on /dojo + the /sheet contact sheet). It shares
  // mae-geri's front-leg picture at full extension — both footR to the same solved target, the M3 limit
  // a 2-D side view cannot escape.
  //
  // What now reads it APART from the front kick is EXECUTION (per-move character S2): a bladed side kick
  // pitches the upper body BACK off the extending leg (a counterbalance — `lean` negative), where a
  // front kick snaps straight and upright, and it loads off a knee cocked high and across the centreline
  // (chamber), distinct from mae-geri's straight knee-up. This is the first kick to lean at all — the
  // conscious M9 exception. Both eye-tunable in /dojo; the lean's SIGN and the chamber's relation are
  // pinned, not the pixel.
  ["yoko-geri", { limb: "footR", chamber: { x: 8, y: -28 }, lean: -8 }],
  // ushiro-geri (back kick): thrusts to the mid / high band with the REAR leg (footL) — the roundhouse's
  // escape hatch (M12i) reused, so the back kick reads apart from the front-leg side kick the same way
  // the roundhouse reads apart from the front kick (both footL kicks share the rear-leg extension). It
  // is the arsenal's LONGEST reach (330k); before authoring it fell back to the hand and stretched the
  // arm the furthest of any move — the exact "arm stretches enormously" the S3 dojo snap first surfaced
  // (docs/archive/move-poses-s3.md). Chamber: the rear knee lifted and cocked back before the heel drives
  // through.
  //
  // What separates it from the OTHER rear-leg kick (`mawashi-geri`, upright + an arcing foot) is EXECUTION
  // on TWO axes: S3 gave mawashi its foot arc while ushiro stays a straight thrust; per-move character S4
  // adds POSTURE — the torso pitches FORWARD into the linear back-thrust (`lean` POSITIVE, the counterpart
  // to yoko-geri's negative lean-back), a committed forward drive where the roundhouse holds upright. This
  // is the SECOND kick to author a lean, riding the M9 amendment S2 already made (a kick is upright BY
  // DEFAULT; an authored lean is the exception) — mae/mawashi keep their upright default. Eye-tuned in
  // /dojo within the arm's reach (a forward lean stretches the REAR arm, mirroring yoko's front-arm case);
  // the lean's SIGN and its ordering against yoko/mae are pinned, not the pixel.
  ["ushiro-geri", { limb: "footL", chamber: { x: -4, y: -24 }, lean: 8 }],
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
  // sweep (ashi-barai): the first NON-strike technique to get a descriptor, and the first to drive its
  // endpoint to a FIXED height rather than a band. The front FOOT reaps forward to the opponent's near
  // edge — the same reach-to-target solve a kick uses — but at `targetY` near the floor, not at the
  // requested band: the engine leaves sweep's band UNRESTRICTED, so a sweep committed high/mid/low all
  // read as the same floor reap (and it draws even at band 0, unlike a banded kick). Chamber: the foot
  // cocked back and lifted before it reaps down and forward. Eye-tuned in /dojo, relations pinned.
  ["sweep", { limb: "footR", targetY: -8, chamber: { x: 4, y: -14 } }],
  // tobi-geri (jumping front kick): the only AIRBORNE technique, and the last non-strike move to get a
  // descriptor. The front FOOT drives to the band exactly as a grounded front kick does — but from the
  // AIR stance, whose tucked legs already separate it from a grounded kick (no M12i escape hatch
  // needed). No chamber: the AIR stance's tucked `footR` IS the wind-up (tuck → extend → tuck), so an
  // authored cock would fight it. The airborne hip HOLDS rather than stepping into the reach — the jump
  // arc supplies the closing and the leg telescopes for the residual (see the `isAirborne` gate in
  // scene.ts), which is why this leads with `footR` yet reads apart from a lunging grounded kick.
  ["tobi-geri", { limb: "footR" }],
  // throw: the last move to get a descriptor, and the only GRAB. It authors no limb and no band —
  // the two-hand grip is solved at a fixed chest height in scene.ts (`throwGrabFor`). Adding it here
  // retires the last non-descriptor render path: the grab now dispatches on `attackMove:"throw"` (which
  // the engine emits on every throw frame) instead of the `frame.throwing` boolean, so a real /watch
  // throw renders byte-identically while the /dojo picker — which stamps the move id but never the
  // flag — finally draws the grab instead of a generic hand.
  ["throw", { grab: true }],
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

// The fixed near-ground / fixed-height y this move drives its endpoint to, OVERRIDING the band height,
// or `null` when the move takes its height from `attackBand` as usual (every banded strike, plus the
// unknown-id / "" / absent-field fallbacks). Only `sweep` authors one today. TOTAL, same shape as the
// three lookups above.
export const targetYFor = (move: string | undefined): number | null =>
  DESCRIPTORS.get(move ?? "")?.targetY ?? null;

// Whether this move is a two-hand GRAB (a throw), so the renderer draws both hands into a grip instead
// of a single limb to a band — and suppresses the move's strike layer (a grab is not a strike). TOTAL:
// only `throw` answers true; an unknown id, the "" idle sentinel, an absent field, and every strike
// answer false, so a strike is never mistaken for a grab. Same `Map`-lookup safety as the lookups above.
export const isGrab = (move: string | undefined): boolean =>
  DESCRIPTORS.get(move ?? "")?.grab ?? false;

// This move's authored torso lean (per-move character S2), or `null` when it authors none — in which
// case the caller applies no lean and the upper body stays upright (M9's default; every move but
// `yoko-geri` today, plus the usual unknown-id / "" / absent-field fallbacks). TOTAL, same `Map`-lookup
// shape as the lookups above. `null` rather than 0 keeps "authors no lean" distinct at the boundary,
// exactly as `chamberFor` returns `null` for "no chamber".
export const leanFor = (move: string | undefined): number | null =>
  DESCRIPTORS.get(move ?? "")?.lean ?? null;

// This move's authored wind-up ARC via-waypoint (per-move character S3), or `null` when it authors none —
// in which case the wind-up stays the straight stance→chamber ease (every move but `mawashi-geri` today,
// plus the usual unknown-id / "" / absent-field fallbacks). TOTAL, same `Map`-lookup shape as the lookups
// above; `null` (not a zero point) keeps "authors no arc" distinct at the boundary, like chamberFor/leanFor.
export const arcFor = (move: string | undefined): Joint | null =>
  DESCRIPTORS.get(move ?? "")?.arc ?? null;
