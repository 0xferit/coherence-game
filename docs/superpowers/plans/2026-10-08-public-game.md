# Public Coherence game execution plan

This checklist covers the live game and its public deployment. It records the work to verify before release, without implying that an unchecked gate has passed. Session pages have a separate checklist in `docs/superpowers/plans/2026-10-08-session-pages.md`.

The approved requirements are in `docs/superpowers/specs/2026-10-08-iosp-session-kit-design.md`. `ARCHITECTURE.md` records the architecture in effect. Dependency versions and exceptions are authoritative in `package.json`, `package-lock.json` and `dependency-policy.json`; do not copy them into this plan.

## 1. Toolchain and dependency integrity

- [ ] Resolve the lockfile using only explicitly approved dependency exceptions.
- [ ] Run the complete dependency integrity, release-age and vulnerability checks described in `docs/dependency-policy.md` before installation.
- [ ] Install with `npm ci`, with lifecycle scripts blocked by `.npmrc`.
- [ ] Verify the commands and runtime declared by `package.json`, `.node-version`, `tsconfig.json`, `wrangler.toml`, `biome.json` and the test configurations.

## 2. Shared protocol and domain data

Ownership: `public/protocol.js` defines the wire contract; `public/domain.js` defines policy and docket data.

- [ ] Confirm every new public export has interface approval before implementation.
- [ ] Keep message names, errors, path grammar, score bounds and resource limits authoritative in the protocol module.
- [ ] Keep policy, nominee records and the default docket authoritative in the domain module.
- [ ] Exercise valid and first-invalid path boundaries through `test/unit/protocol.test.ts`.

## 3. Room document store

Ownership: the Room Durable Object, reached through `src/worker.ts`. Its contract is exercised by `test/worker/room.test.ts`; merge semantics are exercised by `test/unit/merge.test.ts` against `src/merge.ts`.

- [ ] Verify authenticated seat binding and ownership at the real worker boundary.
- [ ] Verify document replacement, deep updates, missing-document errors, idempotent deletion and conditional writes.
- [ ] Verify document and collection snapshots on registration, additions, updates and removals.
- [ ] Verify exclusive cooperative leases, expiry, reconnection and hibernation attachment bounds.
- [ ] Verify resource exhaustion is explicit and malformed messages do not corrupt stored state.
- [ ] Verify a room wipe empties documents and leases atomically and publishes empty snapshots.

## 4. Sign-ups and routes

Ownership: the Signups Durable Object and `src/worker.ts`. Boundary coverage is in `test/worker/signups.test.ts` and `test/worker/routes.test.ts`.

- [ ] Verify valid sign-ups, invalid input, duplicate submissions and bounded request bodies.
- [ ] Verify the public form cannot read stored mailing-list records.
- [ ] Verify export requires the configured bearer secret and protects spreadsheet consumers from formula injection.
- [ ] Verify room-code normalisation, trailing slashes, WebSocket upgrades, static pages and unsupported methods.

## 5. Game rules at the server boundary

Ownership: the Room Durable Object. `test/worker/rules.test.ts` exercises the game through its public messages.

- [ ] Bind body identities to authenticated seats and document identifiers.
- [ ] Refuse stale epochs, unauthorised nominee writes and invalid phase transitions.
- [ ] Freeze the docket at summon, seated cohort at opening and grading cutoff once.
- [ ] Stamp membership and phase times from the server clock.
- [ ] Hide sealed hashes from other seats; accept reveals only when they match the stored seal.
- [ ] Preserve a matching late reveal while excluding it from the closed result.
- [ ] Verify proof reports, own-proof refusal, duplicate reports, changed seals and shared-proof collisions.
- [ ] Preserve immutable results through takeovers, roster changes and subsequent games.

## 6. Browser store client

Ownership: `public/store.js`. `test/unit/store.test.ts` exercises its public boundary; the WebSocket peer and clock are external test boundaries.

- [ ] Authenticate each new connection before subscriptions or queued writes.
- [ ] Reconnect with backoff and replace subscriptions with fresh authoritative snapshots.
- [ ] Surface write errors, authentication refusal, timeout and permanent close.
- [ ] Reject pending requests on permanent failure rather than leaving callers waiting.

## 7. Ledger

Ownership: `public/core.js`. `test/unit/core.test.ts` pins the arithmetic and non-local result contracts.

- [ ] Verify closeness rewards, the forfeit ramp, recusals, absence and void rounds against meaningful boundary cases.
- [ ] Retain leak fines and bounties through recusals and void rounds.
- [ ] Derive historical results from frozen seating and the grading cutoff.
- [ ] Handle zero timestamps and prototype-like juror identifiers without invalid balances.
- [ ] Keep the browser game, deck widgets and paper calculator on this same ledger implementation.

## 8. Game page

Ownership: `public/r/index.html`, consuming the shared store, protocol, domain, session and ledger modules. Browser regressions are in `e2e/client.spec.ts`.

- [ ] Show connecting, failed storage and terminal subscription states clearly.
- [ ] Escape participant text everywhere it is rendered.
- [ ] Persist sealed values by hash before transmission; refuse sealing if persistence fails.
- [ ] Preserve salts across changed seals, uncertain acknowledgements and concurrent tabs.
- [ ] Use server time and conditional host transitions; report failures without advancing the display falsely.
- [ ] Recover missing nominees and restored browser pages with a fresh connection.
- [ ] Confirm takeover, ending, new game and wipe; reset stale confirmations on phase changes.
- [ ] Show complete unrevealed lists, deterministic tied standings and net values including proof reports.
- [x] Confirm that arrivals after opening wait for the next nominee, including proof reports.

## 9. Full session verification

Ownership: `e2e/thirty-jurors.spec.ts` and `playwright.config.ts`.

- [ ] Run a real six-nominee session with thirty independent browser contexts against the local Worker.
- [ ] Include recusal, changed seals, a proof report, hostile display text and a shared seat in two tabs.
- [ ] Include a client sleeping through reveal and returning after grading.
- [ ] Transfer hosting during reveal and compare every participant's final standings.
- [ ] Close every launched browser and temporary profile, including on failure.

## 10. Public release

- [ ] Run dependency checks, type checking, lint, unit tests, worker tests and browser tests through the declared project commands.
- [ ] Check the diff for duplicated knowledge and update `ARCHITECTURE.md` for every changed architectural decision.
- [ ] Keep public documentation free of machine-local paths and private review records.
- [ ] Configure continuous integration with lockfile-strict installation, blocked install scripts, read-only validation tokens and actions pinned by commit.
- [ ] Verify all staged files are intended for publication and pass the commit hooks.
- [ ] Publish the approved public repository after reviewing its complete published history.
- [ ] Authenticate Cloudflare, store the export secret and deploy the Worker.
- [ ] Set the confirmed address in `public/session.js`, then finish the session-pages release checklist.
- [ ] Smoke-test the deployed game from a phone and laptop before the workshop.
