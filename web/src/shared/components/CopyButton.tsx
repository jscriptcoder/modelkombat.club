import { createSignal, onCleanup } from "solid-js";

type CopyButtonProps = {
  // The exact text placed on the clipboard.
  readonly value: string;
  // Visible + accessible action label, e.g. "Copy link".
  readonly label: string;
  // The clipboard write, injectable so tests need no real clipboard permission.
  readonly copy?: (text: string) => Promise<void>;
};

// The confirmation holds for HOLD_MS, then fades out over FADE_MS. The text stays
// mounted through the fade (so the fade-out is actually visible) and is cleared
// afterwards, which lets the live region announce a fresh "Copied!" next time.
const HOLD_MS = 5000;
const FADE_MS = 500;

const writeToClipboard = (text: string): Promise<void> =>
  navigator.clipboard.writeText(text);

// A small clipboard glyph. Decorative: the label already names the button, so it
// is hidden from assistive tech and inlined to stay CSP-safe.
const ClipboardIcon = () => (
  <svg class="copy-icon" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="4.5" y="1.5" width="7" height="3" rx="1" />
    <rect x="2.5" y="3.5" width="11" height="11" rx="1.5" />
  </svg>
);

export default function CopyButton(props: CopyButtonProps) {
  const [message, setMessage] = createSignal("");
  const [shown, setShown] = createSignal(false);

  let fadeTimer: ReturnType<typeof setTimeout> | undefined;
  let clearTimer: ReturnType<typeof setTimeout> | undefined;

  const dismissLater = (): void => {
    clearTimeout(fadeTimer);
    clearTimeout(clearTimer);
    // Begin the fade at HOLD_MS (text still present so the fade is visible)...
    fadeTimer = setTimeout(() => setShown(false), HOLD_MS);
    // ...then drop the text once the fade has finished.
    clearTimer = setTimeout(() => setMessage(""), HOLD_MS + FADE_MS);
  };

  onCleanup(() => {
    clearTimeout(fadeTimer);
    clearTimeout(clearTimer);
  });

  const handleClick = async (): Promise<void> => {
    const write = props.copy ?? writeToClipboard;

    try {
      // Only confirm once the write actually resolves.
      await write(props.value);
      setMessage("Copied!");
      setShown(true);
      dismissLater();
    } catch {
      // Clipboard denied or unavailable: stay silent rather than claim success.
    }
  };

  return (
    <span class="copy">
      <button
        type="button"
        class="copy-button"
        onClick={() => void handleClick()}
      >
        <ClipboardIcon />
        {props.label}
      </button>
      <span
        class="copy-status"
        classList={{ "copy-status--shown": shown() }}
        role="status"
        aria-live="polite"
      >
        {message()}
      </span>
    </span>
  );
}
