import { describe, expect, it } from "vitest";

import { contactSheetCells } from "./contact-sheet";
import { REACH_PRESETS } from "../dojo/reach-presets";
import type { Viewport } from "../replay/scene";

// The contact sheet's DATA layer (S7): one attacker figure per arsenal move, each posed at its ACTIVE
// phase, so a developer can compare every technique at a glance. Pure (no Pixi) — it drives the same
// selectMove → buildDojoTape → scene path /watch ships, so "what a move looks like here is what it
// looks like in a fight". These assertions follow decision 9: pin the RELATION (this endpoint reached
// forward, this cell is airborne), never the eye-tuned literal, so re-tuning a pose never breaks them.

// A fixed logical viewport sizes the figure scale; small enough for a grid cell. Same for every cell,
// so all figures share one scale (a fair comparison).
const FIGURE_VIEWPORT: Viewport = { width: 300, height: 300 };

const cellFor = (id: string) => {
  const cell = contactSheetCells(FIGURE_VIEWPORT).find((c) => c.id === id);

  if (!cell) throw new Error(`no contact-sheet cell for "${id}"`);

  return cell;
};

describe("contactSheetCells — one attacker figure per arsenal move", () => {
  it("renders exactly one cell per move in the engine-mirror table", () => {
    const cells = contactSheetCells(FIGURE_VIEWPORT);

    // Key-set coverage (decision 10): the sheet covers precisely the arsenal, so a move added to the
    // preset table can never be silently dropped from the sheet, and none is invented.
    expect(cells.map((c) => c.id).sort()).toEqual(
      REACH_PRESETS.map((p) => p.move).sort(),
    );
  });

  it("draws the ATTACKER in every cell, not the idle opponent", () => {
    // The challenger throws the move facing right (+1); the idle king faces left (-1). Reading the
    // attacker's own figure (scene.a, not scene.b) is what makes each cell show a technique at all.
    for (const cell of contactSheetCells(FIGURE_VIEWPORT)) {
      expect(cell.placement.facing).toBe(1);
    }
  });

  it("poses a roundhouse at its ACTIVE phase — the driven rear foot swung forward past the hip", () => {
    // mawashi-geri drives the REAR foot (footL), which sits BEHIND the hip at stance and while
    // chambering; only at the active phase does it swing forward to the solved target. Asserting it
    // landed forward of the hip proves the sheet chose the active tick, not an idle / chamber one.
    const mawashi = cellFor("mawashi-geri");

    expect(mawashi.placement.pose.footL.x).toBeGreaterThan(
      mawashi.placement.pose.hip.x,
    );
  });

  it("drives the front hand forward for a hand technique, not a blank figure", () => {
    // uraken drives the front hand (handR) — since S1 via its own descriptor, before that via the
    // generic fallback; either way its hand reaches forward at the active phase (its S1 chamber changes
    // the WIND-UP, not this contact frame). A real strike, well past a move that does NOT drive the hand
    // (mae-geri, a kick, leaves handR at stance). No blank cell.
    const uraken = cellFor("uraken");
    const maeGeri = cellFor("mae-geri");

    expect(uraken.placement.pose.handR.x).toBeGreaterThan(
      maeGeri.placement.pose.handR.x,
    );
  });

  it("renders the jump kick AIRBORNE so it reads apart from a grounded front kick", () => {
    // tobi-geri is the only airborne technique. Rendered grounded it would duplicate mae-geri (both
    // drive footR to the band); the sheet mirrors the engine and poses it from the AIR stance, whose
    // support foot is tucked off the ground — proven by the support foot sitting above the baseline.
    const tobi = cellFor("tobi-geri");
    const maeGeri = cellFor("mae-geri");

    expect(tobi.placement.pose.footL.y).toBeLessThan(0); // lifted off the ground line
    expect(tobi.placement.pose.footL.y).toBeLessThan(
      maeGeri.placement.pose.footL.y,
    );
  });

  it("poses each move at ITS OWN true reach — a longer-reaching move extends further", () => {
    // Each cell spaces its idle opponent one move-reach away, so the reach-to-target solve extends the
    // driven endpoint to that move's real contact distance — not a shared gap. uraken (200k reach) and
    // shuto (260k) both drive the front hand, so comparing their hands isolates reach: the longer move's
    // hand lands further forward. Pins per-move true reach (kills a fixed-gap mutant). Both are S1
    // front-hand moves now, but their chambers change only the WIND-UP — at this active contact frame
    // each still drives handR to its own solved reach, so the hand-vs-hand comparison is unaffected.
    // (This pair used to be uraken vs ushiro-geri; ushiro-geri now drives a FOOT — see the kick test
    // below — so a hand move stands in to keep the reach comparison a hand-vs-hand.)
    const uraken = cellFor("uraken");
    const shuto = cellFor("shuto");

    expect(shuto.placement.pose.handR.x).toBeGreaterThan(
      uraken.placement.pose.handR.x,
    );
  });

  it("poses the reach-apex kicks with a driven FOOT, not a stretched hand", () => {
    // yoko-geri (side kick, 315k) and ushiro-geri (back kick, 330k) are the two longest reaches and
    // used to fall back to the generic front HAND — telescoping an arm across the gap on the very sheet
    // a developer compares moves on. Each now drives a FOOT past the hip (yoko the front footR, ushiro
    // the rear footL), and parks the front hand at stance where a kick leaves it, exactly as mae-geri
    // does — not stretched forward like an undescribed hand move.
    const yoko = cellFor("yoko-geri");
    const ushiro = cellFor("ushiro-geri");
    const maeGeri = cellFor("mae-geri"); // a known kick: hand parked at stance

    // The side kick drives the front foot forward of the hip...
    expect(yoko.placement.pose.footR.x).toBeGreaterThan(
      yoko.placement.pose.hip.x,
    );
    // ...and the back kick drives the rear foot forward of the hip (the M12i escape hatch).
    expect(ushiro.placement.pose.footL.x).toBeGreaterThan(
      ushiro.placement.pose.hip.x,
    );
    // Neither stretches the hand: both leave handR where a kick does, matching mae-geri's parked hand.
    expect(yoko.placement.pose.handR.x).toBe(maeGeri.placement.pose.handR.x);
    expect(ushiro.placement.pose.handR.x).toBe(maeGeri.placement.pose.handR.x);
  });
});
