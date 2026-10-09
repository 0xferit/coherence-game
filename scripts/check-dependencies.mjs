import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const policy = JSON.parse(
  await readFile(new URL("../dependency-policy.json", import.meta.url), "utf8"),
);
const stableExactVersion = /^\d+\.\d+\.\d+$/;
const allowedRegistry = "https://registry.npmjs.org/";
const millisecondsPerDay = 86400000;
const registryConcurrency = 8;
const registryTimeoutMs = 15000;
const npmConfig = await readFile(new URL("../.npmrc", import.meta.url), "utf8");
const ageConfig = npmConfig.split(/\r?\n/).find((line) => line.startsWith("min-release-age="));
const minimumReleaseAgeDays = Number(ageConfig?.split("=").at(-1));
if (!Number.isInteger(minimumReleaseAgeDays) || minimumReleaseAgeDays <= 0) {
  throw new Error("The npm configuration must specify a positive release age gate.");
}
const publicationCutoff = Date.now() - minimumReleaseAgeDays * millisecondsPerDay;
const failures = [];

for (const [name, version] of Object.entries({
  ...manifest.dependencies,
  ...manifest.devDependencies,
})) {
  if (!stableExactVersion.test(version)) {
    failures.push(`${name} must have an exact stable direct version, received ${version}`);
  }
  const installed = lock.packages[`node_modules/${name}`];
  if (installed?.version !== version) {
    failures.push(`${name} differs between the manifest and lockfile`);
  }
}

let inspected = 0;
const lockedVersions = new Map();
for (const [path, entry] of Object.entries(lock.packages)) {
  if (path === "") continue;
  const name = path.split("node_modules/").at(-1);
  const versions = lockedVersions.get(name) ?? [];
  versions.push({ version: entry.version, integrity: entry.integrity });
  lockedVersions.set(name, versions);
  inspected += 1;
  if (!entry.resolved?.startsWith(allowedRegistry) || !entry.integrity) {
    failures.push(`${path} must resolve to the registry with an integrity hash`);
  }
  if (entry.version?.includes("-") && !policy.allowedPrereleases[name]?.includes(entry.version)) {
    failures.push(`${name}@${entry.version} is an unapproved prerelease`);
  }
}

if (failures.length) {
  throw new Error(failures.join("\n"));
}

const pending = [...lockedVersions.entries()];
await Promise.all(
  Array.from({ length: registryConcurrency }, async () => {
    while (pending.length) {
      const [name, versions] = pending.pop();
      const response = await fetch(`${allowedRegistry}${encodeURIComponent(name)}`, {
        signal: AbortSignal.timeout(registryTimeoutMs),
      });
      if (!response.ok) {
        throw new Error(`Registry metadata unavailable for ${name}: ${response.status}`);
      }
      const metadata = await response.json();
      for (const { version, integrity } of versions) {
        const published = Date.parse(metadata.time?.[version]);
        if (!Number.isFinite(published)) {
          failures.push(`${name}@${version} has no verified publication timestamp`);
        } else if (
          published > publicationCutoff &&
          !policy.allowedFreshReleases[name]?.includes(version)
        ) {
          failures.push(`${name}@${version} is younger than ${minimumReleaseAgeDays} days`);
        }
        if (metadata.versions?.[version]?.dist?.integrity !== integrity) {
          failures.push(`${name}@${version} differs from its registry integrity manifest`);
        }
      }
    }
  }),
);

if (failures.length) {
  throw new Error(failures.join("\n"));
}

console.log(`Dependency policy passed for ${inspected} locked packages.`);
