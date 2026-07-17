import { Container, Graphics, Text } from "pixi.js";

import type { Scene, Skeleton, Viewport } from "./scene";

// The Pixi draw layer: builds the scene-graph (two stickmen + a HUD) and applies a `Scene` to it.
// Deliberately free of `Application` / renderer / ticker — those live in the player component — so
// the mapping from Scene → display-object state is verifiable with plain display-object assertions.

// Challenger (a) vs King (b) — two colours so the fighters read apart at a glance.
const CHALLENGER_COLOR = 0x4fd1c5;
const KING_COLOR = 0xf6ad55;

// A fighter's persistent scene-graph: a root container the scene positions + flips, holding one
// child container per skeleton joint (the head container carries the visible head circle; the rest
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
// stickman: torso, two legs, two arms. The head is a filled circle riding the head joint.
const BONES: ReadonlyArray<readonly [keyof Skeleton, keyof Skeleton]> = [
  ["hip", "shoulder"],
  ["hip", "footL"],
  ["hip", "footR"],
  ["shoulder", "handL"],
  ["shoulder", "handR"],
];

type Figure = { nodes: FigureNodes; bones: Graphics; color: number };

const createFigure = (color: number): Figure => {
  const root = new Container();
  const bones = new Graphics();

  const head = new Container();

  head.addChild(new Graphics().circle(0, 0, 12).fill(color));

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

export const createStage = (viewport: Viewport): Stage => {
  const a = createFigure(CHALLENGER_COLOR);
  const b = createFigure(KING_COLOR);

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
