import { describe, expect, it } from "vitest";
import { ERR, MSG } from "../../public/protocol.js";
import { sha256Hex } from "../../src/room";
import { type Msg, openRoom, type RoomClient } from "./helpers";

const HOST = "p-host";
const ADA = "p-ada1";
const BOB = "p-bob1";
const NOMINEE = "games/e1/nominees/n0";
const PLAYS = `${NOMINEE}/plays`;
const LEAKS = `${NOMINEE}/leaks`;
const STATE = "game/state";
const DOCKET = [
  { key: "first", name: "First", blurb: "First nominee" },
  { key: "second", name: "Second", blurb: "Second nominee" },
];

async function stateOf(client: RoomClient): Promise<Msg> {
  return ((await client.call({ t: MSG.GET, path: STATE }))["doc"] as { data: Msg }).data;
}

async function hostOf(code: string): Promise<RoomClient> {
  const host = await openRoom(code, { pid: HOST });
  expect((await host.call({ t: MSG.ACQUIRE, path: STATE, holder: HOST }))["acquired"]).toBe(true);
  expect(
    (
      await host.call({
        t: MSG.SET,
        path: STATE,
        data: {
          hostPid: HOST,
          epoch: "e1",
          phase: "lobby",
          nomineeIdx: 0,
          docket: DOCKET,
          seed: "test-seed",
          blocFraction: 0.3,
          openProofs: true,
        },
        expect: { epoch: null },
        stamp: ["startedAt"],
      })
    )["ok"],
  ).toBe(true);
  await seat(host, HOST);
  return host;
}

async function seat(client: RoomClient, pid: string): Promise<void> {
  expect(
    (
      await client.call({
        t: MSG.SET,
        path: `games/e1/players/${pid}`,
        data: { pid, name: pid },
        stamp: ["joinedAt"],
      })
    )["ok"],
  ).toBe(true);
}

async function transition(host: RoomClient, data: Msg): Promise<Msg> {
  const state = await stateOf(host);
  return host.call({
    t: MSG.UPDATE,
    path: STATE,
    data,
    expect: {
      epoch: state["epoch"],
      phase: state["phase"],
      nomineeIdx: state["nomineeIdx"],
      hostPid: state["hostPid"],
    },
  });
}

async function open(host: RoomClient): Promise<void> {
  expect(
    (
      await host.call({
        t: MSG.SET,
        path: NOMINEE,
        data: {},
        stamp: ["openedAt"],
        expect: { openedAt: null },
      })
    )["ok"],
  ).toBe(true);
  expect((await transition(host, { phase: "commit" }))["ok"]).toBe(true);
}

async function seal(
  client: RoomClient,
  pid: string,
  score = 62,
  salt = "apple banana",
): Promise<string> {
  const hash = await sha256Hex(`${score}:${salt}`);
  expect(
    (
      await client.call({
        t: MSG.SET,
        path: `${PLAYS}/${pid}`,
        data: { pid, hash, past: [], revealed: false },
      })
    )["ok"],
  ).toBe(true);
  return hash;
}

async function grade(host: RoomClient): Promise<void> {
  expect(
    (
      await host.call({
        t: MSG.UPDATE,
        path: NOMINEE,
        data: {},
        stamp: ["closedAt"],
        expect: { closedAt: null },
      })
    )["ok"],
  ).toBe(true);
  expect((await transition(host, { phase: "results" }))["ok"]).toBe(true);
}

describe("Room game integrity", () => {
  it("binds a seat to its first secret, including concurrent first hellos", async () => {
    const a = await openRoom("seat-race", { anonymous: true });
    const b = await openRoom("seat-race", { anonymous: true });
    const responses = await Promise.all([
      a.call({ t: MSG.HELLO, pid: ADA, secret: "first-secret" }),
      b.call({ t: MSG.HELLO, pid: ADA, secret: "other-secret" }),
    ]);
    expect(responses.map((response) => response["ok"]).sort()).toEqual([false, true]);
    expect((await b.call({ t: MSG.HELLO, pid: "bad pid", secret: "other-secret" }))["code"]).toBe(
      ERR.INVALID,
    );
  });

  it("allows anonymous reads and refuses anonymous writes, leases, reports and wipes", async () => {
    const anon = await openRoom("anonymous", { anonymous: true });
    for (const message of [
      { t: MSG.SET, path: "scratch/state", data: {} },
      { t: MSG.ACQUIRE, path: STATE, holder: HOST },
      { t: MSG.REPORT, nominee: NOMINEE, proof: { score: 62, salt: "apple banana" } },
      { t: MSG.WIPE },
    ])
      expect((await anon.call(message))["ok"]).toBe(false);
    expect((await anon.call({ t: MSG.GET, path: STATE }))["doc"]).toEqual({
      id: "state",
      exists: false,
    });
  });

  it("requires the summon lease and prevents stealing or forging its holder", async () => {
    const a = await openRoom("summon", { pid: ADA });
    const b = await openRoom("summon", { pid: BOB });
    const data = {
      hostPid: ADA,
      epoch: "e1",
      phase: "lobby",
      nomineeIdx: 0,
      docket: DOCKET,
      seed: "test-seed",
      blocFraction: 0.3,
      openProofs: true,
    };
    expect((await a.call({ t: MSG.SET, path: STATE, data, expect: { epoch: null } }))["ok"]).toBe(
      false,
    );
    expect((await a.call({ t: MSG.ACQUIRE, path: STATE, holder: ADA }))["acquired"]).toBe(true);
    expect((await b.call({ t: MSG.ACQUIRE, path: STATE, holder: ADA }))["ok"]).toBe(false);
    expect((await b.call({ t: MSG.ACQUIRE, path: STATE, holder: BOB }))["acquired"]).toBe(false);
    expect(
      (
        await b.call({
          t: MSG.SET,
          path: STATE,
          data: { ...data, hostPid: BOB },
          expect: { epoch: null },
        })
      )["ok"],
    ).toBe(false);
    expect((await a.call({ t: MSG.SET, path: STATE, data, expect: { epoch: null } }))["ok"]).toBe(
      true,
    );
  });

  it("binds document pid to its owned path and rejects wrong kinds, epochs and nominees", async () => {
    const host = await hostOf("owned");
    const ada = await openRoom("owned", { pid: ADA });
    expect(
      (
        await ada.call({
          t: MSG.SET,
          path: `games/e1/players/${ADA}`,
          data: { pid: BOB, name: "Spoof" },
        })
      )["ok"],
    ).toBe(false);
    expect(
      (
        await host.call({
          t: MSG.SET,
          path: `games/e1/players/${ADA}`,
          data: { pid: ADA, name: "Other" },
        })
      )["ok"],
    ).toBe(false);
    await seat(ada, ADA);
    await open(host);
    for (const path of [
      `games/stale/nominees/n0/plays/${ADA}`,
      `games/e1/nominees/n1/plays/${ADA}`,
      `scratch/x/plays/${ADA}`,
    ]) {
      expect(
        (await ada.call({ t: MSG.SET, path, data: { pid: ADA, recused: true, revealed: false } }))[
          "ok"
        ],
      ).toBe(false);
    }
    expect(
      (
        await ada.call({
          t: MSG.SET,
          path: `${PLAYS}/${ADA}`,
          data: { pid: BOB, recused: true, revealed: false },
        })
      )["ok"],
    ).toBe(false);
    expect((await ada.call({ t: MSG.SET, path: `${LEAKS}/${BOB}`, data: {} }))["ok"]).toBe(false);
    expect(
      (await ada.call({ t: MSG.SET, path: NOMINEE, data: {}, stamp: ["closedAt"] }))["ok"],
    ).toBe(false);
  });

  it("freezes the authoritative roster and timestamps instead of trusting client values", async () => {
    const host = await hostOf("clock");
    const ada = await openRoom("clock", { pid: ADA });
    await seat(ada, ADA);
    expect(
      (
        await ada.call({
          t: MSG.UPDATE,
          path: `games/e1/players/${ADA}`,
          data: { joinedAt: 1 },
          stamp: ["joinedAt"],
        })
      )["ok"],
    ).toBe(true);
    const before = (
      (await ada.call({ t: MSG.GET, path: `games/e1/players/${ADA}` }))["doc"] as { data: Msg }
    ).data["joinedAt"];
    await open(host);
    const metadata = ((await host.call({ t: MSG.GET, path: NOMINEE }))["doc"] as { data: Msg })
      .data;
    expect(metadata["seated"]).toEqual([ADA, HOST]);
    expect(Number(metadata["openedAt"])).toBeGreaterThan(1);
    expect(Number(before)).toBeGreaterThan(1);
    expect((await host.call({ t: MSG.UPDATE, path: NOMINEE, data: { seated: [] } }))["ok"]).toBe(
      false,
    );
    expect((await host.call({ t: MSG.UPDATE, path: NOMINEE, data: { openedAt: 1 } }))["ok"]).toBe(
      false,
    );
    expect((await host.call({ t: MSG.DELETE, path: `games/e1/players/${ADA}` }))["ok"]).toBe(true);
    const retained = ((await host.call({ t: MSG.GET, path: NOMINEE }))["doc"] as { data: Msg })
      .data;
    expect(retained["seated"]).toEqual([ADA, HOST]);
  });

  it("strips seal secrets from subscriptions, validates reveals and preserves the original reveal", async () => {
    const host = await hostOf("views");
    const ada = await openRoom("views", { pid: ADA });
    const bob = await openRoom("views", { pid: BOB });
    await seat(ada, ADA);
    await seat(bob, BOB);
    await open(host);
    expect((await bob.sub("plays", PLAYS, "col"))["docs"]).toEqual([]);
    const hash = await seal(ada, ADA);
    const sealed = (await bob.next((message) => message["id"] === "plays"))["docs"] as Array<{
      data: Msg;
    }>;
    expect(sealed[0]?.data).toMatchObject({
      pid: ADA,
      sealed: true,
      resealed: false,
      revealed: false,
    });
    expect(sealed[0]?.data).not.toHaveProperty("hash");
    expect(sealed[0]?.data).not.toHaveProperty("past");
    expect(
      ((await ada.call({ t: MSG.GET, path: `${PLAYS}/${ADA}` }))["doc"] as { data: Msg }).data[
        "hash"
      ],
    ).toBe(hash);
    const reveal = { score: 62, salt: "apple banana", revealed: true };
    expect((await ada.call({ t: MSG.UPDATE, path: `${PLAYS}/${ADA}`, data: reveal }))["ok"]).toBe(
      false,
    );
    expect((await transition(host, { phase: "reveal" }))["ok"]).toBe(true);
    expect(
      (await ada.call({ t: MSG.UPDATE, path: `${PLAYS}/${ADA}`, data: { ...reveal, score: 63 } }))[
        "ok"
      ],
    ).toBe(false);
    expect(
      (
        await ada.call({
          t: MSG.UPDATE,
          path: `${PLAYS}/${ADA}`,
          data: { ...reveal, revealedAt: 1 },
        })
      )["ok"],
    ).toBe(false);
    expect((await ada.call({ t: MSG.UPDATE, path: `${PLAYS}/${ADA}`, data: reveal }))["ok"]).toBe(
      true,
    );
    const original = (
      (await ada.call({ t: MSG.GET, path: `${PLAYS}/${ADA}` }))["doc"] as { data: Msg }
    ).data;
    for (const data of [
      { revealed: false },
      { recused: true },
      { hash: await sha256Hex("50:other words") },
      { ...reveal, score: 63 },
    ]) {
      expect((await ada.call({ t: MSG.UPDATE, path: `${PLAYS}/${ADA}`, data }))["ok"]).toBe(false);
    }
    expect((await ada.call({ t: MSG.UPDATE, path: `${PLAYS}/${ADA}`, data: reveal }))["ok"]).toBe(
      true,
    );
    const publicDoc = (
      (await bob.call({ t: MSG.GET, path: `${PLAYS}/${ADA}` }))["doc"] as { data: Msg }
    ).data;
    expect(publicDoc).toMatchObject({
      score: 62,
      salt: "apple banana",
      revealedAt: original["revealedAt"],
    });
    expect(publicDoc).not.toHaveProperty("hash");
    expect(publicDoc).not.toHaveProperty("past");
  });

  it("accepts a matching full-document reveal without replacing sealed state", async () => {
    const host = await hostOf("replace-reveal");
    const ada = await openRoom("replace-reveal", { pid: ADA });
    await seat(ada, ADA);
    await open(host);
    const hash = await seal(ada, ADA);
    await transition(host, { phase: "reveal" });
    expect(
      (
        await ada.call({
          t: MSG.SET,
          path: `${PLAYS}/${ADA}`,
          data: { pid: ADA, hash, past: [], revealed: true, score: 62, salt: "apple banana" },
        })
      )["ok"],
    ).toBe(true);
    const revealed = (
      (await ada.call({ t: MSG.GET, path: `${PLAYS}/${ADA}` }))["doc"] as { data: Msg }
    ).data;
    expect(revealed).toMatchObject({
      pid: ADA,
      hash,
      score: 62,
      salt: "apple banana",
      revealed: true,
    });
  });

  it("records proofs once while commit is open, including authentic previous seals", async () => {
    const host = await hostOf("reports");
    const ada = await openRoom("reports", { pid: ADA });
    const bob = await openRoom("reports", { pid: BOB });
    await seat(ada, ADA);
    await seat(bob, BOB);
    await open(host);
    const first = await seal(ada, ADA);
    const hash = await sha256Hex("55:other words");
    expect(
      (
        await ada.call({
          t: MSG.SET,
          path: `${PLAYS}/${ADA}`,
          data: { pid: ADA, hash, past: [], revealed: false },
        })
      )["ok"],
    ).toBe(true);
    const own = ((await ada.call({ t: MSG.GET, path: `${PLAYS}/${ADA}` }))["doc"] as { data: Msg })
      .data;
    expect(own["past"]).toEqual([first]);
    const proof = { score: 62, salt: "apple banana" };
    expect((await ada.call({ t: MSG.REPORT, nominee: NOMINEE, proof }))["ok"]).toBe(false);
    expect(
      (await bob.call({ t: MSG.REPORT, nominee: NOMINEE, proof: { ...proof, score: 63 } }))["ok"],
    ).toBe(false);
    expect((await bob.call({ t: MSG.REPORT, nominee: "scratch/state", proof }))["ok"]).toBe(false);
    expect(
      await bob.call({ t: MSG.REPORT, nominee: NOMINEE, proof, reporterPid: HOST }),
    ).toMatchObject({ ok: true, leakerPid: ADA, duplicate: false });
    expect(await host.call({ t: MSG.REPORT, nominee: NOMINEE, proof })).toMatchObject({
      ok: true,
      leakerPid: ADA,
      duplicate: true,
    });
    expect(
      ((await host.call({ t: MSG.GET, path: LEAKS }))["docs"] as Array<{ data: Msg }>)[0]?.data,
    ).toMatchObject({ leakerPid: ADA, reporterPid: BOB });
    expect((await transition(host, { phase: "reveal" }))["ok"]).toBe(true);
    expect((await bob.call({ t: MSG.REPORT, nominee: NOMINEE, proof }))["ok"]).toBe(false);
  });

  it("freezes graded plays and reports but records a valid late reveal beyond the grading cutoff", async () => {
    const host = await hostOf("graded");
    const ada = await openRoom("graded", { pid: ADA });
    const bob = await openRoom("graded", { pid: BOB });
    await seat(ada, ADA);
    await seat(bob, BOB);
    await open(host);
    await seal(ada, ADA);
    await transition(host, { phase: "reveal" });
    await grade(host);
    const metadata = ((await host.call({ t: MSG.GET, path: NOMINEE }))["doc"] as { data: Msg })
      .data;
    for (const message of [
      { t: MSG.DELETE, path: `${PLAYS}/${ADA}` },
      { t: MSG.SET, path: `${PLAYS}/${ADA}`, data: { pid: ADA, recused: true, revealed: false } },
      { t: MSG.UPDATE, path: `${PLAYS}/${ADA}`, data: { past: [] } },
      { t: MSG.REPORT, nominee: NOMINEE, proof: { score: 62, salt: "apple banana" } },
    ])
      expect((await ada.call(message))["ok"]).toBe(false);
    expect(
      (
        await ada.call({
          t: MSG.UPDATE,
          path: `${PLAYS}/${ADA}`,
          data: { score: 62, salt: "apple banana", revealed: true },
        })
      )["ok"],
    ).toBe(true);
    const late = ((await ada.call({ t: MSG.GET, path: `${PLAYS}/${ADA}` }))["doc"] as { data: Msg })
      .data;
    expect(Number(late["revealedAt"])).toBeGreaterThan(Number(metadata["closedAt"]));
    expect(
      (await host.call({ t: MSG.UPDATE, path: NOMINEE, data: {}, stamp: ["closedAt"] }))["ok"],
    ).toBe(false);
    expect((await host.call({ t: MSG.DELETE, path: NOMINEE }))["ok"]).toBe(false);
  });

  it("refuses the reporter's own historical proof even when another juror also sealed it", async () => {
    const host = await hostOf("shared-proof");
    const ada = await openRoom("shared-proof", { pid: ADA });
    const bob = await openRoom("shared-proof", { pid: BOB });
    await seat(ada, ADA);
    await seat(bob, BOB);
    await open(host);
    await seal(ada, ADA);
    await seal(bob, BOB);
    await seal(bob, BOB, 55, "other words");
    expect(
      (
        await bob.call({
          t: MSG.REPORT,
          nominee: NOMINEE,
          proof: { score: 62, salt: "apple banana" },
        })
      )["ok"],
    ).toBe(false);
    expect((await bob.call({ t: MSG.GET, path: LEAKS }))["docs"]).toEqual([]);
  });

  it("admits a late juror to reports only after the next nominee opens with that seat", async () => {
    const host = await hostOf("late-report");
    const ada = await openRoom("late-report", { pid: ADA });
    await seat(ada, ADA);
    await open(host);
    const latePid = "p-late";
    const late = await openRoom("late-report", { pid: latePid });
    await seat(late, latePid);
    await seal(ada, ADA);
    const proof = { score: 62, salt: "apple banana" };
    const refused = await late.call({ t: MSG.REPORT, nominee: NOMINEE, proof });
    expect(refused["code"]).toBe(ERR.DENIED);
    expect((await late.call({ t: MSG.GET, path: LEAKS }))["docs"]).toEqual([]);

    expect((await transition(host, { phase: "reveal" }))["ok"]).toBe(true);
    await grade(host);
    expect((await transition(host, { phase: "lobby", nomineeIdx: 1 }))["ok"]).toBe(true);
    const nextNominee = "games/e1/nominees/n1";
    expect(
      (
        await host.call({
          t: MSG.SET,
          path: nextNominee,
          data: {},
          stamp: ["openedAt"],
          expect: { openedAt: null },
        })
      )["ok"],
    ).toBe(true);
    expect((await transition(host, { phase: "commit" }))["ok"]).toBe(true);
    const hash = await sha256Hex(`${proof.score}:${proof.salt}`);
    expect(
      (
        await ada.call({
          t: MSG.SET,
          path: `${nextNominee}/plays/${ADA}`,
          data: { pid: ADA, hash, past: [], revealed: false },
        })
      )["ok"],
    ).toBe(true);
    expect(
      (
        await late.call({
          t: MSG.SET,
          path: `${nextNominee}/plays/${latePid}`,
          data: { pid: latePid, recused: true, revealed: false },
        })
      )["ok"],
    ).toBe(true);
    expect(await late.call({ t: MSG.REPORT, nominee: nextNominee, proof })).toMatchObject({
      ok: true,
      leakerPid: ADA,
      duplicate: false,
    });
    const leaks = (await late.call({ t: MSG.GET, path: `${nextNominee}/leaks` }))["docs"] as Array<{
      data: Msg;
    }>;
    expect(leaks[0]?.data).toMatchObject({ reporterPid: latePid, leakerPid: ADA });
  });

  it("uses conditional host transitions atomically and rejects rewinds, forged metadata and docket changes", async () => {
    const host = await hostOf("transitions");
    const other = await openRoom("transitions", { pid: ADA });
    await seat(other, ADA);
    const lobby = await stateOf(host);
    expect((await transition(host, { phase: "commit" }))["ok"]).toBe(false);
    expect((await transition(host, { docket: [] }))["ok"]).toBe(false);
    expect((await transition(host, { nomineeIdx: 1 }))["ok"]).toBe(false);
    expect((await transition(host, { startedAt: 1 }))["ok"]).toBe(false);
    await open(host);
    const commit = await stateOf(host);
    const expectState = {
      epoch: commit["epoch"],
      phase: commit["phase"],
      nomineeIdx: commit["nomineeIdx"],
      hostPid: commit["hostPid"],
    };
    const outcomes = await Promise.all([
      host.call({ t: MSG.UPDATE, path: STATE, data: { phase: "reveal" }, expect: expectState }),
      other.call({ t: MSG.UPDATE, path: STATE, data: { hostPid: ADA }, expect: expectState }),
    ]);
    expect(outcomes.map((outcome) => outcome["ok"]).sort()).toEqual([false, true]);
    expect(outcomes.find((outcome) => !outcome["ok"])?.["code"]).toBe(ERR.CONFLICT);
    expect(
      (await host.call({ t: MSG.UPDATE, path: STATE, data: { phase: "lobby" }, expect: lobby }))[
        "code"
      ],
    ).toBe(ERR.CONFLICT);
    expect(
      (await other.call({ t: MSG.UPDATE, path: STATE, data: { phase: "done", gradedThrough: 2 } }))[
        "ok"
      ],
    ).toBe(false);
  });

  it("wipes documents and leases together and sends empty subscription snapshots", async () => {
    const host = await hostOf("wipe");
    await open(host);
    await host.sub("state", STATE, "doc");
    await host.sub("roster", "games/e1/players", "col");
    expect((await host.call({ t: MSG.WIPE }))["ok"]).toBe(true);
    expect((await host.next((message) => message["id"] === "state"))["doc"]).toMatchObject({
      exists: false,
    });
    expect((await host.next((message) => message["id"] === "roster"))["docs"]).toEqual([]);
    expect(
      ((await host.call({ t: MSG.GET, path: NOMINEE }))["doc"] as { exists: boolean }).exists,
    ).toBe(false);
    expect((await host.call({ t: MSG.ACQUIRE, path: STATE, holder: HOST }))["acquired"]).toBe(true);
  });

  it("starts new games with an unused epoch so archived rosters cannot be resurrected", async () => {
    const host = await hostOf("epoch-history");
    const state = await stateOf(host);
    const expectation = {
      epoch: state["epoch"],
      phase: state["phase"],
      nomineeIdx: state["nomineeIdx"],
      hostPid: state["hostPid"],
    };
    expect((await host.call({ t: MSG.DELETE, path: STATE, expect: expectation }))["ok"]).toBe(true);
    const initial = { ...state };
    delete initial["startedAt"];
    expect(
      (await host.call({ t: MSG.SET, path: STATE, data: initial, expect: { epoch: null } }))[
        "code"
      ],
    ).toBe(ERR.CONFLICT);
    expect(
      (
        await host.call({
          t: MSG.SET,
          path: STATE,
          data: { ...initial, epoch: "e2" },
          expect: { epoch: null },
        })
      )["ok"],
    ).toBe(true);
    expect((await host.call({ t: MSG.GET, path: "games/e2/players" }))["docs"]).toEqual([]);
  });
});
