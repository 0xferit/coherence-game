# Dependency policy

The project installs exact stable direct dependencies from the npm registry. The committed lockfile records every resolved dependency and its integrity hash. The project npm configuration keeps installation scripts disabled and sets a minimum release age of fifteen days. Continuous integration installs with `npm ci`.

The approved Cloudflare toolchain uses Wrangler 4.116.0 and the Cloudflare Workers Vitest pool 0.19.1. Both are stable releases from July 30, 2026. They share stable Miniflare and Workers runtime versions, avoiding the alpha Miniflare dependencies of newer releases.

The exact approved exceptions are defined once in `dependency-policy.json`. They cover the required transitive unenv prerelease and two stable security patches with their matching Sharp native packages. Every other prerelease and release younger than fifteen days remains forbidden. `npm run check:dependencies` reads the age gate from the npm configuration, verifies every locked package's publication timestamp and integrity against registry metadata, and checks the complete resolved graph against the exact exceptions.

Exact overrides use stable Youch 4.1.1 and Undici 7.29.1. Youch replaces Cloudflare's older beta while retaining the constructor and error-page methods Cloudflare calls. Undici's patch removes known network-client vulnerabilities without changing its major version.

`npm run scan` also runs the npm advisory scanner with the lowest severity threshold. It detects published vulnerability and malicious-package advisories. A clean scan does not establish that dependency code is free of malicious behavior; the scanner complements the age gate, lockfile and disabled installation scripts.

The dependency policy script and its exception file are enforcement surfaces. Changing their checks or broadening the exception requires explicit human approval.
