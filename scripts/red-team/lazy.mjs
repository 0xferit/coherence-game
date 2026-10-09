await import(process.env.COHERENCE_CORE ?? new URL("../../public/core.js", import.meta.url).href);
const C = globalThis.JuryCore;
const A = C.GAME_ANTE;
const spread = (base, n, step, tag) =>
  Array.from({ length: n }, (_, i) => ({
    pid: `${tag}${i}`,
    score: Math.max(0, Math.min(1, Math.round((base + (i - (n - 1) / 2) * step) * 100) / 100)),
  }));
const flat = (v, n, tag) => Array.from({ length: n }, (_, i) => ({ pid: `${tag}${i}`, score: v }));
const rounds = {
  Inkscape: [...spread(0.1, 30, 0.004, "room")],
  Linux: [...spread(0.92, 30, 0.003, "room")],
  PDF: [...spread(0.85, 18, 0.01, "high"), ...spread(0.45, 12, 0.01, "low")],
  LaTeX: [...spread(0.85, 12, 0.01, "user"), ...spread(0.35, 18, 0.01, "nonuser")],
  arXiv: [...flat(0.1, 17, "bloc"), ...spread(0.85, 13, 0.01, "honest")],
  NumPy: [...spread(0.85, 22, 0.01, "py"), ...spread(0.6, 8, 0.01, "r")],
};
let lazyTotal = 0,
  carefulTotal = 0;
for (const [name, room] of Object.entries(rounds)) {
  const entries = [...room, { pid: "lazy", score: 0.5 }].map((e) => ({ ...e, stake: A }));
  const g = C.grade(entries, C.ROUND_REWARD);
  const lazy = g.graded.find((x) => x.pid === "lazy");
  const others = g.graded.filter((x) => x.pid !== "lazy");
  const careful = others.reduce((s, x) => s + x.net, 0) / others.length;
  lazyTotal += lazy.net;
  carefulTotal += careful;
  console.log(
    `${name.padEnd(9)} centre ${g.centre.toFixed(3)} half ${g.half.toFixed(3)} lazy ${lazy.within ? "inside " : "outside"} bands ${lazy.bands.toFixed(2)} net ${((lazy.net / A) * 100).toFixed(0).padStart(5)}% of ante | room average ${((careful / A) * 100).toFixed(0)}%`,
  );
}
console.log(
  `\nSix rounds: lazy juror ${((lazyTotal / A) * 100).toFixed(0)}% of one ante; average seated juror ${((carefulTotal / A) * 100).toFixed(0)}%`,
);
