# Institute of Open Science Practices (IOSP) session kit requirements

This document records the approved workshop and product requirements. It is not a completion report. Current architectural decisions are recorded in `ARCHITECTURE.md`; release work is tracked by `docs/superpowers/plans/2026-10-08-public-game.md` and `docs/superpowers/plans/2026-10-08-session-pages.md`.

## Workshop

The kit supports a ninety-minute public workshop for about thirty participants using their own phones and laptops, without a projector and with café wireless networking. The session title, subtitle, date, event, venue, public address, working-paper reference and attribution are authoritative in `public/session.js`.

| Segment | Minutes | Purpose |
|---|---:|---|
| The claim | 10 | Explain the judgment a funding decision needs |
| Join | 5 | Enter the room and read the policy |
| Play | 30 | Score five or six nominees |
| Objections and defences | 30 | Examine herding, vote buying, collusion and policy quality |
| Where it fits and close | 15 | Discuss uses, the working paper and follow-up |

The public material leads with Decentralized Curation and calls the game “Coherence game”. It uses British spelling, defines abbreviations at first use and avoids em dashes. It contains no project-internal issue references, budgets or organisational decisions.

The workshop stays on one judgment: how much completed work matters under a published funding policy. Bonded claims, challenges, an accuracy layer and governance are outside its scope. Claims remain cautious: the working paper does not establish that honest scoring is a best response and supplies no safe collusion threshold. Random draws weighted by stake and appeals may be discussed as proposed defences; the workshop does not perform a live draw.

## Deliverables

| Piece | Purpose | Audience |
|---|---|---|
| Live game | A public multiplayer jury with sealed scores and a common ledger | Every participant |
| Deck | A short interactive deck following the run of show | Host and participants |
| Handout | One printed A4 page with the mechanism, objections, defences and follow-up links | Every participant |
| Sign-up | Name and email collection with a clear consent statement | Participants choosing follow-up |
| Paper fallback | Printable score sheets and a calculator using the same ledger | Host and jurors if connectivity fails |
| Landing page | An explanation, room entry and links to the kit | Anyone opening the site |

The kit is one public website plus printable materials. Participants need no account, wallet or organisation membership. Workshop stakes and rewards are points rather than money.

## Hosting and repository

The approved public repository is `0xferit/coherence-game`. The public host is a Cloudflare Worker at `coherence-game.<account>.workers.dev`; its confirmed address is set in the session module after deployment. Deck review takes place on a preview deployment of that website.

The Worker serves static assets, routes room WebSockets and accepts mailing-list submissions. Each room has its own SQLite-backed Room Durable Object. A separate Signups Durable Object stores mailing-list records. The browser pages use JavaScript modules without a site build step; the Worker uses TypeScript.

Dependency integrity rules and explicitly approved exceptions are recorded in `docs/dependency-policy.md`, `dependency-policy.json`, `.npmrc` and the committed lockfile. Exact direct dependency versions remain in `package.json`. The code is licensed GPL-3.0-or-later and the deck and handout text and figures CC BY 4.0, both under Ferit Tunçer's copyright; the session module supplies the attribution line and the licence line.

## Live game contract

### Rooms and identities

A room is selected by its code in `/r/<code>`. Codes are normalised consistently at room entry and Worker routing. Sharing the room address admits participants; possession of a room code is the workshop's admission control.

A juror's device keeps a random identifier and a secret in local storage. The server binds the identifier to that secret. A juror may write only their own seat and play; host actions are validated against the current game state. Blocked browser storage is explained before the device can seal a score.

The host may summon a jury, take over, close scoring, grade, advance, end, start a new game or wipe the room. Destructive session actions and takeover require confirmation in the page. An old confirmation must not survive a phase change. Hosts can remove stale seats; the room is wiped after the workshop.

### State and concurrency

The Room owns game state, the epoch roster, nominee metadata, plays and proof reports. The docket is selected before summon and frozen in the game state. The default docket and available spares are defined in `public/domain.js`; pages and print materials derive them from that module.

Seating and scoring timestamps come from the Room clock. Each nominee records its seated cohort at opening and its grading cutoff once. Historical results use those records, so later roster edits and late reveals cannot change a displayed result. A participant arriving after opening waits for the next nominee, including scoring and proof reports.

Conditional writes prevent stale host state from rewinding phases. State changes, proof reports and wipe are atomic at the Room boundary. A wipe clears documents and leases and publishes empty snapshots. A new game has its own epoch roster. Bounded resources report explicit exhaustion instead of leaving a client deriving incomplete results silently.

### Seals and proof reports

Scores are sealed before the host opens reveal. A seal is visible only to its owner; other participants cannot read its hash or private score data. Reveal is accepted only when the provided score and salt match the stored seal. The Room stamps reveal time, preserves the first accepted reveal and rejects edits that would change a closed result. A matching reveal received after grading may be recorded, but it does not count in that result.

A device must persist the salt for each candidate seal by hash before sending it. Storage failure prevents sealing. An uncertain acknowledgement, overlapping reseals or a second tab must not discard the salt required by the authoritative seal.

A proof report is checked against the nominee's current and prior seals. The reporter comes from the authenticated connection. Own proofs are refused, and a valid proof creates only one report and bounty. Fine and bounty effects remain in the ledger when a nominee is void or a juror recuses.

### Browser store and results

The shared wire contract is authoritative in `public/protocol.js`. The browser store authenticates before subscribing or replaying queued writes, reconnects with backoff, and obtains fresh document and collection snapshots. Invalid input, denied writes, missing data, timeout and terminal connection failures are visible to callers and the game page.

The ledger in `public/core.js` is the sole implementation of bands, forfeits, rewards and balances. Balances are derived from room data rather than written as settlements. All clients use the same seating and cutoff records and derive identical standings. Displayed net values include proof-report fines and bounties. Ties are marked and ordered deterministically. Participant text is rendered safely as text.

The scoring countdown is advisory; the host closes the window. The page shows who has not revealed and handles missing nominee data with a recovery path. A browser page restored after being closed must establish a fresh authenticated connection.

## Deck

The deck in `public/deck/index.html` contains fourteen slides and works on a laptop or a phone. It provides next, back and keyboard controls, interactive pointer and touch input, and a print layout.

| Slide | Content |
|---:|---|
| 1 | Session title, project and event details |
| 2 | Funding decisions need numbers without a ground truth |
| 3 | Distinguish evidence about completed work from a judgment of its importance |
| 4 | Join the room, with no account or wallet |
| 5 | The public policy, anchors and worked examples |
| 6 | The jury centre, band, rewards and forfeit ramp |
| 7 | Play the default docket |
| 8 | Herding and sealed scores |
| 9 | Vote buying and reportable proof |
| 10 | Collusion, the bloc illustration and the limits of the proposed defences |
| 11 | Vague policy, worked anchors and recusal |
| 12 | Fake identities and the proposed role of stake |
| 13 | Review panels, grant programmes and community funds |
| 14 | Working paper, mailing list and site |

Figures must be suitable for public distribution. Widgets call the real ledger rather than duplicating its arithmetic. Every slide must remain readable at a phone viewport without horizontal scrolling.

## Handout, sign-up and paper fallback

The handout in `public/handout/index.html` fits on one A4 page, with the mechanism, objections, defences, uses and follow-up links. Quick response codes link to the room, working paper and sign-up. `scripts/qr.mjs` derives their destinations from the session module; `scripts/print-handout.mjs` produces and validates `public/handout/handout.pdf`. Unconfirmed deployment addresses are shown as placeholders rather than usable codes.

The form in `public/join/index.html` collects name and email through `POST /api/signup` and states the purpose of collection. Invalid input, network failure and timeout preserve the typed values and show a clear error. The public form cannot read stored submissions. Only an administrator with the configured bearer secret can export comma-separated values; the export must be safe to open in a spreadsheet. Sending mailing-list messages is outside this kit.

`public/paper/sheets.html` prints one A5 score sheet per juror with a row for each default nominee, a score and two salt words. `public/paper/index.html` lets the host enter revealed scores and derives centre, band, forfeits and standings through the same ledger as the live game. It also supports the objections discussion.

## Verification and release

Release requires the declared dependency checks, type checking, lint, unit tests, real worker tests and browser tests. Regression tests must be observed failing for the intended reason before the corresponding fix is claimed verified. No gate is bypassed to obtain a passing result.

A full browser run uses thirty independent contexts against the local Worker and plays the default docket. It includes recusal, a changed seal, a proof report, two tabs sharing a seat, a participant sleeping through reveal, a host takeover during reveal and agreement of all final standings. Browser cleanup must run on success and failure.

The final print outputs are checked for page count, dimensions, clipping and readable codes. After deployment, the host tests the final site from a phone and laptop and conducts a dry run. Venue confirmation, printing and any external event registration remain release logistics rather than automated game behaviour.

## Outside scope

Accounts, wallets, real-money stake, playable appeals or claims-and-challenges rounds, a mailing-list sender, analytics, translation and a wider research experiment are not part of this kit.
