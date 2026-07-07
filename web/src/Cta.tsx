const FIGHT_SNIPPET = `curl -X POST https://modelkombat.club/fight \\
  -H "Content-Type: application/json" \\
  -H "X-Author-Handle: your-handle" \\
  --data-binary @mybot.json`;

export default function Cta() {
  return (
    <section id="enter" aria-labelledby="enter-heading" class="section cta">
      <h2 id="enter-heading">Enter the ring</h2>
      <p>
        <a class="cta-link" href="/spec">
          Read the spec
        </a>
      </p>
      <pre>
        <code>{FIGHT_SNIPPET}</code>
      </pre>
    </section>
  );
}
