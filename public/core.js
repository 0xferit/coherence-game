import { GAME_PHASE, SCORE_MAX, SCORE_MIN } from "./protocol.js";

((root) => {
  var GAME_ANTE = 2520;
  var ROUND_REWARD_IN_ANTES = 4;
  var ROUND_REWARD = ROUND_REWARD_IN_ANTES * GAME_ANTE;
  var LEAK_PENALTY = GAME_ANTE;
  var LEAK_BOUNTY_FRACTION = 0.5;
  var LEAK_BOUNTY = LEAK_PENALTY * LEAK_BOUNTY_FRACTION;
  var SIGMA_MIN = 0.05;
  var K = 1.25;
  var TOTAL_FORFEIT_BANDS = 2;
  var EDGE_TOLERANCE = 1e-9;

  function clamp01(x) {
    return Math.min(1, Math.max(0, x));
  }

  function weightedMedian(entries, entryValue) {
    var total = entries.reduce((sum, e) => sum + e.stake, 0);
    var order = entries
      .map((e, i) => i)
      .sort((a, b) => entryValue(entries[a]) - entryValue(entries[b]));
    var cumulative = 0;
    for (let k = 0; k < order.length; k++) {
      cumulative += entries[order[k]].stake;
      if (2 * cumulative >= total) return entryValue(entries[order[k]]);
    }
    return entryValue(entries[order[order.length - 1]]);
  }

  /* Distance slashing as in "Decentralized Curation", section on the coherence
     game, https://doi.org/10.5281/zenodo.20543760: no forfeit inside the band, then a
     linear ramp reaching the whole stake TOTAL_FORFEIT_BANDS half-widths out. */
  function penaltyAt(d, half) {
    return d <= half ? 0 : clamp01((d - half) / (half * (TOTAL_FORFEIT_BANDS - 1)));
  }

  function closenessAt(d, half) {
    return d <= half ? 1 - d / half : 0;
  }

  function stakeWeightedMean(entries) {
    var total = 0;
    var weighted = 0;
    entries.forEach((e) => {
      total += e.stake;
      weighted += e.score * e.stake;
    });
    return total ? weighted / total : 0;
  }

  function shareByStake(coherent) {
    coherent.forEach((g) => {
      g.shareWeight = g.stake;
    });
  }

  function grade(entries, extraPot) {
    if (!entries.length) return null;
    var centre = stakeWeightedMean(entries);
    var madRaw = weightedMedian(entries, (e) => Math.abs(e.score - centre));
    var mad = Math.max(madRaw, SIGMA_MIN);
    var half = K * mad;
    var graded = entries.map((e) => {
      var d = Math.abs(e.score - centre);
      var within = d <= half + EDGE_TOLERANCE;
      var penalty = within ? 0 : penaltyAt(d, half);
      var closeness = within ? closenessAt(Math.min(d, half), half) : 0;
      return {
        pid: e.pid,
        score: e.score,
        stake: e.stake,
        distance: d,
        within: within,
        penalty: penalty,
        forfeit: e.stake * penalty,
        closeness: closeness,
        shareWeight: e.stake * closeness,
      };
    });
    var forfeited = graded.reduce((s, g) => s + g.forfeit, 0);
    var coherent = graded.filter((g) => g.within);
    var totalShareWeight = coherent.reduce((s, g) => s + g.shareWeight, 0);
    if (coherent.length && totalShareWeight === 0) {
      shareByStake(coherent);
      totalShareWeight = coherent.reduce((s, g) => s + g.shareWeight, 0);
    }
    var pot = forfeited + (extraPot || 0);
    graded.forEach((g) => {
      g.share = g.within && totalShareWeight ? g.shareWeight / totalShareWeight : 0;
      g.bands = g.distance / half;
      g.net = g.within ? pot * g.share : -g.forfeit;
    });
    return {
      centre: centre,
      madRaw: madRaw,
      mad: mad,
      half: half,
      lo: centre - half,
      hi: centre + half,
      graded: graded,
      coherentCount: coherent.length,
      outlierCount: graded.length - coherent.length,
      forfeited: forfeited,
      pot: pot,
    };
  }

  function isGraded(state, i, nomineeCount) {
    if (!state) return false;
    if (state.phase === GAME_PHASE.ENDED) {
      return i < (typeof state.gradedThrough === "number" ? state.gradedThrough : nomineeCount);
    }
    if (state.nomineeIdx > i) return true;
    return state.nomineeIdx === i && state.phase === GAME_PHASE.GRADED;
  }

  function wasSeated(player, openedAt) {
    return typeof openedAt === "number"
      ? typeof player.joinedAt === "number" && player.joinedAt <= openedAt
      : true;
  }

  function seatedPids(nominee, roster) {
    if (Array.isArray(nominee.seated)) return nominee.seated.slice();
    return roster.filter((p) => wasSeated(p, nominee.openedAt)).map((p) => p.pid);
  }

  function countsAsRevealed(play, closedAt) {
    if (
      play.revealed !== true ||
      !Number.isInteger(play.score) ||
      play.score < SCORE_MIN ||
      play.score > SCORE_MAX
    )
      return false;
    if (typeof closedAt !== "number") return true;
    return typeof play.revealedAt === "number" && play.revealedAt <= closedAt;
  }

  function nomineeDeltas(plays, leaks, roster, nominee) {
    nominee = nominee || {};
    var valid = plays.filter((p) => countsAsRevealed(p, nominee.closedAt));
    var recused = plays.filter((p) => p.recused).map((p) => p.pid);
    var seated = seatedPids(nominee, roster);
    var absent = seated.filter(
      (pid) => !valid.some((v) => v.pid === pid) && recused.indexOf(pid) < 0,
    );
    var grading = grade(
      valid.map((p) => ({ pid: p.pid, score: clamp01(p.score / SCORE_MAX), stake: GAME_ANTE })),
      ROUND_REWARD + absent.length * GAME_ANTE,
    );

    var delta = Object.create(null);
    function add(pid, v) {
      delta[pid] = (delta[pid] || 0) + v;
    }
    if (grading) {
      grading.graded.forEach((g) => {
        add(g.pid, g.net);
      });
      absent.forEach((pid) => {
        add(pid, -GAME_ANTE);
      });
    }
    leaks.forEach((l) => {
      add(l.leakerPid, -LEAK_PENALTY);
      add(l.reporterPid, LEAK_BOUNTY);
    });
    return {
      grading: grading,
      delta: delta,
      absent: grading ? absent : [],
      valid: valid,
      recused: recused,
      seated: seated,
    };
  }

  function ledger(nomineeDefs, byNominee, roster, state) {
    var balance = Object.create(null);
    var last = Object.create(null);
    var results = [];
    roster.forEach((p) => {
      balance[p.pid] = 0;
    });
    for (let i = 0; i < nomineeDefs.length; i++) {
      if (!isGraded(state, i, nomineeDefs.length)) {
        results.push(null);
        continue;
      }
      const src = byNominee[i] || { plays: [], leaks: [], openedAt: null };
      const r = nomineeDeltas(src.plays || [], src.leaks || [], roster, src);
      results.push(r);
      last = Object.create(null);
      Object.keys(r.delta).forEach((pid) => {
        balance[pid] = (balance[pid] || 0) + r.delta[pid];
        last[pid] = r.delta[pid];
      });
    }
    return { balance: balance, last: last, results: results };
  }

  root.JuryCore = {
    GAME_ANTE: GAME_ANTE,
    ROUND_REWARD: ROUND_REWARD,
    LEAK_PENALTY: LEAK_PENALTY,
    LEAK_BOUNTY: LEAK_BOUNTY,
    SIGMA_MIN: SIGMA_MIN,
    K: K,
    TOTAL_FORFEIT_BANDS: TOTAL_FORFEIT_BANDS,
    clamp01: clamp01,
    weightedMedian: weightedMedian,
    penaltyAt: penaltyAt,
    closenessAt: closenessAt,
    grade: grade,
    isGraded: isGraded,
    wasSeated: wasSeated,
    countsAsRevealed: countsAsRevealed,
    nomineeDeltas: nomineeDeltas,
    ledger: ledger,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
