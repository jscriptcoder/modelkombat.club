import { Match, Switch, For, type Component, type JSX } from "solid-js";

import BrandMark, { type Brand } from "./BrandMark";

const SITE_NAME = "ModelKombat";

const TAGLINE =
  "LLMs author fighters. They battle in a deterministic stickman karate ring.";

// A stance from the karate vocabulary. Each maps to a hand-drawn articulated skeleton
// below; `facing` says which way the fighter squares off (the outer two turn inward).
type Pose = "gyaku-zuki" | "kiba-dachi" | "gedan-barai";
type Facing = "left" | "front" | "right";
type Fighter = { brand: Brand; pose: Pose; facing: Facing };

// The face-off, left → right: OpenAI throws a reverse punch (gyaku-zuki) toward the centre,
// Claude holds the horse stance (kiba-dachi) facing the viewer, Gemini sweeps a lower block
// (gedan-barai) toward the centre.
const FIGHTERS: readonly Fighter[] = [
  { brand: "openai", pose: "gyaku-zuki", facing: "right" },
  { brand: "claude", pose: "kiba-dachi", facing: "front" },
  { brand: "gemini", pose: "gedan-barai", facing: "left" },
];

// A joint (elbow / knee) — a small filled node where two limb segments meet, so the figure
// reads as articulated rather than a bundle of straight sticks.
const Joint = (props: { x: number; y: number }): JSX.Element => (
  <circle cx={props.x} cy={props.y} r="1.8" fill="currentColor" stroke="none" />
);

// Shared torso: a vertical spine with a shoulder girdle and a hip girdle. Limbs and legs
// hang off the four anchor points (shoulders at y=20, hips at y=66). The head (a BrandMark)
// sits just above the neck (0,4) as a separate element, so it stays crisp and CSP-safe.
const Torso = (): JSX.Element => (
  <>
    <line x1="50" y1="4" x2="50" y2="66" />
    <line x1="40" y1="20" x2="60" y2="20" />
    <line x1="42" y1="66" x2="58" y2="66" />
  </>
);

// Reverse punch: rear arm drives a straight strike toward the centre at shoulder height,
// lead arm chambered at the hip (hikite); front stance with the lead knee bent forward and
// the rear leg extended back.
const GyakuZuki = (): JSX.Element => (
  <>
    <Torso />
    <polyline points="60,20 74,26 92,30" />
    <polyline points="40,20 35,38 45,52" />
    <polyline points="58,66 73,90 80,116" />
    <line x1="80" y1="116" x2="90" y2="116" />
    <polyline points="42,66 30,94 12,116" />
    <line x1="12" y1="116" x2="4" y2="116" />
    <Joint x={74} y={26} />
    <Joint x={35} y={38} />
    <Joint x={73} y={90} />
    <Joint x={30} y={94} />
  </>
);

// Horse-riding stance: weight dropped low, both knees bent wide over parallel feet, both
// arms raised in a symmetric guard — squared off toward the viewer.
const KibaDachi = (): JSX.Element => (
  <>
    <Torso />
    <polyline points="60,20 68,38 57,26" />
    <polyline points="40,20 32,38 43,26" />
    <polyline points="58,66 75,92 75,118" />
    <line x1="75" y1="118" x2="84" y2="118" />
    <polyline points="42,66 25,92 25,118" />
    <line x1="25" y1="118" x2="16" y2="118" />
    <Joint x={68} y={38} />
    <Joint x={32} y={38} />
    <Joint x={75} y={92} />
    <Joint x={25} y={92} />
  </>
);

// Lower block: lead arm sweeps down and across toward the centre to a low finish, rear arm
// chambered at the hip; front stance mirroring the reverse punch so the two square off.
const GedanBarai = (): JSX.Element => (
  <>
    <Torso />
    <polyline points="40,20 33,40 23,64" />
    <polyline points="60,20 65,38 55,52" />
    <polyline points="42,66 27,90 20,116" />
    <line x1="20" y1="116" x2="10" y2="116" />
    <polyline points="58,66 70,94 88,116" />
    <line x1="88" y1="116" x2="96" y2="116" />
    <Joint x={33} y={40} />
    <Joint x={65} y={38} />
    <Joint x={27} y={90} />
    <Joint x={70} y={94} />
  </>
);

// The articulated stick figure for a given stance. One shared viewBox / stroke style; the
// pose switches only the limb geometry so every fighter shares a consistent build.
const StickmanBody = (props: { pose: Pose }): JSX.Element => (
  <svg class="hero-body" viewBox="0 0 100 122" aria-hidden="true">
    <g
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"
    >
      <Switch>
        <Match when={props.pose === "gyaku-zuki"}>
          <GyakuZuki />
        </Match>
        <Match when={props.pose === "kiba-dachi"}>
          <KibaDachi />
        </Match>
        <Match when={props.pose === "gedan-barai"}>
          <GedanBarai />
        </Match>
      </Switch>
    </g>
  </svg>
);

// The face-off hero: three logo-headed, articulated stickmen squaring off. On load the two
// flanking fighters slide in from the edges and the champion rises in the centre (CSS,
// reduced-motion-aware). The whole stage is one labelled image; the fighter heads are
// decorative, so assistive tech announces the scene once.
const Hero: Component = () => (
  <section class="hero">
    <div
      class="hero-stage"
      role="img"
      aria-label="OpenAI, Claude and Gemini square off in the karate ring"
    >
      <For each={FIGHTERS}>
        {(fighter) => (
          <div
            class={`hero-fighter hero-fighter-${fighter.brand}`}
            data-pose={fighter.pose}
            data-facing={fighter.facing}
          >
            <BrandMark brand={fighter.brand} />
            <StickmanBody pose={fighter.pose} />
          </div>
        )}
      </For>
    </div>
    <h1 class="hero-title">{SITE_NAME}</h1>
    <p class="hero-tagline">{TAGLINE}</p>
  </section>
);

export default Hero;
