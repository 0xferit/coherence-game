import { describe, expect, it } from "vitest";
import "../../public/core.js";

type Entry = { pid: string; score: number; stake: number };
type Graded = {
  pid: string;
  score: number;
  distance: number;
  within: boolean;
  net: number;
  penalty: number;
};
type Grading = {
  centre: number;
  spread: number;
  half: number;
  forfeitsEnabled: boolean;
  graded: Graded[];
  coherentCount: number;
  outlierCount: number;
  pot: number;
  forfeited: number;
};
type Core = {
  GAME_ANTE: number;
  ROUND_REWARD: number;
  LEAK_PENALTY: number;
  LEAK_BOUNTY: number;
  DISPERSION_EPSILON: number;
  K: number;
  TOTAL_FORFEIT_BANDS: number;
  penaltyAt(d: number, half: number): number;
  closenessAt(d: number, half: number): number;
  weightedMedian(
    entries: Array<{ stake: number; v: number }>,
    entryValue: (e: { v: number }) => number,
  ): number;
  grade(entries: Entry[], extraPot: number): Grading | null;
  nomineeDeltas(
    plays: unknown[],
    leaks: unknown[],
    roster: Array<{ pid: string; joinedAt?: number }>,
    nominee: Record<string, unknown>,
  ): {
    grading: Grading | null;
    delta: Record<string, number>;
    absent: string[];
    valid: unknown[];
    recused: string[];
    seated: string[];
  };
  ledger(
    defs: unknown[],
    byNominee: Array<Record<string, unknown>>,
    roster: Array<{ pid: string }>,
    state: Record<string, unknown>,
  ): { balance: Record<string, number>; last: Record<string, number>; results: unknown[] };
};
const C = (globalThis as unknown as { JuryCore: Core }).JuryCore;

function jury(scores: number[]): Entry[] {
  return scores.map((score, i) => ({ pid: `p${i}`, score, stake: C.GAME_ANTE }));
}

describe("the payout shape", () => {
  it("pays most at the centre, nothing at the band edge, and forfeits everything two bands out", () => {
    const half = 0.1;
    expect(C.closenessAt(0, half)).toBe(1);
    expect(C.closenessAt(half / 2, half)).toBeCloseTo(0.5);
    expect(C.closenessAt(half, half)).toBe(0);
    expect(C.penaltyAt(half, half)).toBe(0);
    expect(C.penaltyAt(1.5 * half, half)).toBeCloseTo(0.5);
    expect(C.penaltyAt(C.TOTAL_FORFEIT_BANDS * half, half)).toBe(1);
    expect(C.penaltyAt(3 * half, half)).toBe(1);
  });

  it("pays a coherent juror strictly less the farther they sit from the centre, and charges an outlier more the farther out", () => {
    const g = C.grade(
      jury([0.5, 0.48, 0.52, 0.46, 0.54, 0.44, 0.56, 0.42, 0.58, 0.4, 0.6]),
      C.ROUND_REWARD,
    );
    if (!g) throw new Error("graded nothing");
    const inside = g.graded.filter((x) => x.within).sort((a, b) => a.distance - b.distance);
    for (let i = 1; i < inside.length; i++) {
      const prev = inside[i - 1] as Graded;
      const cur = inside[i] as Graded;
      if (cur.distance > prev.distance) expect(cur.net).toBeLessThan(prev.net);
      else expect(cur.net).toBeCloseTo(prev.net);
    }
    const outside = g.graded.filter((x) => !x.within).sort((a, b) => a.distance - b.distance);
    expect(outside.length).toBeGreaterThan(0);
    for (let i = 1; i < outside.length; i++) {
      const prev = outside[i - 1] as Graded;
      const cur = outside[i] as Graded;
      if (cur.distance > prev.distance) expect(cur.net).toBeLessThan(prev.net);
    }
    expect((inside.at(-1) as Graded).net).toBeGreaterThanOrEqual(0);
  });

  it("conserves money: the coherent set splits exactly the forfeits plus the reward", () => {
    const g = C.grade(jury([0.5, 0.49, 0.51, 0.52, 0.48, 0.9, 0.1]), C.ROUND_REWARD);
    if (!g) throw new Error("graded nothing");
    const total = g.graded.reduce((s, x) => s + x.net, 0);
    expect(total).toBeCloseTo(C.ROUND_REWARD, 6);
    expect(g.pot).toBeCloseTo(g.forfeited + C.ROUND_REWARD, 6);
  });

  it("keeps the forty-percent bloc inside the standard-deviation band", () => {
    const scores = [...Array<number>(9).fill(0.3), ...Array<number>(6).fill(0.9)];
    const g = C.grade(jury(scores), C.ROUND_REWARD);
    if (!g) throw new Error("graded nothing");
    expect(g.graded.map((entry) => entry.penalty)).toEqual(Array<number>(scores.length).fill(0));
    expect(g.centre).toBeCloseTo(0.54);
    expect(g.spread).toBeCloseTo(0.2939387691339814);
    expect(g.half).toBeCloseTo(0.3674234614174768);
    expect(g.outlierCount).toBe(0);
  });

  it("splits the full reward by stake when identical scores collapse the band", () => {
    const score = 0.9;
    const g = C.grade(
      [
        { pid: "p0", score, stake: C.GAME_ANTE },
        { pid: "p1", score, stake: 2 * C.GAME_ANTE },
      ],
      C.ROUND_REWARD,
    );
    if (!g) throw new Error("graded nothing");
    expect(g.half).toBe(0);
    expect(g.centre).toBe(score);
    expect(g.spread).toBe(0);
    expect(g.forfeitsEnabled).toBe(false);
    expect(g.graded.map((entry) => entry.penalty)).toEqual([0, 0]);
    expect(g.graded[0]?.net).toBeCloseTo(C.ROUND_REWARD / 3);
    expect(g.graded[1]?.net).toBeCloseTo((2 * C.ROUND_REWARD) / 3);
  });

  it("weights both the centre and spread by stake at the score endpoints", () => {
    const g = C.grade(
      [
        { pid: "p0", score: 0, stake: C.GAME_ANTE },
        { pid: "p1", score: 1, stake: 3 * C.GAME_ANTE },
      ],
      C.ROUND_REWARD,
    );
    if (!g) throw new Error("graded nothing");
    expect(g.centre).toBe(0.75);
    expect(g.spread).toBeCloseTo(0.4330127018922193);
    expect(g.graded[0]?.penalty).toBeCloseTo(0.3856406460551018);
  });

  it("suspends distance forfeits below the dispersion cutoff and enables them at it", () => {
    const tinyScore = 3e-9;
    const low = C.grade(jury([...Array<number>(29).fill(0), tinyScore]), C.ROUND_REWARD);
    if (!low) throw new Error("graded nothing");
    expect(low.forfeitsEnabled).toBe(false);
    expect(low.outlierCount).toBe(1);
    expect(low.graded.at(-1)?.penalty).toBe(0);
    const boundary = C.grade(jury([0, 2 * C.DISPERSION_EPSILON]), C.ROUND_REWARD);
    if (!boundary) throw new Error("graded nothing");
    expect(boundary.spread).toBe(C.DISPERSION_EPSILON);
    expect(boundary.forfeitsEnabled).toBe(true);
  });

  it("takes the lower value when the weighted median is a tie", () => {
    expect(
      C.weightedMedian(
        [
          { stake: 1, v: 1 },
          { stake: 1, v: 3 },
        ],
        (e) => e.v,
      ),
    ).toBe(1);
  });
});

describe("who is charged", () => {
  const roster = [{ pid: "p1" }, { pid: "p2" }, { pid: "p3" }];

  it("counts a reveal only until the nominee closed, and charges the late juror as absent", () => {
    const plays = [
      { pid: "p1", revealed: true, score: 50, revealedAt: 100 },
      { pid: "p2", revealed: true, score: 55, revealedAt: 500 },
    ];
    const r = C.nomineeDeltas(plays, [], roster, {
      openedAt: 0,
      closedAt: 200,
      seated: ["p1", "p2", "p3"],
    });
    expect(r.valid).toHaveLength(1);
    expect(r.absent.sort()).toEqual(["p2", "p3"]);
    expect(r.delta["p2"]).toBe(-C.GAME_ANTE);
    expect(r.delta["p3"]).toBe(-C.GAME_ANTE);
  });

  it("counts every reveal while the nominee is still open", () => {
    const plays = [{ pid: "p1", revealed: true, score: 50, revealedAt: 900 }];
    const r = C.nomineeDeltas(plays, [], roster, { openedAt: 0, seated: ["p1"] });
    expect(r.valid).toHaveLength(1);
    expect(r.absent).toEqual([]);
  });

  it("takes the seated list from the nominee, not from the live roster", () => {
    const plays = [{ pid: "p1", revealed: true, score: 50, revealedAt: 1 }];
    const r = C.nomineeDeltas(plays, [], roster.concat([{ pid: "p9" }]), {
      openedAt: 0,
      closedAt: 10,
      seated: ["p1", "p2"],
    });
    expect(r.seated).toEqual(["p1", "p2"]);
    expect(r.absent).toEqual(["p2"]);
    expect(r.delta["p9"]).toBeUndefined();
  });

  it("falls back to joinedAt against openedAt when a nominee has no seated list", () => {
    const early = [
      { pid: "p1", joinedAt: 5 },
      { pid: "p2", joinedAt: 50 },
    ];
    const r = C.nomineeDeltas(
      [{ pid: "p1", revealed: true, score: 50, revealedAt: 20 }],
      [],
      early,
      { openedAt: 10 },
    );
    expect(r.seated).toEqual(["p1"]);
  });

  it("never charges a recused juror as absent, and applies leak fines and bounties even on a void nominee", () => {
    const plays = [{ pid: "p1", recused: true }];
    const leaks = [{ leakerPid: "p1", reporterPid: "p2" }];
    const r = C.nomineeDeltas(plays, leaks, roster, {
      openedAt: 0,
      closedAt: 10,
      seated: ["p1", "p2", "p3"],
    });
    expect(r.grading).toBeNull();
    expect(r.delta["p1"]).toBe(-C.LEAK_PENALTY);
    expect(r.delta["p2"]).toBe(C.LEAK_BOUNTY);
    expect(r.delta["p3"]).toBeUndefined();
  });
});

describe("reveal boundaries", () => {
  const roster = [{ pid: "p1", joinedAt: 0 }, { pid: "missing" }];

  it("accepts endpoint scores at the closing instant and excludes the first late reveal", () => {
    const atBoundary = [{ pid: "p1", revealed: true, score: 0, revealedAt: 0 }];
    expect(
      C.nomineeDeltas(atBoundary, [], roster, { openedAt: 0, closedAt: 0, seated: ["p1"] }).valid,
    ).toHaveLength(1);
    expect(
      C.nomineeDeltas([{ ...atBoundary[0], score: 100 }], [], roster, {
        closedAt: 0,
        seated: ["p1"],
      }).valid,
    ).toHaveLength(1);
    expect(
      C.nomineeDeltas([{ ...atBoundary[0], revealedAt: 1 }], [], roster, {
        closedAt: 0,
        seated: ["p1"],
      }).valid,
    ).toHaveLength(0);
  });

  it("excludes the first invalid score and a reveal without its authoritative timestamp", () => {
    for (const score of [-1, 101, 0.5, Number.NaN]) {
      expect(
        C.nomineeDeltas([{ pid: "p1", revealed: true, score, revealedAt: 0 }], [], roster, {
          closedAt: 0,
          seated: ["p1"],
        }).valid,
      ).toHaveLength(0);
    }
    expect(
      C.nomineeDeltas([{ pid: "p1", revealed: true, score: 50 }], [], roster, {
        closedAt: 0,
        seated: ["p1"],
      }).valid,
    ).toHaveLength(0);
  });

  it("treats zero as an opening timestamp and excludes seats without a join timestamp", () => {
    expect(C.nomineeDeltas([], [], roster, { openedAt: 0 }).seated).toEqual(["p1"]);
  });
});

describe("the ledger", () => {
  it("grades the nominees the phase says are graded and sums every delta into a balance", () => {
    const roster = [{ pid: "p1" }, { pid: "p2" }];
    const played = {
      plays: [
        { pid: "p1", revealed: true, score: 50, revealedAt: 1 },
        { pid: "p2", revealed: true, score: 50, revealedAt: 1 },
      ],
      leaks: [],
      openedAt: 0,
      closedAt: 10,
      seated: ["p1", "p2"],
    };
    const defs = [{}, {}, {}];
    const book = C.ledger(defs, [played, played, played], roster, {
      phase: "results",
      nomineeIdx: 1,
    });
    expect(book.results[2]).toBeNull();
    expect(book.balance["p1"]).toBeCloseTo(C.ROUND_REWARD, 6);
    expect(book.last["p1"]).toBeCloseTo(C.ROUND_REWARD / 2, 6);
    const ended = C.ledger(defs, [played, played, played], roster, {
      phase: "done",
      gradedThrough: 1,
    });
    expect(ended.balance["p1"]).toBeCloseTo(C.ROUND_REWARD / 2, 6);
  });
});

describe("juror identity keys", () => {
  it("accounts for every valid seat identifier independently of object prototype names", () => {
    const ids = ["constructor", "__proto__", "toString"];
    const roster = ids.map((pid) => ({ pid, joinedAt: 0 }));
    const nominee = {
      plays: ids.map((pid) => ({ pid, revealed: true, score: 50, revealedAt: 1 })),
      leaks: [],
      seated: ids,
      openedAt: 0,
      closedAt: 10,
    };
    const result = C.nomineeDeltas(nominee.plays, [], roster, nominee);
    const book = C.ledger([{}], [nominee], roster, { phase: "results", nomineeIdx: 0 });
    for (const pid of ids) {
      expect(Object.hasOwn(result.delta, pid)).toBe(true);
      expect(result.delta[pid]).toBeCloseTo(C.ROUND_REWARD / ids.length);
      expect(book.balance[pid]).toBeCloseTo(result.delta[pid] as number);
    }
    expect(Object.values(book.balance).reduce((sum, value) => sum + value, 0)).toBeCloseTo(
      C.ROUND_REWARD,
    );
  });
});
