await import(process.env.COHERENCE_CORE ?? new URL("../../public/core.js", import.meta.url).href);
const C = globalThis.JuryCore;
const A = C.GAME_ANTE;
const spread = (base, n, step, tag) =>
  Array.from({ length: n }, (_, i) => ({
    pid: `${tag}${i}`,
    score: Math.round((base + (i - (n - 1) / 2) * step) * 100) / 100,
  }));
const flat = (v, n, tag) => Array.from({ length: n }, (_, i) => ({ pid: `${tag}${i}`, score: v }));
function run(label, entries) {
  const g = C.grade(
    entries.map((e) => ({ ...e, stake: e.stake ?? A })),
    C.ROUND_REWARD,
  );
  const groups = {};
  for (const x of g.graded) {
    const k = x.pid.replace(/\d+$/, "");
    groups[k] ??= [];
    groups[k].push(x);
  }
  console.log(
    `\n== ${label}\ncentre ${g.centre.toFixed(3)} half ${g.half.toFixed(3)} band [${g.lo.toFixed(3)}, ${g.hi.toFixed(3)}] inside ${g.coherentCount} out ${g.outlierCount}`,
  );
  for (const [k, xs] of Object.entries(groups))
    console.log(
      `  ${k.padEnd(7)} n=${xs.length} inside ${xs.filter((x) => x.within).length} share ${(xs.reduce((s, x) => s + x.share, 0) * 100).toFixed(1)}% perHead ${((xs.reduce((s, x) => s + x.net, 0) / xs.length / A) * 100).toFixed(0)}% of ante  avgBands ${(xs.reduce((s, x) => s + x.bands, 0) / xs.length).toFixed(2)}`,
    );
}
run("live arXiv: bloc 55% = 17/30 at 0.10, honest 13 around 0.85", [
  ...flat(0.1, 17, "bloc"),
  ...spread(0.85, 13, 0.01, "honest"),
]);
run("live arXiv with one lazy 0.50: bloc 17, lazy 1, honest 12", [
  ...flat(0.1, 17, "bloc"),
  { pid: "lazy0", score: 0.5 },
  ...spread(0.85, 12, 0.01, "honest"),
]);
run("live arXiv, 5 of 17 bloc members defect to honest 0.85 (bloc 12/30)", [
  ...flat(0.1, 12, "bloc"),
  ...spread(0.85, 18, 0.01, "honest"),
]);
run("stake-weighted: one staker with 51% at 0.00, 14 at 0.90", [
  { pid: "whale0", score: 0.0, stake: 15 * A },
  ...spread(0.9, 14, 0.005, "honest"),
]);
