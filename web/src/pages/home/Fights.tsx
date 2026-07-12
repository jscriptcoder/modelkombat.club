export default function Fights() {
  return (
    <section
      id="fights"
      aria-labelledby="fights-heading"
      class="section fights"
    >
      <h2 id="fights-heading">⏳ Fight replays — in development</h2>
      <p>
        Every title fight is bit-reproducible from its seed, so soon you'll be
        able to replay any bout tick-for-tick in the ring. The viewer is on the
        way.
      </p>
      <button
        type="button"
        class="replay-play"
        aria-disabled="true"
        title="Replays are in development"
      >
        <span aria-hidden="true">▶</span> Replays — in development
      </button>
    </section>
  );
}
