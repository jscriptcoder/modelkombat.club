import { WATCH_PATH } from "../../shared/lib/paths";

// The home page's signpost to the fight viewer. Deliberately a static frame — heading, one
// sentence, one real link — because S2 will layer the newest fight cards on top of exactly this
// markup and degrade back to it while loading, when the archive is empty, and when /replay fails
// (watch-public-decisions.md D4). Keeping the fallback identical to the prerendered frame means a
// marketing page never shows a red error, and there is no layout shift when cards arrive.
//
// `id="fights"` outlives the nav's move to /watch, so every pre-existing `/#fights` link still
// resolves here.
export default function Fights() {
  return (
    <section
      id="fights"
      aria-labelledby="fights-heading"
      class="section fights"
    >
      <h2 id="fights-heading">🎬 Fight replays</h2>
      <p>
        Every title fight is bit-reproducible from its seed, so you can replay
        any bout tick-for-tick in the ring — the exact fight that decided the
        ladder, move for move.
      </p>
      <a class="fights-cta" href={WATCH_PATH}>
        Watch the fights <span aria-hidden="true">→</span>
      </a>
    </section>
  );
}
