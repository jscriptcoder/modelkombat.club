import { Container, Graphics, Text } from "pixi.js";

import type { Scene } from "./scene";
import type { Viewport } from "./scene";

// The Pixi draw layer: builds the scene-graph (two stickmen + a HUD) and applies a `Scene` to it.
// Deliberately free of `Application` / renderer / ticker — those live in the player component — so
// the mapping from Scene → display-object state is verifiable with plain display-object assertions.

// Challenger (a) vs King (b) — two colours so the fighters read apart at a glance.
const CHALLENGER_COLOR = 0x4fd1c5;
const KING_COLOR = 0xf6ad55;

// A minimal stickman drawn with its **feet at the local origin** (all geometry at y ≤ 0), so placing
// the container at (screenX, groundY) stands the figure on the ground line and `scale.x = ±1` flips
// it about its feet. Head + torso + two arms + two legs, stroked in the fighter's colour.
const stickman = (color: number): Container => {
  const g = new Graphics();

  g.moveTo(0, -34).lineTo(0, -64); // torso: hip → shoulder
  g.moveTo(0, -34).lineTo(-14, 0).moveTo(0, -34).lineTo(14, 0); // legs → feet
  g.moveTo(0, -64).lineTo(-18, -44).moveTo(0, -64).lineTo(18, -44); // arms
  g.stroke({ width: 4, color });
  g.circle(0, -76, 12).fill(color); // head

  const container = new Container();

  container.addChild(g);

  return container;
};

// The mounted stage: the root container to add to the Pixi stage, the two fighter containers and
// the HUD text (exposed for display-object assertions), and `apply` — the pure Scene → display
// projection the player calls every frame.
export type Stage = {
  root: Container;
  a: Container;
  b: Container;
  hud: Text;
  apply: (scene: Scene) => void;
};

export const createStage = (viewport: Viewport): Stage => {
  const a = stickman(CHALLENGER_COLOR);
  const b = stickman(KING_COLOR);

  const hud = new Text({
    text: "",
    style: { fill: 0xffffff, fontSize: 20, fontFamily: "monospace" },
  });

  hud.anchor.set(0.5, 0);
  hud.x = viewport.width / 2;
  hud.y = 24;

  const root = new Container();

  root.addChild(a, b, hud);

  const apply = (scene: Scene): void => {
    a.x = scene.a.x;
    a.y = scene.a.y;
    a.scale.x = scene.a.facing;
    b.x = scene.b.x;
    b.y = scene.b.y;
    b.scale.x = scene.b.facing;
    hud.text = `tick ${scene.hud.tick}    ${scene.hud.scoreA} : ${scene.hud.scoreB}`;
  };

  return { root, a, b, hud, apply };
};
