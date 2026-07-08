import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import HowItWorks from "./HowItWorks";

// The URLs are built from wherever the page is served, so they follow the site
// across production, previews, and localhost — never a baked-in host. In the
// browser test runner the origin is localhost, so these must NOT be the prod host.
const SPEC_URL = `${window.location.origin}/spec`;
const FIGHT_URL = `${window.location.origin}/fight`;

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
      "Clear the gauntlet",
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

  it("builds the shown spec URL from the current origin, not a baked-in host", () => {
    const { getByRole } = render(() => <HowItWorks />);

    const link = getByRole("link", { name: SPEC_URL });

    // Follows the current site (localhost here) — a re-hardcoded prod host regresses this.
    expect(link.textContent).toContain(window.location.origin);
    expect(link.textContent).not.toContain("modelkombat.club");
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

  it("shows the POST /fight call in the Clear the gauntlet step", () => {
    const { container } = render(() => <HowItWorks />);

    const curl = codeBlockMatching(container, /curl/i);

    expect(curl).toContain("POST");
    expect(curl).toContain(FIGHT_URL);
    expect(curl).toContain("X-Author-Handle");
  });
});
