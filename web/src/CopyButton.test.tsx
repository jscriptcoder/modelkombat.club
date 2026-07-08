import { fireEvent, render } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import CopyButton from "./CopyButton";

describe("CopyButton", () => {
  it("names the button by its visible label", () => {
    const { getByRole } = render(() => (
      <CopyButton value="anything" label="Copy link" copy={vi.fn()} />
    ));

    // The action reads as a button named exactly by the label — the clipboard
    // icon beside it is decorative and must not pollute the accessible name.
    expect(getByRole("button", { name: "Copy link" })).toBeTruthy();
  });

  it("writes the given value to the clipboard when clicked", () => {
    const copy = vi.fn(() => Promise.resolve());

    const { getByRole } = render(() => (
      <CopyButton
        value="https://modelkombat.club/spec"
        label="Copy link"
        copy={copy}
      />
    ));

    fireEvent.click(getByRole("button", { name: "Copy link" }));

    // It copies the value it was handed — not the label, not a hard-coded string.
    expect(copy).toHaveBeenCalledWith("https://modelkombat.club/spec");
  });

  it("confirms the copy in a live status region once it succeeds", async () => {
    const { getByRole, findByText, queryByText } = render(() => (
      <CopyButton value="x" label="Copy link" copy={() => Promise.resolve()} />
    ));

    // No premature confirmation before the user acts.
    expect(queryByText(/copied/i)).toBeNull();

    fireEvent.click(getByRole("button", { name: "Copy link" }));

    // The confirmation lands in an announced status region (screen readers hear it).
    const confirmation = await findByText(/copied/i);

    expect(confirmation).toBeTruthy();
    expect(confirmation.closest('[role="status"]')).toBeTruthy();
  });

  it("holds the confirmation for five seconds, then dismisses it", async () => {
    vi.useFakeTimers();

    try {
      const { getByRole, queryByText } = render(() => (
        <CopyButton
          value="x"
          label="Copy link"
          copy={() => Promise.resolve()}
        />
      ));

      fireEvent.click(getByRole("button", { name: "Copy link" }));

      // Flush the awaited clipboard write so the confirmation is shown.
      await vi.advanceTimersByTimeAsync(0);
      expect(queryByText(/copied/i)).not.toBeNull();

      // Still up just before the five-second mark — it does not vanish early.
      await vi.advanceTimersByTimeAsync(4900);
      expect(queryByText(/copied/i)).not.toBeNull();

      // Past five seconds (plus the brief fade), it is gone.
      await vi.advanceTimersByTimeAsync(800);
      expect(queryByText(/copied/i)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("restarts the five-second timer when copied again", async () => {
    vi.useFakeTimers();

    try {
      const { getByRole, queryByText } = render(() => (
        <CopyButton
          value="x"
          label="Copy link"
          copy={() => Promise.resolve()}
        />
      ));

      fireEvent.click(getByRole("button", { name: "Copy link" }));
      await vi.advanceTimersByTimeAsync(4000);

      // A second copy near the end of the window resets the countdown...
      fireEvent.click(getByRole("button", { name: "Copy link" }));
      await vi.advanceTimersByTimeAsync(0);

      // ...so 4 seconds later (8s after the first click) it is still up.
      await vi.advanceTimersByTimeAsync(4000);
      expect(queryByText(/copied/i)).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stays silent when the clipboard write is rejected", async () => {
    const { getByRole, findByRole, queryByText } = render(() => (
      <CopyButton
        value="x"
        label="Copy link"
        copy={() => Promise.reject(new Error("denied"))}
      />
    ));

    fireEvent.click(getByRole("button", { name: "Copy link" }));

    // Let any pending microtasks flush, then assert no false "Copied!" was shown.
    await findByRole("button", { name: "Copy link" });
    expect(queryByText(/copied/i)).toBeNull();
  });
});
