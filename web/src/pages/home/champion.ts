// The identity-only view of a champion, mirroring the `GET /king` contract. Never the
// champion's bot DSL. `replayId` is the fight that seated them — null when it cannot be
// resolved (a seeded House champion, a bootstrap crown, or an archive read that failed).
//
// This lives in its own module rather than beside a view: `App` owns the `/king` fetch and
// `Podium` renders the payload, so neither of them owns the shape.
export type Champion = {
  name: string;
  model: string | null;
  handle: string | null;
  replayId: string | null;
};
