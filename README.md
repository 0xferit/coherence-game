# Decentralized Curation

A jury of strangers scores projects against a published curation policy. Scores are sealed, opened together, and every participant derives the same ledger. The workshop uses points and equal seats. It demonstrates rewards for agreement under the policy; it does not establish that honest scoring wins or a safe threshold for collusion.

The site contains the game, a session deck, a printable handout, a mailing-list form, and a paper calculator with score sheets. The policy and docket live in `public/domain.js`; session facts and addresses live in `public/session.js`.

## Local setup

Use the Node version in `.node-version` and npm with support for the configured release-age filter.

```sh
npm run scan
npm ci
npm run dev
```

Open `http://localhost:8787/r/dryrun`. Whoever summons the jury becomes host; the other participants enter their names and take seats.

Dependency exceptions are recorded in `dependency-policy.json`. The scanner verifies the complete lockfile before installation. Install scripts remain disabled. See `docs/dependency-policy.md`.

## Host a session

Choose the docket before summoning. The default projects and available spares come from the shared domain module. Share the room address, open a nominee, and let the jurors seal scores or recuse themselves. The scoring window is advisory; the host closes it, checks the unrevealed list, grades, and advances.

A juror whose device wakes after grading may open a matching seal, but that late reveal does not change the result. Jurors joining after a nominee opens wait for the next nominee. Hosting can be taken over with confirmation. Starting a new game reseats everyone; wiping empties the room's documents and leases.

The deck presents random draws and appeals as features of the proposed full design. The live workshop does not perform those draws or play the separate claims-and-challenges mechanism.

## Verify

```sh
npm run typecheck
npm run lint
npm test
npm run test:worker
npm run test:e2e
```

The final command includes the real thirty-juror session and browser checks. Install its pinned browser once with `npx playwright install chromium`. Browser processes and temporary profiles are closed when tests finish.

## Print

Set the confirmed public address in the session module, then generate the quick response codes and handout:

```sh
npm run qr
npm run dev
```

In a second terminal:

```sh
npm run print
```

The print script checks the resulting document's page count and A4 dimensions. The score sheets and deck also have print layouts. Unconfirmed addresses are shown as explicit placeholders.

## Deploy

```sh
npx --no-install wrangler login --scopes account:read user:read workers_scripts:write
npx --no-install wrangler deploy --secrets-file "$DEPLOY_SECRETS_FILE"
```

Create a random export token in your password manager. Set `DEPLOY_SECRETS_FILE` to a private JSON file outside the repository containing `{"ADMIN_TOKEN":"your export token"}`. Deployment uploads it as a Worker secret; remove the temporary file afterwards. On macOS, add `--use-keyring` to login to keep credentials encrypted with a key in the system keychain. Cloudflare documents [uploading secrets with code](https://developers.cloudflare.com/workers/configuration/secrets/#upload-secrets-alongside-code).

Only the bearer of the export token can read mailing-list records from `/api/signups.csv`. The public sign-up form cannot read them. Subsequent deployments preserve the secret and can use `npm run deploy`.

The former address redirects to the current one through a second deployment of the same code: `npx --no-install wrangler deploy --config wrangler.redirect.toml`. Run it after any change to the Worker so the two stay on one version. It needs no new secret; that deployment keeps its own.

After the first deployment, update the shared session address, regenerate and inspect the printable materials, and deploy again. Check the final site from a phone and laptop before the session.

## Licence

Copyright (C) 2026 Ferit Tunçer.

The code is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. The licence text is in `LICENSE`.

The text and figures of the deck (`public/deck/`) and the handout (`public/handout/`) are licensed under the Creative Commons Attribution 4.0 International licence (CC BY 4.0), whose text is in `LICENSE-CC-BY-4.0`.

The attribution line and the licence line shown on the pages are defined in the session module.
