# Architecture

## Scope

A public, multiplayer version of the Coherence game: a room of jurors scores nominees against a published policy with sealed scores, the scores are opened together, and every client derives the same ledger. One Cloudflare Worker serves the static site and the live store. The ledger arithmetic is a browser module shared by the game and the host's paper tool.

## Components and what talks to what

| Component | Role |
|---|---|
| Worker (`src/worker.ts`) | Serves the static pages through Workers Assets. Serves the game page for `/r/<code>`, hands `/r/<code>/ws` to the Room object for that code, accepts `POST /api/signup`, and serves `GET /api/signups.csv` to a bearer of the admin token. |
| Room (`src/room.ts`, one Durable Object per room code) | A document store with live subscriptions over hibernating WebSockets: `get`, `set`, `update`, `delete`, `acquire` (a cooperative lease), `sub`. It knows a little about the game, listed under guarantees, and nothing about the ledger. |
| Signups (`src/signups.ts`, one Durable Object) | Mailing-list rows, written by the sign-up page and read only by the admin export. |
| Protocol (`public/protocol.js`) | The one definition of message names, error codes, limits and the path grammar; imported by the Room and by the browser. |
| Store client (`public/store.js`) | The browser side of the protocol: references, snapshots, requests that wait for an open socket, reconnection with backoff, re-subscription after a reconnect, the server clock. |
| Ledger (`public/core.js`) | Pure functions from plays, leaks, the seated list and the game phase to every juror's balance. No external reads or writes. |
| Game page (`public/r/index.html`) | Renders the screens and writes through the store client. It never computes a band, a forfeit or a share itself. |
| Pages: deck, handout, sign-up, paper tool | Static. The paper tool imports the ledger. |

## Where state lives

- In the Room, under SQLite tables `docs`, `leases` and `seats`: the game state document `game/state` (phase, nominee index, host, epoch, bloc seed, the docket), and under `games/<epoch>/`: the roster (`players/<pid>`), per nominee (`nominees/n<i>`) its `openedAt`, `closedAt` and `seated` list, its plays (`plays/<pid>`) and its leak reports (`leaks/<leakerPid>`).
- On each juror's device, in local storage only: the juror id and secret, the name, and the salt of each sealed score. Nobody else holds a salt.
- In the Signups object: the mailing-list rows.
- Nowhere: balances. Every client derives them from the store with the ledger; there is no settlement write.

## Guarantees at the Room boundary

- **Seats.** A connection binds itself to a juror id with `hello`; the first hello for an id fixes its secret, a later hello with another secret is refused. Every write needs a bound seat.
- **Ownership.** A seat and a play are writable only by their owner; the host may also delete a seat. A nominee document is writable only by the host named in the game state. A leak is written only through `report`.
- **Sealed scores.** A play's `hash` and `past` hashes are delivered only to their owner, and its score and salt only once revealed, so nobody can brute-force a two-word salt. A reveal is accepted only if the SHA-256 of `score:salt` equals the stored hash, and the Room stamps `revealedAt`.
- **Reports.** `report` requires membership in the nominee's frozen scoring cohort, checks the proof against that nominee's plays, refuses the reporter's own proof, records the reporter from the connection, and creates the leak once. A recused cohort member may still report.
- **Phase integrity.** The Room validates the current epoch, host and phase for game writes. A nominee freezes its seated juror identifiers at opening and its grading cutoff once. Scores, recusals, seal history and reports cannot be rewritten after grading. A matching reveal received after the cutoff is recorded with its arrival time and excluded by the ledger. Document identifiers determine the identities in their bodies.
- **One clock.** `joinedAt`, `openedAt`, `closedAt` and `revealedAt` are stamped by the Room, and every client learns the Room's clock on connect, so the scoring window and the seated list never depend on a phone's clock.
- **Conditional writes.** `set`, `update` and `delete` accept `expect`, a set of field values the stored document must still have; a mismatch fails with `conflict`. Host transitions use it, so a stale host view cannot rewind a phase.
- **Last writer wins** otherwise. Individual writes, reports and conditional checks use a synchronous storage transaction. The store exposes no transaction across multiple requests; `acquire` coordinates only callers that use it.
- **Wipe.** `wipe` deletes every document and lease in the room in one step and pushes empty snapshots to every subscriber.

## Accepted limitations

- A room code in the URL is the only admission control; anyone with a seat may summon, take over, end, start a new game or wipe. The page asks for confirmation before each, and the host wipes after the session.
- Bloc membership is a hash of the juror id and a public seed, so a juror reading the page's code can compute who else is in the bloc. Nobody in the room will.
- The scoring window is advisory: the host closes it; seals are accepted until then. A nominee freezes its scoring cohort at opening; later arrivals join the next nominee.
- The Room bounds connections, documents and bytes, and reports resource exhaustion. Hosts wipe session data; persistent seat authentication survives a wipe. A new room code provides a fresh room.
- The roster belongs to the epoch, the docket is frozen in the game state at summon, and a new game reseats everyone; there is no cached snapshot, no docket document and no global roster.

## Runtime and supply chain

- The Worker is TypeScript bundled by Wrangler. The pages use JavaScript modules with no build step. Wrangler generates the ignored Worker declarations. Authored source is linted; generated runtime declarations remain outside lint. Worker and browser tests use separate strict type environments, matching Cloudflare and the browser respectively.
- npm with an exact-pinned, committed lockfile; `.npmrc` blocks install scripts, pins exact versions and refuses releases younger than fifteen days; CI installs with `npm ci` under a read-only token and actions pinned by commit.
- Tests: unit tests in Node for the protocol, the merge and the ledger; worker tests under `@cloudflare/vitest-pool-workers` for the Room, the sign-ups and the routes; a Playwright run against `wrangler dev` that plays a full session with thirty browsers.

## Shared public data and rendering

`public/domain.js` defines the policy, nominee descriptions and default docket once. The game, deck and paper tool consume those records. `public/session.js` supplies the session facts, attribution and addresses to the pages and generation scripts. `public/core.js` imports the shared score bounds and exposes the ledger through `globalThis.JuryCore`; consumers import it before deriving results.

The protocol module also defines room paths, canonical room routing, the sealed-score encoding and mailing-list input limits. The session module derives address confirmation from its authoritative site value. Browser validation and server routing share the same room grammar; no page constructs an independent route or phase definition.

The browser authenticates every new socket before replaying writes or owner subscriptions. Local sealed values are persisted by their hash before network transmission. A storage failure prevents sealing; an ambiguous timeout cannot discard an accepted seal. Overlapping acknowledgements across tabs cannot replace the salt needed by the authoritative seal. A restored browser page reloads to establish a fresh authenticated connection. Disconnection and terminal subscription failures are visible to the juror.

The shared stylesheet supplies the paper design tokens. The deck reuses the permitted figures and presents random draws as a discussed defence. The printable handout and score sheets are generated from the same session and docket records as the live pages.

## Dependency integrity

The committed lockfile pins the full dependency graph. The dependency policy records explicitly approved exceptions. Its checker verifies registry integrity and publication age for every locked package before installation; the vulnerability scan checks the resulting graph. Install scripts remain blocked. These checks apply to the local tooling and continuous integration.
