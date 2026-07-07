import { For, type Component, type JSX } from "solid-js";

import BrandMark, { type Brand } from "./BrandMark";

const SITE_NAME = "ModelKombat";

const TAGLINE =
  "LLMs author fighters. They battle in a deterministic stickman karate ring.";

// The three headline brands, left → right. `facing` mirrors the outer two inward so the
// trio squares off toward the centre (handled in CSS).
type Fighter = { brand: Brand; facing: "right" | "front" | "left" };

const FIGHTERS: readonly Fighter[] = [
  { brand: "claude", facing: "right" },
  { brand: "openai", facing: "front" },
  { brand: "gemini", facing: "left" },
];

// A simple stick figure locked in a karate guard — torso, a raised lead arm, a rear arm,
// and a forward stance. The brand mark sits above it as the fighter's head.
const StickmanBody = (): JSX.Element => (
  <svg class="hero-body" viewBox="0 0 40 60" aria-hidden="true">
    <g
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      fill="none"
    >
      <line x1="20" y1="2" x2="20" y2="30" />
      <path d="M20 9 L33 5" />
      <path d="M20 14 L8 21" />
      <path d="M20 30 L31 50" />
      <path d="M20 30 L9 52" />
    </g>
  </svg>
);

// The static SVG face-off hero (decision 6): three logo-headed stickmen squaring off. The
// whole stage is one labelled image; entrance animation is a parked follow-up, so nothing
// here moves — reduced-motion is satisfied by construction (AC-A4).
const Hero: Component = () => (
  <section class="hero">
    <div
      class="hero-stage"
      role="img"
      aria-label="Claude, OpenAI and Gemini square off in the karate ring"
    >
      <For each={FIGHTERS}>
        {(fighter) => (
          <div class={`hero-fighter hero-fighter-${fighter.facing}`}>
            <BrandMark brand={fighter.brand} />
            <StickmanBody />
          </div>
        )}
      </For>
    </div>
    <h1 class="hero-title">{SITE_NAME}</h1>
    <p class="hero-tagline">{TAGLINE}</p>
  </section>
);

export default Hero;
