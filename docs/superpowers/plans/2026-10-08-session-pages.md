# Session pages execution plan

This checklist covers the deck, printable handout, mailing-list form, paper fallback and landing page. It records release requirements, without implying that an unchecked gate has passed. The live-game checklist is `docs/superpowers/plans/2026-10-08-public-game.md`.

The approved requirements are in `docs/superpowers/specs/2026-10-08-iosp-session-kit-design.md`. Current architecture is documented in `ARCHITECTURE.md`. Shared facts and addresses come from `public/session.js`; policy and docket data come from `public/domain.js`; ledger arithmetic comes from `public/core.js`.

## B1. Shared presentation and facts

Ownership: `public/paper.css` and `public/session.js`.

- [ ] Use the same paper design tokens and base rules on every page, including `public/r/index.html`.
- [ ] Read the title, event, date, venue, addresses, paper reference, attribution and licence from the session module.
- [ ] Use British spelling, define abbreviations at first use and omit project-internal references.
- [ ] Display unconfirmed venue and deployment details as explicit placeholders.

## B2. Deck

Ownership: `public/deck/index.html`.

- [ ] Provide fourteen slides following the workshop's claim, join, play, objections and close.
- [ ] Keep the workshop on one judgment under the public policy; use only figures suitable for public distribution.
- [ ] Explain what the incentives reward without promising honest scoring is a best response or naming a safe collusion threshold.
- [ ] Present random draws and appeals as proposed defences discussed in the session; do not perform a live draw.
- [ ] Make the payment and bloc widgets call the shared ledger.
- [ ] Verify next/back controls, keyboard navigation, pointer dragging and real touch interaction.
- [ ] Read every slide at a phone viewport without horizontal scrolling and inspect the print layout.

## B3. Handout and address codes

Ownership: `public/handout/index.html`, `scripts/qr.mjs` and `scripts/print-handout.mjs`. The generated outputs are `public/handout/qr-room.svg`, `public/handout/qr-paper.svg`, `public/handout/qr-join.svg` and `public/handout/handout.pdf`.

- [ ] Fit the mechanism, objections, defences, uses and follow-up links on one A4 page.
- [ ] Generate quick response codes from the authoritative session addresses, with clear quiet zones and usable print dimensions.
- [ ] Keep room and mailing-list codes visibly pending until the public address is confirmed.
- [ ] Verify the portable document format output has one A4 page and inspect its rendered layout for clipping, wrapping and readable codes.
- [ ] Keep the printing browser and its temporary profile bounded by cleanup on every exit path.

## B4. Mailing-list page

Ownership: `public/join/index.html`, sending to the Worker's sign-up endpoint.

- [ ] Provide name, email, a clear consent statement and one submit action.
- [ ] Match the server's input constraints and keep typed values when validation or submission fails.
- [ ] Show invalid input, network failure and timeout explicitly; prevent repeated submission while a request is pending.
- [ ] Confirm success without exposing other mailing-list records.

## B5. Paper fallback

Ownership: `public/paper/index.html` and `public/paper/sheets.html`.

- [ ] Print one A5 sheet per juror, with a row for each default nominee, a score and two salt words.
- [ ] Generate sheets from the authoritative docket and validate the requested juror count.
- [ ] Grade typed scores through the shared ledger, including recusals and absences.
- [ ] Accept documented score formats, reject the first invalid score and keep one-score, equal-score and endpoint cases finite.
- [ ] Preserve participant names as display data, including prototype-like names.
- [ ] Inspect sheet pagination and the host calculator's phone layout.

## B6. Landing page

Ownership: `public/index.html`.

- [ ] Explain the workshop and link to the game, deck, handout, paper tool, working paper and mailing list.
- [ ] Validate and normalise entered room codes using the same room contract as the Worker and game.
- [ ] Derive all repeated session details from the shared module.

## B7. Page verification

Ownership: `e2e/pages.spec.ts` and `playwright.config.ts`.

- [ ] Exercise the real pages at desktop and phone viewports.
- [ ] Verify deck interaction, policy rendering, paper calculation boundaries and sign-up failure paths.
- [ ] Verify links and code generation agree with the shared session addresses.
- [ ] Run the configured checks and inspect every generated printable output before claiming release readiness.

## B8. Final publication

- [ ] Set the confirmed public address and venue in the session module when available.
- [ ] Regenerate address codes and the handout using the declared package scripts.
- [ ] Inspect the final portable document and confirm the links resolve on the deployed site.
- [ ] Deploy the updated assets after the game release checks pass.
- [ ] Check the complete kit from a phone and laptop on the final address.
- [ ] Print thirty handouts and thirty score sheets for the workshop, then conduct a dry run.
