await import(process.env.COHERENCE_CORE ?? new URL("../../public/core.js", import.meta.url).href);
const C = globalThis.JuryCore;
const A = C.GAME_ANTE;
function run(label, entries) {
  const g = C.grade(
    entries.map((e, i) => ({ pid: e.pid ?? `j${i}`, score: e.score, stake: e.stake ?? A })),
    C.ROUND_REWARD,
  );
  const groups = {};
  for (const x of g.graded) {
    const k = x.pid.replace(/\d+$/, "");
    groups[k] ??= [];
    groups[k].push(x);
  }
  console.log(`\n== ${label}`);
  console.log(
    `centre ${g.centre.toFixed(3)}  spread ${g.spread.toFixed(3)}  half ${g.half.toFixed(3)}  band [${g.lo.toFixed(3)}, ${g.hi.toFixed(3)}]  inside ${g.coherentCount} out ${g.outlierCount}  distance forfeits ${g.forfeitsEnabled ? "on" : "off"}  pot ${g.pot}`,
  );
  for (const [k, xs] of Object.entries(groups)) {
    const share = xs.reduce((s, x) => s + x.share, 0);
    const net = xs.reduce((s, x) => s + x.net, 0);
    const avgScore = xs.reduce((s, x) => s + x.score, 0) / xs.length;
    const avgBands = xs.reduce((s, x) => s + x.bands, 0) / xs.length;
    const avgPen = xs.reduce((s, x) => s + x.penalty, 0) / xs.length;
    console.log(
      `  ${k.padEnd(8)} n=${xs.length} avgScore ${avgScore.toFixed(3)} avgBands ${avgBands.toFixed(2)} inside ${xs.filter((x) => x.within).length} avgPenalty ${(avgPen * 100).toFixed(0)}% groupShare ${(share * 100).toFixed(1)}% groupNet ${net.toFixed(0)} perHead ${(net / xs.length).toFixed(0)} (${((net / xs.length / A) * 100).toFixed(0)}% of ante)`,
    );
  }
  return g;
}
const spread = (base, n, step, tag) =>
  Array.from({ length: n }, (_, i) => ({
    pid: `${tag}${i}`,
    score: Math.round((base + (i - (n - 1) / 2) * step) * 100) / 100,
  }));
const flat = (v, n, tag) => Array.from({ length: n }, (_, i) => ({ pid: `${tag}${i}`, score: v }));

// A: arXiv, bloc of 15 at 0.10 vs 15 honest 0.78..0.92
run("A arXiv: bloc 15/30 at 0.10, honest 15 around 0.85", [
  ...flat(0.1, 15, "bloc"),
  ...spread(0.85, 15, 0.01, "honest"),
]);
// B: bloc 10/30
run("B arXiv: bloc 10/30", [...flat(0.1, 10, "bloc"), ...spread(0.85, 20, 0.01, "honest")]);
// C: bloc 5/30
run("C arXiv: bloc 5/30", [...flat(0.1, 5, "bloc"), ...spread(0.85, 25, 0.01, "honest")]);
// C2: bloc 8/30
run("C2 arXiv: bloc 8/30", [...flat(0.1, 8, "bloc"), ...spread(0.85, 22, 0.01, "honest")]);
// C3: bloc 12/30
run("C3 arXiv: bloc 12/30", [...flat(0.1, 12, "bloc"), ...spread(0.85, 18, 0.01, "honest")]);
// D: bloc 15 + lazy 0.5 + 14 honest
run("D arXiv: bloc 15, lazy 1 at 0.50, honest 14", [
  ...flat(0.1, 15, "bloc"),
  { pid: "lazy0", score: 0.5 },
  ...spread(0.85, 14, 0.01, "honest"),
]);
// E: Linux tight room, lone expert at 0.75
run("E Linux: 29 at 0.88..0.96, expert at 0.75", [
  ...spread(0.92, 29, 0.003, "room"),
  { pid: "expert0", score: 0.75 },
]);
run("E2 Linux: 29 at 0.88..0.96, dissenter at 0.80", [
  ...spread(0.92, 29, 0.003, "room"),
  { pid: "dissent0", score: 0.8 },
]);
// F: PDF split 18 high / 12 low
run("F PDF: 18 at ~0.85 vs 12 at ~0.45", [
  ...spread(0.85, 18, 0.01, "high"),
  ...spread(0.45, 12, 0.01, "low"),
]);
run("F2 PDF: 16 at ~0.85 vs 14 at ~0.45", [
  ...spread(0.85, 16, 0.01, "high"),
  ...spread(0.45, 14, 0.01, "low"),
]);
// LaTeX field split: 12 math/phys/CS at 0.85, 18 others at 0.35
run("G LaTeX: 12 at ~0.85 (maths/physics/CS) vs 18 at ~0.35", [
  ...spread(0.85, 12, 0.01, "math"),
  ...spread(0.35, 18, 0.01, "other"),
]);
// H: whale under stake weighting
run("H stake-weighted: one whale 10x stake at 0.00 among 14 honest at 0.90", [
  { pid: "whale0", score: 0.0, stake: 10 * A },
  ...spread(0.9, 14, 0.005, "honest"),
]);
run("H2 stake-weighted: one whale 5x stake at 0.00 among 14 honest at 0.90", [
  { pid: "whale0", score: 0.0, stake: 5 * A },
  ...spread(0.9, 14, 0.005, "honest"),
]);
// I: the deck's own slide-10 widget: BASE jury, bloc at 0.90
const BASE = [
  0.33, 0.36, 0.38, 0.4, 0.41, 0.43, 0.44, 0.45, 0.46, 0.47, 0.48, 0.49, 0.5, 0.51, 0.52,
];
for (const pct of [0, 20, 33, 40, 47, 53, 60]) {
  const nb = Math.round((pct / 100) * BASE.length);
  run(
    `I deck widget: bloc ${pct}% (${nb}/15) at 0.90`,
    BASE.map((s, i) => ({ pid: i < nb ? `bloc${i}` : `base${i}`, score: i < nb ? 0.9 : s })),
  );
}
console.log(
  "\nDistance forfeits are disabled below spread",
  C.DISPERSION_EPSILON,
  "; the band has no width floor.",
);
