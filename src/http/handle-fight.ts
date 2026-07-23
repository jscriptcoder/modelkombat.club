// The `/fight` orchestration seam — the request→arena flow, extracted from
// `api/fight.ts` so the throne store and arena config are INJECTABLE (the S4
// dependency seam). `api/fight.ts` becomes a thin wrapper supplying production
// deps. Pure transport + orchestration over the deterministic engine (`benchmark`)
// and the platform-layer throne store — no DSL op, TCB untouched (invariant #2).
// S2: the 6-bot gauntlet pre-gate is gone — a bot fights the sitting champions directly.
import { arenaStandings, pairIndices } from "./arena-standings.js";
import { memberIdentity } from "./champion-identity.js";
import { boutReplayIds } from "./handle-replay.js";
import { problem, readValidatedBot } from "./envelope.js";
import { rankArena, type Standing } from "./rank-arena.js";
import { readArenaOrSeed } from "./seed-arena.js";
import { toTitleFightReport } from "./fight-report.js";
import type {
  ArenaMember,
  ArenaRecord,
  ReproRecord,
  ThroneStore,
} from "./throne-store.js";
import {
  benchmark,
  sameDoc,
  type BenchmarkConfig,
  type BenchmarkResult,
} from "../engine/benchmark.js";
import type { BotDoc } from "../engine/dsl.js";
import type { Rules } from "../engine/types.js";

// Everything the handler needs, injected: the arena (run config + the version key the throne is
// scoped to + the frozen top-N cap + the House seed) and the throne store. Tests inject a fresh
// in-memory store + a small seed; `api/fight.ts` supplies the frozen manifest + the production store.
export type FightDeps = {
  seeds: readonly number[];
  maxTicks: number;
  rules: Rules;
  match?: BenchmarkConfig["match"];
  version: string;
  store: ThroneStore;
  // The frozen per-version arena cap (D4, default 3). The arena keeps the top `n` contestants;
  // #1 is King. It changes only with a version bump (which starts a fresh empty ladder).
  n: number;
  // The House seed contested when the version's store is PHYSICALLY empty (D5/D15) — so the first
  // competitor of a fresh season round-robins the three House champions instead of a solo bootstrap
  // crown. `api/fight.ts` injects `buildSeedArena(loadGauntlet())`; tests inject a small controllable
  // seed. Required: with the seed always present, the effective arena is never empty, so there is no
  // empty-arena special case.
  seed: ArenaRecord;
};

// The placement block a competitor reads back — committed as a `title` (compete) or returned as a
// `projection` (practice). Same shape either way: the challenger's outcome/rank, the per-defender
// board, and the relegated defender (identity only) when a full arena shed one to seat it.
type BoardRow = {
  defender: ReturnType<typeof memberIdentity>;
  // The bout's content-hash replay id — present ONLY on a COMPETE title (D18): a committed fight is
  // watchable at /watch/<replayId>. A practice projection omits it (D12 — unwatchable).
  replayId?: string;
} & ReturnType<typeof toTitleFightReport>;
type Placement = {
  outcome: "crowned" | "entered" | "unplaced";
  rank?: number | null;
  board: BoardRow[];
  displaced?: ReturnType<typeof memberIdentity>;
};

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

// The RFC 9457 detail for a lost placement race — the arena moved between a caller's read and its
// atomic commit. The resolution is to resubmit against whichever arena landed first; there is no
// server-side auto-retry in v1.
const THRONE_MOVED_DETAIL =
  "The throne advanced to a new champion before your crown landed; resubmit to challenge the current King.";

// Attempt an atomic arena commit, appending the clearer's reproduction `record` in the SAME
// gen-guarded step (S5.1: archive raw material for the future `/replay`). Returns the 409 problem to
// surface on a lost CAS race (the arena moved since `readArena` — nothing is written, arena OR
// archive), or `undefined` when the commit landed and the caller should proceed. The "on moved →
// this 409" knowledge lives here once, shared by all three commit sites (the empty-arena bootstrap,
// a ranked placement, and a non-placer archiving its near-miss).
const commit = async (
  store: ThroneStore,
  version: string,
  expected: number | null,
  next: ArenaRecord,
  record: ReproRecord,
): Promise<Response | undefined> => {
  const result = await store.commitArena(version, expected, next, record);

  return result.ok
    ? undefined
    : problem(409, "/problems/throne-moved", THRONE_MOVED_DETAIL);
};

// The author handle is a REQUIRED, opaque, unverified label: at most 64 characters and
// free of control characters (NUL/CR/LF never arrive — the Headers transport blocks them
// — but DEL and the other C0 controls pass through, so the guard is the handler's own).
// Every crowned King is attributed to a handle; there is no anonymous crown.
const HANDLE_MAX = 64;

const hasControlChar = (s: string): boolean =>
  [...s].some((c) => {
    const code = c.charCodeAt(0);

    return code < 0x20 || code === 0x7f;
  });

// Read the required `X-Author-Handle` header → the sanitized handle, or a `400` problem
// when it is absent/empty, over-length, or carries control characters. Runs before the
// fight, so a missing or malformed handle is rejected cheaply and independently of where
// the bot would place.
const readHandle = (req: Request): Response | { handle: string } => {
  const raw = req.headers.get("x-author-handle");

  if (raw == null || raw === "") {
    return problem(
      400,
      "/problems/malformed-request",
      "The X-Author-Handle header is required — set it to the handle your fighter is credited under.",
    );
  }

  if (raw.length > HANDLE_MAX || hasControlChar(raw)) {
    return problem(
      400,
      "/problems/malformed-request",
      "The X-Author-Handle header must be at most 64 characters and contain no control characters.",
    );
  }

  return { handle: raw };
};

// Read the optional `X-Compete` header → whether this submission COMPETES (mutates the arena) or is a
// footprint-free PRACTICE run (evaluate only). `true` competes; `false` and — by default — an absent or
// empty header practice, so iterating never pollutes the ladder; a bot claims the throne only by opting
// in with `true`. Any OTHER value is a `400`: intent is never guessed, so a typo can't silently flip a
// deliberate compete into a practice run. Case-insensitive.
const readCompete = (req: Request): Response | { compete: boolean } => {
  // Absent → "" (same as an explicit empty value): the default footprint-free practice run. Only an
  // explicit "true" competes; "" and "false" practice. Any other value is rejected below.
  const normalized = (req.headers.get("x-compete") ?? "").toLowerCase();

  if (normalized === "" || normalized === "true" || normalized === "false") {
    return { compete: normalized === "true" };
  }

  return problem(
    400,
    "/problems/malformed-request",
    'The X-Compete header must be "true" or "false" (it is absent by default).',
  );
};

// The RFC 9457 detail for a resubmit of a sitting arena member (C4). A clone can never out-rank its
// original, so it is rejected as a no-op before any benchmark; the detail names the 1-based slot it
// duplicates so the author knows which fighter already holds that ground.
const arenaMirrorDetail = (slot: number): string =>
  `This fighter already holds arena slot #${slot} — resubmitting it (a model label is not a change) has no effect.`;

// Two documents are the SAME FIGHTER when their SCORING content matches (D17). `model` is an inert
// display label the interpreter never reads — `INPUT_HASH` excludes it, so a fight is byte-identical
// whatever the label — and the House seed stamps its champions `model: "House"` while the docs they
// are built from carry their own model. So a resubmit that differs ONLY by `model` (a raw House
// champion) is the same fighter and must still mirror-reject. Normalize `model` to a shared sentinel
// on both sides, then reuse the engine's byte-exact `sameDoc`: this is a strict superset of the
// byte-exact check (same model + same content still matches). The engine / `sameDoc` stay untouched —
// the normalization lives here in the http layer.
const MIRROR_MODEL = "";

const sameFighter = (a: BotDoc, b: BotDoc): boolean =>
  sameDoc({ ...a, model: MIRROR_MODEL }, { ...b, model: MIRROR_MODEL });

// If the submitted document is the same fighter (scoring content, `model` aside) as a current arena
// member, the 409 that rejects it (naming the member's 1-based slot); otherwise `undefined`, and the
// submission proceeds.
const mirrorSlot = (
  members: readonly ArenaMember[],
  doc: BotDoc,
): Response | undefined => {
  const index = members.findIndex((member) =>
    sameFighter(member.champion, doc),
  );

  return index === -1
    ? undefined
    : problem(409, "/problems/arena-mirror", arenaMirrorDetail(index + 1));
};

// Run the arena round-robin on the frozen version seeds (D-A: a deterministic tournament graph —
// each pair one permanent verdict) and reduce it to each contestant's Copeland win-count + Σ
// net-points (`arenaStandings`, the pure tally). The challenger fights every defender directly, and
// the King fight (defender #0) doubles as the title telemetry (D-C); the defenders' mutual fights
// (`pairIndices`) settle their order. Recompute-every-submission; the edge cache is deferred
// (cheap at N=3).
const roundRobin = (
  defenders: readonly ArenaMember[],
  challenger: ArenaMember,
  deps: FightDeps,
): {
  defenderStandings: Standing[];
  challengerStanding: Standing;
  challengerFights: BenchmarkResult[];
} => {
  const fight = (bot: BotDoc, opp: BotDoc): BenchmarkResult =>
    benchmark({
      bot,
      gauntlet: [opp],
      seeds: deps.seeds,
      maxTicks: deps.maxTicks,
      rules: deps.rules,
      match: deps.match,
    });

  // The challenger vs each defender (challenger as the bot) — direct win rate / net.
  const challengerFights = defenders.map((d) =>
    fight(challenger.champion, d.champion),
  );

  // Each unordered defender pair (i < j), with `i` as the bot.
  const defenderPairs = pairIndices(defenders.length).map(([i, j]) => ({
    i,
    j,
    result: fight(defenders[i].champion, defenders[j].champion),
  }));

  const { defenderStandings, challengerStanding } = arenaStandings({
    defenders,
    challenger,
    challengerFights,
    defenderPairs,
  });

  return {
    defenderStandings,
    challengerStanding,
    challengerFights,
  };
};

export const handleFight = async (
  req: Request,
  deps: FightDeps,
): Promise<Response> => {
  const parsed = await readValidatedBot(req, "/fight");

  if (parsed instanceof Response) return parsed;

  // Reject a malformed author handle up front — before the (costlier) round-robin and
  // independently of where the bot would place.
  const handleResult = readHandle(req);

  if (handleResult instanceof Response) return handleResult;

  const { handle } = handleResult;

  // Read the compete/practice intent up front — before the (costlier) round-robin, and after the handle
  // so a malformed handle wins over a malformed intent. Rejects a non-true/false `X-Compete` with 400.
  const competeResult = readCompete(req);

  if (competeResult instanceof Response) return competeResult;

  const { compete } = competeResult;

  // Build this competitor's reproduction record (S5.1): the challenger doc + the exact defender docs it
  // fought + the frozen seeds + version, from which any fight regenerates via `runFight` (never a
  // tape — invariant #1). `memberSeniority` is the pin key: the seniority it was seated at when it
  // placed, or `null` for a non-placer (never an arena member). `seeds`/`version` are constant across
  // all three commit sites, so this closure owns that wiring once.
  const reproRecord = (
    defenders: readonly ArenaMember[],
    memberSeniority: number | null,
  ): ReproRecord => ({
    challenger: parsed.doc,
    defenders: defenders.map((member) => member.champion),
    seeds: deps.seeds,
    version: deps.version,
    memberSeniority,
  });

  // Resolve the effective arena up front — before the round-robin. On a physically-empty
  // store this is the House seed (D5); `expected` is the CAS token to commit against — `null` when the
  // store is empty (so the seed materializes), else the stored generation (which guards a real
  // placement). With the seed always present the arena is never empty, so there is no bootstrap case.
  // The mirror guard rejects a byte-identical resubmit of a current member as a no-op (C4) — a clone
  // can never displace its original. The same snapshot feeds the placement below (the commit is still
  // gen-guarded via `expected`).
  const { arena, expected } = await readArenaOrSeed(
    deps.store,
    deps.version,
    deps.seed,
  );

  const mirror = mirrorSlot(arena.members, parsed.doc);

  if (mirror !== undefined) return mirror;

  // Settle a competitor's placement. COMPETE → attempt the (archiving) commit and, on success, return
  // the placement as a `title`; a lost CAS race surfaces as the 409. PRACTICE → write NOTHING and return
  // the SAME placement as a `projection` — never a title, so a consumer keying on `title` can't misread a
  // footprint-free preview as a real crown. The body is `{ version, title|projection }` — there is no
  // gauntlet gate, so every valid bot lands crowned/entered/unplaced (S2 drop-the-gauntlet). Shared by
  // all three placement outcomes below.
  const settle = async (
    placement: Placement,
    expected: number | null,
    next: ArenaRecord,
    record: ReproRecord,
  ): Promise<Response> => {
    if (!compete) {
      return json({ version: deps.version, projection: placement });
    }

    const moved = await commit(
      deps.store,
      deps.version,
      expected,
      next,
      record,
    );

    return moved ?? json({ version: deps.version, title: placement });
  };

  // Rank the challenger against the current arena — whether it has room or is full: round-robin the
  // defenders, keep the top N, #1 is King. While filling nobody is relegated (C2 join-if-room); a
  // full arena relegates its weakest (the (N+1)-th by the total order) unless the challenger is itself
  // the weakest, in which case it is `unplaced` and the arena is untouched. The entrant is stamped
  // with the next per-version seniority.
  const challenger: ArenaMember = {
    champion: parsed.doc,
    handle,
    seniority: arena.nextSeniority,
  };

  const { defenderStandings, challengerStanding, challengerFights } =
    roundRobin(arena.members, challenger, deps);

  const placement = rankArena({
    defenders: defenderStandings,
    challenger: challengerStanding,
    n: deps.n,
  });

  // Each board bout's content-hash replay id, in board order — computed ONLY when COMPETING (D18): a
  // practice projection is unwatchable (D12), so it carries none. Derived via the shared
  // `boutReplayIds` over the very record the archive stores (seniority is irrelevant to a bout id), so
  // a row's id is byte-for-byte the one `/replay` reconstructs — one hashing rule, no duplication.
  const replayIds = compete
    ? boutReplayIds(reproRecord(arena.members, null))
    : [];

  // The per-defender board (C7): every defender the challenger fought, in arena rank order (board[0]
  // = the reigning King), each pairing that defender's IDENTITY (never its document — the standings
  // are public via /king + podium) with the challenger's telemetry vs IT, at full per-defender
  // fidelity. Non-placers get the full board too — diagnose why, don't guess (D-C ethos). A compete
  // row also carries its bout's watch id (board[0]'s is the headline "watch this fight" target).
  const board = arena.members.map((member, i) => ({
    defender: memberIdentity(member),
    ...toTitleFightReport(challengerFights[i]),
    ...(compete ? { replayId: replayIds[i] } : {}),
  }));

  // Unplaced: the challenger ranked below every defender of a FULL arena. It joins no
  // arena slot — but competing it STILL commits (S5.1), gen-guarded against the arena it fought, to
  // archive its reproduction record (memberSeniority null — it is no member); the commit leaves the
  // arena byte-identical (only the archive grows). A CAS race means the arena moved under it, so its
  // "didn't place" verdict is stale → 409. On success board[0] still diagnoses the near-miss King.
  if (placement.outcome === "unplaced") {
    return settle(
      { outcome: "unplaced", board },
      expected,
      arena,
      reproRecord(arena.members, null),
    );
  }

  // A placement mutates the arena at the next generation (compete) — a CAS race surfaces as 409
  // throne-moved and the loser resubmits — or is projected read-only (practice). The atomic commit
  // archives the challenger's record — the defenders it fought, pinned by the seniority it was seated
  // at (so its replay is kept for as long as it holds an arena slot).
  return settle(
    {
      outcome: placement.outcome,
      rank: placement.rank,
      board,
      // The relegated defender (identity only, never the doc) — present only when a full arena shed
      // its weakest to seat this challenger; omitted while the arena still had room.
      ...(placement.displaced
        ? { displaced: memberIdentity(placement.displaced) }
        : {}),
    },
    expected,
    {
      members: placement.members,
      generation: arena.generation + 1,
      nextSeniority: arena.nextSeniority + 1,
    },
    reproRecord(arena.members, challenger.seniority),
  );
};
