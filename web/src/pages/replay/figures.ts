import { Container, Graphics, Text } from "pixi.js";

import {
  bodyHeightPx,
  ringLayout,
  ringTransform,
  type RingLayout,
  type Scene,
  type Skeleton,
  type Viewport,
} from "./scene";
import type { Fighter } from "./replay-contract";
import {
  BRAND_GLYPH,
  GROK_CANVAS_INK,
  modelToBrand,
  type Brand,
} from "../../shared/lib/brand";

// The Pixi draw layer: builds the scene-graph (two stickmen + a HUD) and applies a `Scene` to it.
// Deliberately free of `Application` / renderer / ticker — those live in the player component — so
// the mapping from Scene → display-object state is verifiable with plain display-object assertions.

// Challenger (a) vs King (b) — two colours so the fighters read apart at a glance. The body/limbs
// carry the side colour; the head is the fighter's brand glyph (below), so identity and side read
// on different parts.
const CHALLENGER_COLOR = 0x4fd1c5;
const KING_COLOR = 0xf6ad55;

// The head glyph is a fixed proportion of the body's height (M11: 0.3× body height), so the brand
// mark grows WITH the world-scaled body instead of staying a fixed dot. Sized per-viewport in
// `createStage` from `bodyHeightPx`; the shared 24-unit geometry scales up to fill the head box.
const HEAD_HEIGHT_RATIO = 0.3;

// The canvas-ready SVG string for a brand's head glyph: the shared 0..24 geometry wrapped in an
// `<svg>` element Pixi's `Graphics.svg()` parses. Grok's geometry inks to `currentColor` (theme-aware
// in the DOM), which Pixi cannot resolve, so the canvas substitutes an explicit near-white ink; the
// hued brands' baked colours pass through untouched — the DOM and the viewer draw the same geometry.
export const glyphSvg = (brand: Brand): string => {
  const geometry =
    brand === "grok"
      ? BRAND_GLYPH.grok.replaceAll("currentColor", GROK_CANVAS_INK)
      : BRAND_GLYPH[brand];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${geometry}</svg>`;
};

// Each fighter's authoring model → its brand, challenger (a) then King (b) — the same order
// `createStage` assigns the pair, so a fighter's head always wears its own author's mark.
export const brandsFor = (
  fighters: readonly [Fighter, Fighter],
): [Brand, Brand] => [
  modelToBrand(fighters[0].model),
  modelToBrand(fighters[1].model),
];

// A fighter's persistent scene-graph: a root container the scene positions + flips, holding one
// child container per skeleton joint (the head container carries the visible brand glyph; the rest
// are pivots the bones connect). A pose change moves the joint containers (cheap transforms) — the
// joints are the asserted, persistent display objects, since a `Graphics` path is opaque to
// display-object assertions.
export type FigureNodes = {
  root: Container;
  head: Container;
  shoulder: Container;
  hip: Container;
  handL: Container;
  handR: Container;
  footL: Container;
  footR: Container;
  shoulderL: Container;
  shoulderR: Container;
  elbowL: Container;
  elbowR: Container;
  kneeL: Container;
  kneeR: Container;
};

// The line segments (stroked into the `bones` Graphics) that connect the joints into a stickman:
// the torso, two LEGS jointed at the knee (hip→knee→foot) and two ARMS jointed at the elbow
// (shoulderL/R→elbow→hand) so the limbs read bent, not rigid (Story 4). The head is the brand glyph
// riding the head joint.
//
// The spine still terminates at `shoulder` — the girdle's MIDPOINT — and the girdle bar spans the two
// ends the arms hang from (S4 · Slice 4). On a knockdown both ends sit on the one authored point, so
// the bar collapses to zero length and strokes nothing, which is what keeps a downed body unchanged.
// Exported so a test can assert the WIRING — which joints the stickman connects. The strokes land in
// a `Graphics` path, which is opaque to display-object assertions, so re-rooting an arm here or
// dropping the girdle bar is invisible to every other test in the suite even though both are plainly
// visible on screen. Same discipline as `DESCRIBED_MOVES`: expose the table, assert the contract.
export const BONES: ReadonlyArray<readonly [keyof Skeleton, keyof Skeleton]> = [
  ["hip", "shoulder"],
  ["hip", "kneeL"],
  ["kneeL", "footL"],
  ["hip", "kneeR"],
  ["kneeR", "footR"],
  ["shoulderL", "shoulderR"],
  ["shoulderL", "elbowL"],
  ["elbowL", "handL"],
  ["shoulderR", "elbowR"],
  ["elbowR", "handR"],
];

type Figure = { nodes: FigureNodes; bones: Graphics; color: number };

const createFigure = (color: number, brand: Brand, headPx: number): Figure => {
  const root = new Container();
  const bones = new Graphics();

  // The head is the fighter's brand glyph (no disc) — the authoring model's mark, in its hue. The
  // brand is resolved once here, at figure creation, and tagged on the head node via `label` so the
  // draw layer is assertable. The glyph child rides the head joint, centred (pivot 12,12) and scaled
  // up to the head box; the head container counter-flips per-frame in `applyFigure` to stay upright.
  const head = new Container();

  head.label = brand;

  const glyph = new Graphics().svg(glyphSvg(brand));

  glyph.pivot.set(12, 12);
  glyph.scale.set(headPx / 24);
  head.addChild(glyph);

  const shoulder = new Container();
  const shoulderL = new Container();
  const shoulderR = new Container();
  const hip = new Container();
  const handL = new Container();
  const handR = new Container();
  const footL = new Container();
  const footR = new Container();
  const elbowL = new Container();
  const elbowR = new Container();
  const kneeL = new Container();
  const kneeR = new Container();

  root.addChild(
    bones,
    head,
    shoulder,
    shoulderL,
    shoulderR,
    hip,
    handL,
    handR,
    footL,
    footR,
    elbowL,
    elbowR,
    kneeL,
    kneeR,
  );

  return {
    nodes: {
      root,
      head,
      shoulder,
      shoulderL,
      shoulderR,
      hip,
      handL,
      handR,
      footL,
      footR,
      elbowL,
      elbowR,
      kneeL,
      kneeR,
    },
    bones,
    color,
  };
};

// Move a joint container to its pose coordinate.
const place = (node: Container, joint: { x: number; y: number }): void => {
  node.x = joint.x;
  node.y = joint.y;
};

const applyFigure = (figure: Figure, placement: Scene["a"]): void => {
  const { nodes, bones, color } = figure;
  const pose = placement.pose;

  nodes.root.x = placement.x;
  nodes.root.y = placement.y;
  nodes.root.scale.x = placement.facing;

  // Counter-flip the head so the brand glyph never mirrors: the root flips the whole figure by
  // `facing`, and the head cancels that flip on itself, leaving the mark upright either way.
  nodes.head.scale.x = placement.facing;

  place(nodes.head, pose.head);
  place(nodes.shoulder, pose.shoulder);
  place(nodes.hip, pose.hip);
  place(nodes.handL, pose.handL);
  place(nodes.handR, pose.handR);
  place(nodes.footL, pose.footL);
  place(nodes.footR, pose.footR);
  place(nodes.shoulderL, pose.shoulderL);
  place(nodes.shoulderR, pose.shoulderR);
  place(nodes.elbowL, pose.elbowL);
  place(nodes.elbowR, pose.elbowR);
  place(nodes.kneeL, pose.kneeL);
  place(nodes.kneeR, pose.kneeR);

  bones.clear();

  for (const [from, to] of BONES) {
    bones.moveTo(pose[from].x, pose[from].y).lineTo(pose[to].x, pose[to].y);
  }

  bones.stroke({ width: 5, color });
};

// The score-pop marker: a colourblind-safe glyph (not hue alone) prefixed onto a fighter's HUD
// score for the tick window after they score, so a point reads as "that scored!" at a glance.
const POP_MARKER = "★";

const scoreLabel = (score: number, scored: boolean): string =>
  scored ? `${POP_MARKER}${score}` : `${score}`;

// The impact flash: a small starburst stroked ONCE into a per-side Graphics at its own origin, then
// moved to the scene's contact point and faded by age in `apply`. Fixed screen size (not world-scaled)
// — a punchy hit cue, not a body part. Colour, size, and fade span are eye-tunable in /dojo; no test
// pins the exact values, only the monotone fade and the clear-when-null (decision-9 style).
const FLASH_COLOR = 0xffe066;
const FLASH_INNER = 4;
const FLASH_OUTER = 16;
const FLASH_SPOKES = 8;
const FLASH_FADE_TICKS = 30;

// Stroke the radiating spokes at the Graphics' origin (the flash is positioned by moving the whole
// object, so the path itself is drawn once and never redrawn per frame).
const drawStarburst = (flash: Graphics): void => {
  for (let i = 0; i < FLASH_SPOKES; i++) {
    const angle = (i / FLASH_SPOKES) * Math.PI * 2;

    flash
      .moveTo(Math.cos(angle) * FLASH_INNER, Math.sin(angle) * FLASH_INNER)
      .lineTo(Math.cos(angle) * FLASH_OUTER, Math.sin(angle) * FLASH_OUTER);
  }

  flash.stroke({ width: 3, color: FLASH_COLOR });
};

// Opacity falls linearly from the score (age 0 → full) to the end of the fade span, clamped ≥ 0 so a
// stale age never drives a negative alpha. Monotone decreasing by construction.
const flashAlpha = (age: number): number =>
  Math.max(0, 1 - age / FLASH_FADE_TICKS);

// Show the flash at a fighter's contact mark (positioned + faded by age), or hide it when the side has
// no live score. The starburst path is already drawn; only the transform + alpha + visibility change.
const applyFlash = (flash: Graphics, mark: Scene["contact"]["a"]): void => {
  if (mark === null) {
    flash.visible = false;

    return;
  }

  flash.visible = true;
  flash.x = mark.x;
  flash.y = mark.y;
  flash.alpha = flashAlpha(mark.age);
};

// ─── ground shadows ───────────────────────────────────────────────────────────────────────────────
// A soft dark ellipse under each fighter, drawn once at a body-proportioned size then moved + scaled
// per frame by the scene's shadow (position on the mat, scale by height). Sized off the body height so
// it grows with the figure; low alpha so it reads as a shadow, not a disc. Eye-tuned.
const SHADOW_COLOR = 0x000000;
const SHADOW_ALPHA = 0.32;
const SHADOW_HALF_W_RATIO = 0.26; // ellipse half-width as a fraction of body height
const SHADOW_HALF_H_RATIO = 0.055; // ellipse half-height

const createShadow = (bodyPx: number): Graphics =>
  new Graphics()
    .ellipse(0, 0, SHADOW_HALF_W_RATIO * bodyPx, SHADOW_HALF_H_RATIO * bodyPx)
    .fill({ color: SHADOW_COLOR, alpha: SHADOW_ALPHA });

// Move a fighter's shadow under their feet and scale it by height (shrinks as they lift off the mat).
const applyShadow = (shadow: Graphics, mark: Scene["shadows"]["a"]): void => {
  shadow.x = mark.x;
  shadow.y = mark.y;
  shadow.scale.set(mark.scale);
};

// ─── the tatami ring backdrop ─────────────────────────────────────────────────────────────────────
// The decorated floor, drawn ONCE behind the fighters. All eye-tuned on a dark canvas (bg 0x0b0e14):
// muted warm-olive tatami so it never glows, two close tones for the woven panels, faint mat lines, and
// a dull-red jogai border marking the out-of-bounds edges. No test pins these — the geometry is
// ringLayout's (unit-tested); here we only stroke it (a Graphics path is opaque to display assertions,
// so the wiring test asserts z-order + membership, and a manual scan covers the drawing — as with BONES).
const TATAMI_BASE = 0x272f1b;
const TATAMI_ALT = 0x323a23;
const MAT_LINE = 0x44503a;
const CENTER_LINE = 0x55634a;
const JOGAI_COLOR = 0x9c4f4f;

// Stroke the tatami floor into `ring`: the base floor from the horizon down to the canvas bottom, the
// alternate-tone woven panels, the horizon + ground reference lines, the referee centre mark, and the
// two jogai out-of-bounds borders on the ring edges. Screen px throughout (the ring rides root, not the
// inset world), so the ground line lands on the fighters' feet.
const drawRing = (ring: Graphics, layout: RingLayout, bottom: number): void => {
  const { left, right, horizonY, groundY, centerX, panels } = layout;
  const width = right - left;
  const floorH = bottom - horizonY;

  ring.rect(left, horizonY, width, floorH).fill(TATAMI_BASE);

  // Every other vertical band a touch lighter → the woven two-tone panels.
  const panelW = width / panels;

  for (let i = 0; i < panels; i += 2) {
    ring.rect(left + i * panelW, horizonY, panelW, floorH).fill(TATAMI_ALT);
  }

  ring.moveTo(left, horizonY).lineTo(right, horizonY).stroke({
    width: 2,
    color: MAT_LINE,
  });
  ring.moveTo(left, groundY).lineTo(right, groundY).stroke({
    width: 1,
    color: MAT_LINE,
  });
  ring.moveTo(centerX, horizonY).lineTo(centerX, bottom).stroke({
    width: 1,
    color: CENTER_LINE,
  });
  ring.moveTo(left, horizonY).lineTo(left, bottom).stroke({
    width: 4,
    color: JOGAI_COLOR,
  });
  ring.moveTo(right, horizonY).lineTo(right, bottom).stroke({
    width: 4,
    color: JOGAI_COLOR,
  });
};

// The mounted stage: the root container to add to the Pixi stage, the two fighters' joint nodes
// (exposed for display-object assertions), and the HUD text, plus `apply` — the pure Scene →
// display projection the player calls every frame.
export type Stage = {
  root: Container;
  // The tatami ring backdrop, drawn once behind everything (root's first child). Exposed so the wiring
  // test can pin its z-order; the drawing itself is eye-tuned (manual scan).
  ring: Graphics;
  // The inset world container the fighters + flashes ride inside — down-scaled + centred by
  // `ringTransform` so they read as figures IN a ring rather than filling the frame (slice 2). The HUD
  // is added to `root`, NOT here, so the scoreboard stays crisp at full canvas size. Exposed for
  // display-object assertions.
  world: Container;
  a: FigureNodes;
  b: FigureNodes;
  hud: Text;
  // The two impact-flash Graphics (challenger `a`, King `b`), exposed for display-object assertions —
  // positioned + faded per frame by `apply`, hidden when that side has no live score.
  flashes: { a: Graphics; b: Graphics };
  // The two ground-shadow Graphics, drawn inside the world container behind the fighters and moved +
  // scaled under their feet each frame.
  shadows: { a: Graphics; b: Graphics };
  apply: (scene: Scene) => void;
};

export const createStage = (
  viewport: Viewport,
  brands: readonly [Brand, Brand],
): Stage => {
  const headPx = HEAD_HEIGHT_RATIO * bodyHeightPx(viewport);

  const a = createFigure(CHALLENGER_COLOR, brands[0], headPx);
  const b = createFigure(KING_COLOR, brands[1], headPx);

  const hud = new Text({
    text: "",
    style: { fill: 0xffffff, fontSize: 20, fontFamily: "monospace" },
  });

  hud.anchor.set(0.5, 0);
  hud.x = viewport.width / 2;
  hud.y = 24;

  // The impact flashes sit ABOVE the fighters (drawn after them) but below the HUD, and start hidden.
  const flashA = new Graphics();
  const flashB = new Graphics();

  drawStarburst(flashA);
  drawStarburst(flashB);
  flashA.visible = false;
  flashB.visible = false;

  // A soft ground shadow per fighter, drawn FIRST inside the world so it sits behind the figures.
  const shadowPx = bodyHeightPx(viewport);
  const shadowA = createShadow(shadowPx);
  const shadowB = createShadow(shadowPx);

  // The shadows + fighters + flashes ride inside a world container the ring-inset transform down-scales
  // + centres (slice 2); the HUD is added straight to root so the scoreboard stays full canvas size.
  // Order = z-order: shadows behind, then the figures, then the flashes on top.
  const world = new Container();
  const inset = ringTransform(viewport);

  world.scale.set(inset.scale);
  world.x = inset.x;
  world.y = inset.y;
  world.addChild(shadowA, shadowB, a.nodes.root, b.nodes.root, flashA, flashB);

  // The tatami backdrop, drawn once in screen px behind the world container + HUD.
  const ring = new Graphics();

  drawRing(ring, ringLayout(viewport), viewport.height);

  const root = new Container();

  root.addChild(ring, world, hud);

  const apply = (scene: Scene): void => {
    applyShadow(shadowA, scene.shadows.a);
    applyShadow(shadowB, scene.shadows.b);
    applyFigure(a, scene.a);
    applyFigure(b, scene.b);
    applyFlash(flashA, scene.contact.a);
    applyFlash(flashB, scene.contact.b);

    const scoreA = scoreLabel(scene.hud.scoreA, scene.hud.scoredA);
    const scoreB = scoreLabel(scene.hud.scoreB, scene.hud.scoredB);

    hud.text = `tick ${scene.hud.tick}    ${scoreA} : ${scoreB}`;
  };

  return {
    root,
    ring,
    world,
    a: a.nodes,
    b: b.nodes,
    hud,
    flashes: { a: flashA, b: flashB },
    shadows: { a: shadowA, b: shadowB },
    apply,
  };
};

// ─── S7: the contact sheet — the whole arsenal on one canvas ──────────────────────────────────────
// The draw layer's second assembly (alongside createStage): a GRID of single figures rather than a
// posed PAIR. Each cell shows one attacker (no opponent) frozen at a technique, captioned with its
// move id, so a developer can compare every move at a glance. The pose maths is the contact-sheet
// DATA layer's (contact-sheet.ts, which drives the same scene() /watch uses); here we only lay the
// pre-posed figures into a grid and caption them — reusing the exact createFigure/applyFigure the ring
// draws with, so a cell reads identically to a fighter on /watch. Pixi-only, no Application, so the
// grid is verifiable with the same display-object assertions createStage is.

// One cell to draw: the move id (its caption) and the fully-posed attacker figure. The placement's
// x/y are the scene's ring pixels and are DISCARDED — the grid re-anchors each figure into its cell;
// only the pose + facing carry over.
export type ContactCellInput = { id: string; placement: Scene["a"] };

// The grid geometry: how many columns, each cell's box, and the head-glyph px (sized to the figure
// scale by the caller, the same proportion createStage gives the ring figures).
export type SheetLayout = {
  cols: number;
  cellWidth: number;
  cellHeight: number;
  headPx: number;
};

// One rendered cell: the move id, the figure's persistent joint nodes (exposed for display-object
// assertions, exactly as createStage exposes the ring pair's), and the caption Text.
export type ContactCell = { id: string; nodes: FigureNodes; label: Text };

// The mounted sheet: the root container to add to the Pixi stage, and every cell's nodes + caption.
export type ContactSheet = { root: Container; cells: ContactCell[] };

// The figures read shape, not identity, so every cell wears the one neutral colour + a generic head.
const CELL_COLOR = CHALLENGER_COLOR;
const CELL_BRAND: Brand = "generic";

// Where the figure's feet plant inside its cell: 0.35 from the left leaves room for a forward-reaching
// strike, and the feet sit FOOT_MARGIN above the cell's bottom edge so the caption clears them. The
// caption baseline sits LABEL_MARGIN above the bottom. All eye-tunable — no test pins them (decision 9).
const FIGURE_ANCHOR_X = 0.35;
const FOOT_MARGIN = 64;
const LABEL_MARGIN = 22;

export const createContactSheet = (
  cells: readonly ContactCellInput[],
  layout: SheetLayout,
): ContactSheet => {
  const root = new Container();

  const built = cells.map((cell, i): ContactCell => {
    const cellLeft = (i % layout.cols) * layout.cellWidth;
    const cellTop = Math.floor(i / layout.cols) * layout.cellHeight;

    const figure = createFigure(CELL_COLOR, CELL_BRAND, layout.headPx);

    // Re-anchor the figure into its cell: the scene posed it around the ring's centre, so we keep only
    // the pose + facing and plant the feet at the cell's own baseline.
    applyFigure(figure, {
      x: cellLeft + layout.cellWidth * FIGURE_ANCHOR_X,
      y: cellTop + layout.cellHeight - FOOT_MARGIN,
      facing: cell.placement.facing,
      pose: cell.placement.pose,
    });

    const label = new Text({
      text: cell.id,
      style: { fill: 0xffffff, fontSize: 16, fontFamily: "monospace" },
    });

    label.anchor.set(0.5, 0);
    label.x = cellLeft + layout.cellWidth / 2;
    label.y = cellTop + layout.cellHeight - LABEL_MARGIN;

    root.addChild(figure.nodes.root, label);

    return { id: cell.id, nodes: figure.nodes, label };
  });

  return { root, cells: built };
};
