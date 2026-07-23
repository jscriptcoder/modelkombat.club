import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import { CANONICAL_ORIGIN } from "../../shared/lib/config";
import HowItWorks from "./HowItWorks";

// The spec/fight URLs are the canonical absolute host so they are pasteable into an
// LLM from anywhere and stay stable when the page is prerendered (SSG has no runtime
// origin). They no longer follow the serving origin (localhost in this test runner).
const SPEC_URL = `${CANONICAL_ORIGIN}/spec`;
const FIGHT_URL = `${CANONICAL_ORIGIN}/fight`;

// The <pre> whose text matches the predicate — the section holds more than one.
const codeBlockMatching = (
  container: HTMLElement,
  predicate: RegExp,
): string => {
  const block = [...container.querySelectorAll("pre")].find((pre) =>
    predicate.test(pre.textContent ?? ""),
  );

  if (!block) {
    throw new Error(`no <pre> matching ${predicate}`);
  }

  return block.textContent ?? "";
};

describe("HowItWorks", () => {
  it("frames the work as LLM-driven, not hand-written", () => {
    const { getByRole } = render(() => <HowItWorks />);

    const section = getByRole("region", { name: "How it works" });
    const text = section.textContent ?? "";

    // The human's real job — drive an LLM — is stated, and only the lead paragraph
    // names the "LLM" within this section, so this guards that framing is present.
    expect(text).toMatch(/\bLLM\b/);
  });

  it("still walks through the same four ordered steps", () => {
    const { getAllByRole } = render(() => <HowItWorks />);

    const titles = getAllByRole("heading", { level: 3 }).map(
      (heading) => heading.textContent,
    );

    expect(titles).toEqual([
      "Read the spec",
      "Write a JSON bot",
      "Fight the champions",
      "Challenge the King",
    ]);
  });

  it("surfaces the spec URL as a link to the raw /spec endpoint", () => {
    const { getByRole } = render(() => <HowItWorks />);

    const link = getByRole("link", { name: SPEC_URL });

    // The raw markdown endpoint (not the rendered /spec-guide page) is what an LLM
    // should be handed.
    expect(link.getAttribute("href")).toBe("/spec");
  });

  it("shows the canonical spec host, not the serving origin", () => {
    const { getByRole } = render(() => <HowItWorks />);

    const link = getByRole("link", { name: SPEC_URL });

    // The absolute canonical host is shown everywhere — an LLM must be able to POST to it,
    // and SSG has no runtime origin — so the serving origin (localhost here) must NOT leak in.
    // The literal host here is intentional: it is the one place that pins CANONICAL_ORIGIN's
    // value, so a wrong/empty constant is caught even though the other tests import it.
    expect(link.textContent).toContain("modelkombat.club");
    expect(link.textContent).not.toContain(window.location.origin);
  });

  it("copies the absolute spec URL to the clipboard from the Read the spec step", () => {
    const write = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();

    const { getByRole } = render(() => <HowItWorks />);

    fireEvent.click(getByRole("button", { name: "Copy link" }));

    // The clipboard gets the full absolute URL — pasteable straight into an LLM.
    expect(write).toHaveBeenCalledWith(SPEC_URL);

    write.mockRestore();
  });

  it("offers a copyable starter prompt that points the LLM at the spec and the fight endpoint", () => {
    const { getByRole, container } = render(() => <HowItWorks />);

    // The prompt is shown verbatim so the human sees exactly what they will paste.
    const prompt = codeBlockMatching(container, /fighter/i);

    expect(prompt).toContain(SPEC_URL);
    expect(prompt).toContain(FIGHT_URL);
    expect(prompt).toMatch(/iterat/i);

    // ...and a dedicated button copies it.
    expect(getByRole("button", { name: /copy starter prompt/i })).toBeTruthy();
  });

  it("copies the whole starter prompt, not just a fragment", () => {
    const write = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue();

    const { getByRole, container } = render(() => <HowItWorks />);

    const promptText = codeBlockMatching(container, /fighter/i);

    fireEvent.click(getByRole("button", { name: /copy starter prompt/i }));

    expect(write).toHaveBeenCalledWith(promptText);

    write.mockRestore();
  });

  it("shows the POST /fight call in the Fight the champions step", () => {
    const { container } = render(() => <HowItWorks />);

    const curl = codeBlockMatching(container, /curl/i);

    expect(curl).toContain("POST");
    expect(curl).toContain(FIGHT_URL);
    expect(curl).toContain("X-Author-Handle");
  });

  it("frames the compete stage as a record-ranked ladder, not a lone King you must beat", () => {
    const { container } = render(() => <HowItWorks />);

    // A compete run doesn't hand the bot a one-on-one it must win against the King:
    // a single /fight runs a round-robin against the reigning King AND the other ladder
    // champions and crowns whoever tops the table on overall record — a challenger can take
    // the throne while LOSING to the King, if its record across the field is best. So the
    // prompt must name those other champions and frame the outcome as a record ranking, not
    // "beat every champion", or the model over-fits to a lone King duel.
    const prompt = codeBlockMatching(container, /fighter/i);

    expect(prompt).toMatch(/champions/i);
    expect(prompt).toMatch(/King/i);
    expect(prompt).toMatch(/record/i);
  });

  it("teaches the practice default and the X-Compete opt-in in the starter prompt", () => {
    const { container } = render(() => <HowItWorks />);

    const prompt = codeBlockMatching(container, /fighter/i);

    // The model must learn that iterating is free (a practice run changes nothing)...
    expect(prompt.toLowerCase()).toContain("practice");
    // ...and the exact header + value that flips a run into a real title shot.
    expect(prompt).toContain("X-Compete: true");
  });

  it("shows a compete curl carrying the X-Compete header in the Challenge the King step", () => {
    const { container } = render(() => <HowItWorks />);

    // A dedicated snippet shows the header an author adds once the bot is ready to claim the throne.
    const curl = codeBlockMatching(container, /X-Compete/);

    expect(curl).toContain("X-Compete: true");
    expect(curl).toContain(FIGHT_URL);
  });

  it("tells the model the author handle is required and must come from the human, not invented", () => {
    const { container } = render(() => <HowItWorks />);

    // The model has no handle of its own, so the prompt must (a) mark the header
    // required and (b) direct the model to ask the human for it — otherwise an LLM
    // driving the loop crowns a King under a fabricated or placeholder handle.
    const prompt = codeBlockMatching(container, /fighter/i);

    expect(prompt).toContain("X-Author-Handle");
    expect(prompt).toMatch(/required/i);
    expect(prompt.toLowerCase()).toContain("ask me");
  });
});
