import { createEffect, type Component } from "solid-js";
import { fireEvent, render, within } from "@solidjs/testing-library";
import { afterEach, describe, expect, it } from "vitest";

import Arsenal from "./Arsenal";
import { loopIndex, moveLoopTape } from "./move-preview";
import type { PreviewStageProps } from "./PreviewStage";
import type { ReplayTape } from "../replay/replay-contract";

// The expected roster is hardcoded here — deliberately NOT imported from the
// component — so a renamed, dropped, or reordered move-id/gloss in production
// fails this test. The web project can't run Stryker, so exact assertions plus
// this independent duplication are the mutation guard.
type ExpectedBadge = { readonly text: string; readonly label: string };
type ExpectedMove = {
  readonly id: string;
  readonly gloss: string;
  readonly badge: ExpectedBadge;
  readonly descriptor: string;
};
type ExpectedFamily = {
  readonly name: string;
  readonly moves: readonly ExpectedMove[];
};

// The five score encodings, defined independently of the component: numeric
// glyph (what the eye reads) + accessible label (what a screen reader announces,
// so "2·3" isn't voiced as "two middot three").
const B1: ExpectedBadge = { text: "1", label: "scores 1 point" };
const B2: ExpectedBadge = { text: "2", label: "scores 2 points" };
const B3: ExpectedBadge = { text: "3", label: "scores 3 points" };

const B23: ExpectedBadge = {
  text: "2·3",
  label: "scores 2 points, 3 to the head",
};

const B03: ExpectedBadge = {
  text: "0→3",
  label: "scores no points on the hit, but knocks down for a 3-point finish",
};

const EXPECTED_FAMILIES: readonly ExpectedFamily[] = [
  {
    name: "Strikes",
    moves: [
      {
        id: "kizami-zuki",
        gloss: "jab",
        badge: B1,
        descriptor:
          "Fast lead-hand poke — the tempo-setter that opens the cancel chain.",
      },
      {
        id: "gyaku-zuki",
        gloss: "reverse punch",
        badge: B1,
        descriptor:
          "The power hand and cancel hub — every combo routes through it.",
      },
      {
        id: "uraken",
        gloss: "backfist",
        badge: B1,
        descriptor:
          "Cheapest, shortest hand — a gas-proof jodan snap and combo starter.",
      },
      {
        id: "shuto",
        gloss: "knife-hand",
        badge: B1,
        descriptor:
          "The longest-reaching hand, out-ranging even the reverse punch.",
      },
    ],
  },
  {
    name: "Kicks",
    moves: [
      {
        id: "mae-geri",
        gloss: "front kick",
        badge: B2,
        descriptor:
          "The straight-line body kick — a reliable waza-ari from mid range.",
      },
      {
        id: "mawashi-geri",
        gloss: "roundhouse kick",
        badge: B23,
        descriptor:
          "Arcs to the body for two, or over the guard to the head for the ippon.",
      },
      {
        id: "yoko-geri",
        gloss: "side kick",
        badge: B2,
        descriptor:
          "A beyond-neutral thrust that out-reaches even the roundhouse.",
      },
      {
        id: "ushiro-geri",
        gloss: "back kick",
        badge: B23,
        descriptor:
          "The longest, most committed strike — a turn-away thrust you'll see coming.",
      },
    ],
  },
  {
    name: "Close-range",
    moves: [
      {
        id: "empi",
        gloss: "elbow strike",
        badge: B2,
        descriptor:
          "Shortest reach in the game — a point-blank two-point payoff.",
      },
      {
        id: "hiza-geri",
        gloss: "knee strike",
        badge: B03,
        descriptor:
          "The only standing mid-band knockdown — it sets up a three-point finish.",
      },
    ],
  },
  {
    name: "Takedowns",
    moves: [
      {
        id: "throw",
        gloss: "throw",
        badge: B3,
        descriptor:
          "Clean takedown for the instant ippon — the anti-turtle answer.",
      },
      {
        id: "sweep",
        gloss: "foot sweep",
        badge: B03,
        descriptor:
          "Chops the base out; scores nothing, but the okizeme finish pays three.",
      },
    ],
  },
  {
    name: "Aerial",
    moves: [
      {
        id: "tobi-geri",
        gloss: "jumping kick",
        badge: B23,
        descriptor:
          "Leap in from range for a head-height ippon — the only airborne strike.",
      },
    ],
  },
];

// A move card carries its romaji id in a <code> token and its gloss in a
// dedicated .move-gloss slot; reading them separately keeps the `throw` move
// (id "throw", gloss "throw") from colliding under a bare getByText.
const idOf = (item: HTMLElement): string | null =>
  item.querySelector("code")?.textContent ?? null;

const glossOf = (item: HTMLElement): string | null =>
  item.querySelector(".move-gloss")?.textContent ?? null;

const descriptorOf = (item: HTMLElement): string | null =>
  item.querySelector(".move-descriptor")?.textContent ?? null;

// The whole roster, flattened — the previews iterate this in S3 (every move gets its own eye).
const ALL_MOVES = EXPECTED_FAMILIES.flatMap((family) => family.moves);

describe("Arsenal section", () => {
  it("is a labelled region anchored at #arsenal with an orienting lede", () => {
    const { getByRole } = render(() => <Arsenal />);

    const region = getByRole("region", { name: "The Arsenal" });

    // The id is the in-page anchor target the nav links to.
    expect(region.id).toBe("arsenal");
    // A paragraph-unique phrase from the lede — an empty/blank lede fails here.
    expect(region.textContent).toMatch(/thirteen real karate techniques/i);
    // The scoring scale orients the score badges; pin it so it can't be dropped.
    expect(region.textContent).toMatch(/1 yuko · 2 waza-ari · 3 ippon/i);
  });

  it("groups the techniques under the five families, in order", () => {
    const { getByRole } = render(() => <Arsenal />);

    const region = getByRole("region", { name: "The Arsenal" });

    const familyNames = within(region)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(familyNames).toEqual([
      "Strikes",
      "Kicks",
      "Close-range",
      "Takedowns",
      "Aerial",
    ]);
  });

  it("lists exactly the right techniques — id and gloss — in order under each family", () => {
    const { getByRole } = render(() => <Arsenal />);

    for (const family of EXPECTED_FAMILIES) {
      const familyRegion = getByRole("region", { name: family.name });

      const items = within(familyRegion).getAllByRole("listitem");

      expect(items.map(idOf)).toEqual(family.moves.map((move) => move.id));
      expect(items.map(glossOf)).toEqual(
        family.moves.map((move) => move.gloss),
      );
    }
  });

  it("gives each technique its own one-line descriptor, in order under each family", () => {
    const { getByRole } = render(() => <Arsenal />);

    for (const family of EXPECTED_FAMILIES) {
      const familyRegion = getByRole("region", { name: family.name });

      const items = within(familyRegion).getAllByRole("listitem");

      expect(items.map(descriptorOf)).toEqual(
        family.moves.map((move) => move.descriptor),
      );
    }
  });

  it("marks each technique with its score badge — numeric glyph plus accessible label", () => {
    const { getByRole } = render(() => <Arsenal />);

    for (const family of EXPECTED_FAMILIES) {
      const familyRegion = getByRole("region", { name: family.name });

      const items = within(familyRegion).getAllByRole("listitem");

      items.forEach((item, index) => {
        const move = family.moves[index];

        // One icon-role badge per card: the visible glyph is the numeric
        // encoding, the accessible name is the spoken label.
        const badge = within(item).getByRole("img");

        expect(badge.textContent).toBe(move.badge.text);
        expect(badge.getAttribute("aria-label")).toBe(move.badge.label);
      });
    }
  });

  it("ends with a single hand-off link deep-linking the rendered frame table", () => {
    const { getByRole } = render(() => <Arsenal />);

    const region = getByRole("region", { name: "The Arsenal" });

    // Exactly one spec hand-off link in the whole section — no per-card links.
    const specLinks = within(region)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/spec-guide"));

    expect(specLinks).toHaveLength(1);

    // Framed around the full frame table; the decorative ↗ affordance must not
    // leak into the accessible name (exact-name match asserts it is aria-hidden).
    const specLink = within(region).getByRole("link", {
      name: "Reach, frames, stamina, cancels — see the full frame table",
    });

    // Deep-links straight to the Frame table section of the rendered spec page.
    expect(specLink.getAttribute("href")).toBe("/spec-guide#frame-table");
    // Opens in a new tab, matching the nav + CTA spec links.
    expect(specLink.getAttribute("target")).toBe("_blank");
  });
});

// S2 — the move preview (walking skeleton, gyaku-zuki only). A visitor opens an 👁 eye control on
// the gyaku-zuki row and watches the move loop in a small popover. The clock + the render-model
// wiring live above an INJECTABLE Pixi stage seam (mirroring DojoApp), so open/close, the loop tape,
// the loop-wrap, the lazy-load timing, and the dim are all assertable without a WebGL mount — the real
// PreviewStage (which imports Pixi) is a thin edge that only loads on first open. The pose maths is
// covered in move-preview.test (the pure tape + wrap) and figures.test (the draw layer); here we prove
// the PAGE wiring. web ∉ Stryker, so these are exact assertions + a manual mutator scan.

// A spy render sink standing in for the real Pixi stage: it captures every tape / tick / figure-alpha
// the preview hands down (newest last), lets a test PUMP the loop clock by invoking the captured
// ticker callback, and counts how many times it was LAZILY LOADED (so "not until open" and "once" are
// assertable). It never runs a clock of its own, so the playhead only moves when a test pumps it.
const spyStage = () => {
  const tapes: ReplayTape[] = [];
  const ticks: number[] = [];
  const alphas: PreviewStageProps["figureAlpha"][] = [];
  let onTick: ((delta: number) => void) | undefined;
  let loads = 0;

  const Stage: Component<PreviewStageProps> = (props) => {
    createEffect(() => {
      tapes.push(props.tape);
    });

    createEffect(() => {
      ticks.push(props.tick);
    });

    createEffect(() => {
      alphas.push(props.figureAlpha);
    });

    onTick = props.onTick;

    return <div data-testid="preview-stage" />;
  };

  return {
    // The lazy loader the page awaits on first open; each call is one load (S3 will assert it stays 1).
    loadStage: () => {
      loads += 1;

      return Promise.resolve(Stage);
    },
    loads: () => loads,
    latestTape: () => tapes[tapes.length - 1],
    latestTick: () => ticks[ticks.length - 1],
    latestAlpha: () => alphas[alphas.length - 1],
    // Drive the loop clock as the real Pixi ticker would, in playhead-tick units.
    pump: (delta: number) => onTick?.(delta),
  };
};

// The popover is portalled to <body> (it must escape the card's overflow), so its dialog + the stage
// host are queried from the document, not the render container.
const body = () => within(document.body);

// The popover portals OUTSIDE the render container, so the library's container-scoped auto-cleanup
// doesn't reach a preview left open at a test's end. Drop any stray portal so every test starts from a
// clean <body> (idempotency — Browser Mode runs tests in parallel).
afterEach(() => {
  for (const node of document.querySelectorAll(".move-preview-popover")) {
    node.remove();
  }
});

const findEye = (findByRole: ReturnType<typeof render>["findByRole"]) =>
  findByRole("button", { name: /preview gyaku-zuki/i });

describe("Arsenal — move preview eye control (S2)", () => {
  it("opens the looping preview when the eye control is hovered", async () => {
    const { loadStage } = spyStage();
    const { findByRole } = render(() => <Arsenal loadStage={loadStage} />);

    const eye = await findEye(findByRole);

    expect(eye.getAttribute("aria-expanded")).toBe("false");
    expect(body().queryByRole("dialog")).toBeNull();

    fireEvent.pointerEnter(eye);

    expect(eye.getAttribute("aria-expanded")).toBe("true");
    expect(body().getByRole("dialog", { name: /gyaku-zuki/i })).toBeTruthy();
  });

  it("opens the preview on tap/click", async () => {
    const { loadStage } = spyStage();
    const { findByRole } = render(() => <Arsenal loadStage={loadStage} />);

    const eye = await findEye(findByRole);

    fireEvent.click(eye);

    expect(body().getByRole("dialog", { name: /gyaku-zuki/i })).toBeTruthy();
  });

  it("opens the preview on keyboard focus", async () => {
    const { loadStage } = spyStage();
    const { findByRole } = render(() => <Arsenal loadStage={loadStage} />);

    const eye = await findEye(findByRole);

    fireEvent.focus(eye);

    expect(body().getByRole("dialog", { name: /gyaku-zuki/i })).toBeTruthy();
  });

  it("closes the preview when the pointer leaves the eye control", async () => {
    const { loadStage } = spyStage();
    const { findByRole } = render(() => <Arsenal loadStage={loadStage} />);

    const eye = await findEye(findByRole);

    fireEvent.pointerEnter(eye);
    expect(body().queryByRole("dialog")).toBeTruthy();

    fireEvent.pointerLeave(eye);

    expect(eye.getAttribute("aria-expanded")).toBe("false");
    expect(body().queryByRole("dialog")).toBeNull();
  });

  it("closes the preview when Escape is pressed", async () => {
    const { loadStage } = spyStage();
    const { findByRole } = render(() => <Arsenal loadStage={loadStage} />);

    const eye = await findEye(findByRole);

    fireEvent.click(eye);
    expect(body().queryByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(body().queryByRole("dialog")).toBeNull();
  });

  it("closes the preview on an outside interaction", async () => {
    const { loadStage } = spyStage();
    const { findByRole } = render(() => <Arsenal loadStage={loadStage} />);

    const eye = await findEye(findByRole);

    fireEvent.click(eye);
    expect(body().queryByRole("dialog")).toBeTruthy();

    // A pointer-down anywhere outside the eye + popover dismisses it.
    fireEvent.pointerDown(document.body);

    expect(body().queryByRole("dialog")).toBeNull();
  });

  it("does not load the Pixi preview stage until a preview is first opened", async () => {
    const stage = spyStage();

    const { findByRole } = render(() => (
      <Arsenal loadStage={stage.loadStage} />
    ));

    const eye = await findEye(findByRole);

    // Nothing Pixi has loaded just from rendering the page — the home bundle stays Pixi-free.
    expect(stage.loads()).toBe(0);

    fireEvent.click(eye);

    // The first open triggers exactly one lazy load.
    expect(stage.loads()).toBe(1);
  });

  it("plays the gyaku-zuki loop tape through the preview stage", async () => {
    const stage = spyStage();

    const { findByRole } = render(() => (
      <Arsenal loadStage={stage.loadStage} />
    ));

    fireEvent.click(await findEye(findByRole));
    await body().findByTestId("preview-stage");

    // The tape is gyaku-zuki's own looping technique (span 24), committed on the attacker.
    expect(stage.latestTape()).toHaveLength(24);
    expect(stage.latestTape()[0].a.attackMove).toBe("gyaku-zuki");
  });

  it("loops the technique — the playhead wraps past the final tick back to the start", async () => {
    const stage = spyStage();

    const { findByRole } = render(() => (
      <Arsenal loadStage={stage.loadStage} />
    ));

    fireEvent.click(await findEye(findByRole));
    await body().findByTestId("preview-stage");

    const length = moveLoopTape("gyaku-zuki").length; // 24

    // Advance the clock past the end: a looping preview wraps back near the start (loopIndex),
    // where a fight clock (transport) would clamp and sit frozen on the last frame (23).
    stage.pump(length + 3);

    await expect
      .poll(() => stage.latestTick())
      .toBe(loopIndex(length + 3, length)); // 3, not 23
  });

  it("dims the passive target and leaves the attacker at full strength", async () => {
    const stage = spyStage();

    const { findByRole } = render(() => (
      <Arsenal loadStage={stage.loadStage} />
    ));

    fireEvent.click(await findEye(findByRole));
    await body().findByTestId("preview-stage");

    // The attacker (a) reads full; the passive target (b) is faded so the eye reads the attacker
    // as the subject. The exact fade is eye-tuned — only the relationship is pinned.
    expect(stage.latestAlpha().a).toBe(1);
    expect(stage.latestAlpha().b).toBeLessThan(1);
  });
});

// S3 — the eye control broadened to the WHOLE roster, still through the ONE shared renderer. Every
// move card carries its own always-visible eye; opening any previews THAT move; switching moves
// re-aims the single Application (never a second one) and restarts the loop from the move's stance.
// The last two are exactly what a single-move S2 could not observe — they kill the reuse-guard and
// playhead-reset mutants the S2 manual scan deferred. web ∉ Stryker → exact assertions + manual scan.

// Find a move's eye control by its per-move accessible name (exact, so no id is a substring of
// another across the 13-move roster).
const eyeFor = (
  findByRole: ReturnType<typeof render>["findByRole"],
  id: string,
) => findByRole("button", { name: `Preview ${id}` });

describe("Arsenal — move preview across the whole roster (S3)", () => {
  it("gives every move its own always-visible eye control", async () => {
    const { findByRole } = render(() => <Arsenal />);

    for (const move of ALL_MOVES) {
      expect(await eyeFor(findByRole, move.id)).toBeTruthy();
    }
  });

  it("previews the move whose eye is opened — each move plays its own loop tape", async () => {
    const stage = spyStage();

    const { findByRole } = render(() => (
      <Arsenal loadStage={stage.loadStage} />
    ));

    for (const move of ALL_MOVES) {
      fireEvent.click(await eyeFor(findByRole, move.id));

      // The single renderer receives exactly THIS move's looping tape — not a fixed one.
      await expect
        .poll(() => stage.latestTape())
        .toEqual(moveLoopTape(move.id));
    }
  });

  it("switches moves through the same single renderer — never a second Application", async () => {
    const stage = spyStage();

    const { findByRole } = render(() => (
      <Arsenal loadStage={stage.loadStage} />
    ));

    fireEvent.click(await eyeFor(findByRole, "gyaku-zuki"));
    // Wait for the FIRST open to finish loading before switching, so a re-aim can't race the load.
    await body().findByTestId("preview-stage");
    expect(stage.loads()).toBe(1);

    // Opening a different move re-aims the ONE preview — it must not construct a second stage.
    fireEvent.click(await eyeFor(findByRole, "mae-geri"));
    await expect
      .poll(() => stage.latestTape())
      .toEqual(moveLoopTape("mae-geri"));

    expect(stage.loads()).toBe(1);
  });

  it("restarts the loop from the move's stance when switching moves", async () => {
    const stage = spyStage();

    const { findByRole } = render(() => (
      <Arsenal loadStage={stage.loadStage} />
    ));

    fireEvent.click(await eyeFor(findByRole, "gyaku-zuki"));
    await body().findByTestId("preview-stage");

    // Advance the first move's loop well past its opening frame...
    stage.pump(5);
    await expect
      .poll(() => stage.latestTick())
      .toBe(loopIndex(5, moveLoopTape("gyaku-zuki").length)); // 5, not the stance

    // ...then open a different move: its clock starts from the stance (tick 0), not mid-loop.
    fireEvent.click(await eyeFor(findByRole, "mae-geri"));

    await expect.poll(() => stage.latestTick()).toBe(0);
  });
});
