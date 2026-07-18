import { Container, Graphics, Text } from "pixi.js";

import type { Scene, Skeleton, Viewport } from "./scene";
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

// The head glyph's box in px — noticeably larger than the old 24px head circle so the mark reads
// clearly (M11: "bigger and more defined"); the shared 24-unit geometry scales up to fill it.
const HEAD_GLYPH_PX = 44;

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
};

// The six line segments (stroked into the `bones` Graphics) that connect the joints into a
// stickman: torso, two legs, two arms. The head is the brand glyph riding the head joint.
const BONES: ReadonlyArray<readonly [keyof Skeleton, keyof Skeleton]> = [
  ["hip", "shoulder"],
  ["hip", "footL"],
  ["hip", "footR"],
  ["shoulder", "handL"],
  ["shoulder", "handR"],
];

type Figure = { nodes: FigureNodes; bones: Graphics; color: number };

const createFigure = (color: number, brand: Brand): Figure => {
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
  glyph.scale.set(HEAD_GLYPH_PX / 24);
  head.addChild(glyph);

  const shoulder = new Container();
  const hip = new Container();
  const handL = new Container();
  const handR = new Container();
  const footL = new Container();
  const footR = new Container();

  root.addChild(bones, head, shoulder, hip, handL, handR, footL, footR);

  return {
    nodes: { root, head, shoulder, hip, handL, handR, footL, footR },
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

  bones.clear();

  for (const [from, to] of BONES) {
    bones.moveTo(pose[from].x, pose[from].y).lineTo(pose[to].x, pose[to].y);
  }

  bones.stroke({ width: 4, color });
};

// The score-pop marker: a colourblind-safe glyph (not hue alone) prefixed onto a fighter's HUD
// score for the tick window after they score, so a point reads as "that scored!" at a glance.
const POP_MARKER = "★";

const scoreLabel = (score: number, scored: boolean): string =>
  scored ? `${POP_MARKER}${score}` : `${score}`;

// The mounted stage: the root container to add to the Pixi stage, the two fighters' joint nodes
// (exposed for display-object assertions), and the HUD text, plus `apply` — the pure Scene →
// display projection the player calls every frame.
export type Stage = {
  root: Container;
  a: FigureNodes;
  b: FigureNodes;
  hud: Text;
  apply: (scene: Scene) => void;
};

export const createStage = (
  viewport: Viewport,
  brands: readonly [Brand, Brand],
): Stage => {
  const a = createFigure(CHALLENGER_COLOR, brands[0]);
  const b = createFigure(KING_COLOR, brands[1]);

  const hud = new Text({
    text: "",
    style: { fill: 0xffffff, fontSize: 20, fontFamily: "monospace" },
  });

  hud.anchor.set(0.5, 0);
  hud.x = viewport.width / 2;
  hud.y = 24;

  const root = new Container();

  root.addChild(a.nodes.root, b.nodes.root, hud);

  const apply = (scene: Scene): void => {
    applyFigure(a, scene.a);
    applyFigure(b, scene.b);

    const scoreA = scoreLabel(scene.hud.scoreA, scene.hud.scoredA);
    const scoreB = scoreLabel(scene.hud.scoreB, scene.hud.scoredB);

    hud.text = `tick ${scene.hud.tick}    ${scoreA} : ${scoreB}`;
  };

  return { root, a: a.nodes, b: b.nodes, hud, apply };
};
