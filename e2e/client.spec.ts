import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { type BrowserContext, test, type WebSocketRoute } from "@playwright/test";
import { ERR, GAME_PHASE, MSG, ROOM_PATH, sealText } from "../public/protocol.js";

const ORIGIN = "http://localhost:8787";
const ROOT = new URL("../", import.meta.url);

type Document = Record<string, unknown>;
type Connection = { socket: WebSocketRoute; pid?: string; subscriptions: Map<string, string> };

type RoomOptions = {
  phase?: string;
  host?: boolean;
  closedAt?: number;
  lateJoin?: boolean;
  players?: Document[];
};

async function isolatedRoom(context: BrowserContext, options: RoomOptions = {}) {
  const connections: Connection[] = [];
  const identities: string[] = [];
  let phase = options.phase ?? GAME_PHASE.COMMIT;
  let play: Document | undefined;
  let firstSeal: { socket: WebSocketRoute; rid: unknown } | undefined;
  let seals = 0;
  let refuseNextSeal = false;
  let dropNextSealReply = false;
  let stateWrite: Document | undefined;
  let gradedThrough = 0;
  const openedAt = Date.now();
  let pid = "";
  const epoch = "e-client";
  const roster = () => options.players ?? [{ pid, name: "<svg onload=alert(1)>", joinedAt: 0 }];
  const seated = () => (options.lateJoin ? ["p-earlier"] : roster().map((player) => player.pid));
  const state = () => ({
    epoch,
    phase,
    nomineeIdx: 0,
    hostPid: options.host ? pid : "p-host",
    seed: "seed",
    blocFraction: 0,
    gradedThrough,
    docket: [{ key: "custom", name: "<img src=x onerror=alert(1)>", blurb: "A nominee", note: "" }],
  });
  const meta = () => ({
    openedAt,
    seated: seated(),
    ...(options.closedAt === undefined ? {} : { closedAt: options.closedAt }),
  });

  function snapshot(connection: Connection, id: string, path: string) {
    if (path === ROOM_PATH.STATE)
      connection.socket.send(
        JSON.stringify({ t: MSG.SNAP, id, doc: { id: "state", exists: true, data: state() } }),
      );
    else {
      let docs: Array<{ id: string; data: Document }> = [];
      if (path.endsWith(`/${ROOM_PATH.PLAYERS}`))
        docs = roster().map((player) => ({ id: String(player.pid), data: player }));
      if (path.endsWith(`/${ROOM_PATH.NOMINEES}`))
        docs = [{ id: `${ROOM_PATH.NOMINEE_PREFIX}0`, data: meta() }];
      if (path.endsWith(`/${ROOM_PATH.PLAYS}`) && play)
        docs = [
          {
            id: pid,
            data: {
              ...play,
              sealed: !!play.hash,
              resealed: !!(play.past as unknown[] | undefined)?.length,
            },
          },
        ];
      connection.socket.send(JSON.stringify({ t: MSG.SNAP, id, docs }));
    }
  }

  function broadcast() {
    for (const connection of connections)
      for (const [id, path] of connection.subscriptions) snapshot(connection, id, path);
  }

  await context.route(`${ORIGIN}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const relative = pathname.startsWith("/r/") ? "public/r/index.html" : `public${pathname}`;
    const contentType = relative.endsWith(".html") ? "text/html" : "text/javascript";
    await route.fulfill({ body: await readFile(new URL(relative, ROOT)), contentType });
  });
  await context.routeWebSocket(`${ORIGIN.replace("http", "ws")}/r/regression/ws`, (socket) => {
    const connection: Connection = { socket, subscriptions: new Map() };
    connections.push(connection);
    socket.send(JSON.stringify({ t: MSG.TIME, now: Date.now() }));
    socket.onMessage((raw) => {
      const message = JSON.parse(String(raw));
      const answer = (data: Document = {}) =>
        socket.send(JSON.stringify({ t: MSG.RES, rid: message.rid, ok: true, ...data }));
      const refuse = (code: string, text: string) =>
        socket.send(
          JSON.stringify({ t: MSG.RES, rid: message.rid, ok: false, code, message: text }),
        );
      if (message.t === MSG.HELLO) {
        connection.pid = message.pid;
        pid = message.pid;
        identities.push(pid);
        answer({ pid });
        return;
      }
      if (message.t === MSG.SUB) {
        connection.subscriptions.set(message.id, message.path);
        snapshot(connection, message.id, message.path);
        return;
      }
      if (message.t === MSG.UNSUB) {
        connection.subscriptions.delete(message.id);
        return;
      }
      if (message.t === MSG.SET && message.path.endsWith(`/${ROOM_PATH.PLAYS}/${pid}`)) {
        if (refuseNextSeal) {
          refuseNextSeal = false;
          refuse(ERR.CONFLICT, "the game moved on");
          return;
        }
        if (!seated().includes(pid)) {
          refuse(ERR.DENIED, "this juror was not seated when the nominee opened");
          return;
        }
        for (const [field, expected] of Object.entries(message.expect ?? {})) {
          const current = play?.[field];
          if (!(current == null && expected == null) && !Object.is(current, expected)) {
            refuse(ERR.CONFLICT, `the document's ${field} has changed`);
            return;
          }
        }
        play = message.data;
        seals += 1;
        if (dropNextSealReply) {
          dropNextSealReply = false;
          return;
        }
        broadcast();
        if (seals === 1) firstSeal = { socket, rid: message.rid };
        else answer();
        return;
      }
      if (message.t === MSG.UPDATE && message.path.endsWith(`/${ROOM_PATH.PLAYS}/${pid}`)) {
        const expected = createHash("sha256")
          .update(sealText(message.data.score, message.data.salt))
          .digest("hex");
        if (expected !== play?.hash) {
          socket.send(
            JSON.stringify({
              t: MSG.RES,
              rid: message.rid,
              ok: false,
              code: "invalid_argument",
              message: "the reveal does not match the seal",
            }),
          );
          return;
        }
        play = { ...play, ...message.data, revealedAt: Date.now() };
        broadcast();
        answer();
        return;
      }
      if (message.t === MSG.UPDATE && message.path === ROOM_PATH.STATE) {
        stateWrite = message.data;
        const through = options.closedAt === undefined ? 0 : 1;
        if (message.data.phase === GAME_PHASE.ENDED && message.data.gradedThrough !== through) {
          refuse(ERR.INVALID, "the ended cutoff must match graded nominees");
          return;
        }
        phase = message.data.phase;
        gradedThrough = through;
        broadcast();
        answer();
        return;
      }
      answer();
    });
  });
  return {
    phase: (next: string, notify = true) => {
      phase = next;
      if (notify) broadcast();
    },
    acknowledgeFirst: () => {
      const acceptedSeal = firstSeal;
      if (!acceptedSeal) throw new Error("the room has not accepted a first seal");
      acceptedSeal.socket.send(JSON.stringify({ t: MSG.RES, rid: acceptedSeal.rid, ok: true }));
    },
    play: () => play,
    seals: () => seals,
    refuseNextSeal: () => {
      refuseNextSeal = true;
    },
    dropNextSealReply: () => {
      dropNextSealReply = true;
    },
    identities: () => identities,
    stateWrite: () => stateWrite,
  };
}

test("concurrent tabs reveal the final seal even when older acknowledgement arrives last", async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const room = await isolatedRoom(context);
    const first = await context.newPage();
    const second = await context.newPage();
    await first.goto(`${ORIGIN}/r/regression`);
    await first.locator("#rng").waitFor();
    await second.goto(`${ORIGIN}/r/regression`);
    await second.locator("#rng").waitFor();
    assert.equal(await first.locator("#app img, #app svg").count(), 0);
    await first.locator("#rng").fill("35");
    await first.locator("#seal").click();
    await second.locator("#chg").waitFor();
    await second.locator("#chg").click();
    await second.locator("#rng").fill("71");
    await second.locator("#seal").click();
    await second.waitForFunction(() =>
      Object.keys(localStorage).some(
        (key) => key.startsWith("cg_") && localStorage.getItem(key)?.includes("71:"),
      ),
    );
    room.acknowledgeFirst();
    await first.waitForFunction(() =>
      Object.keys(localStorage).some(
        (key) => key.startsWith("cg_") && localStorage.getItem(key)?.includes("35:"),
      ),
    );
    assert.equal(room.seals(), 2);
    room.phase("reveal");
    await first.locator("#app").getByText("Everyone has revealed.").waitFor();
    assert.equal(room.play()?.score, 71);
    assert.equal(room.play()?.revealed, true);
  } finally {
    await context.close();
  }
});

test("a refused replacement shows failure and preserves the confirmed seal", async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const room = await isolatedRoom(context);
    const page = await context.newPage();
    await page.goto(`${ORIGIN}/r/regression`);
    await page.locator("#rng").waitFor();
    await page.locator("#rng").fill("35");
    await page.locator("#seal").click();
    await page.locator("#chg").waitFor();
    room.acknowledgeFirst();
    await page.waitForFunction(() =>
      Object.keys(localStorage).some(
        (key) => key.startsWith("cg_") && localStorage.getItem(key)?.includes("35:"),
      ),
    );
    room.refuseNextSeal();
    await page.locator("#chg").click();
    await page.locator("#rng").fill("71");
    await page.locator("#seal").click();
    await page.locator(".net-banner").waitFor();
    assert.match((await page.locator(".net-banner").textContent()) || "", /game moved on/);
    room.phase("reveal");
    await page.locator("#app").getByText("Everyone has revealed.").waitFor();
    assert.equal(room.play()?.score, 35);
    assert.equal(room.play()?.revealed, true);
  } finally {
    await context.close();
  }
});

test("seal, replacement, recusal and return preserve false in conditional writes", async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const room = await isolatedRoom(context);
    const page = await context.newPage();
    await page.goto(`${ORIGIN}/r/regression`);
    await page.locator("#rng").fill("35");
    await page.locator("#seal").click();
    await page.locator("#chg").waitFor();
    room.acknowledgeFirst();
    await page.locator("#chg").click();
    await page.locator("#rng").fill("71");
    await page.locator("#seal").click();
    await page.locator("#chg").waitFor();
    assert.equal(room.seals(), 2);
    await page.locator("#rec").click();
    await page.locator("#unrec").waitFor();
    assert.equal(room.play()?.recused, true);
    assert.equal(await page.locator("#rep, #repBtn").count(), 2);
    await page.locator("#unrec").click();
    await page.locator("#rng").waitFor();
    assert.equal(room.play()?.recused, undefined);
    await page.locator("#seal").click();
    await page.locator("#chg").waitFor();
    assert.equal(room.seals(), 5);
    assert.equal(room.play()?.revealed, false);
  } finally {
    await context.close();
  }
});

test("an accepted seal survives lost reply and snapshot, timeout, reload and reveal", async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const room = await isolatedRoom(context);
    const page = await context.newPage();
    await page.clock.install();
    await page.goto(`${ORIGIN}/r/regression`);
    await page.locator("#rng").fill("49");
    room.dropNextSealReply();
    await page.locator("#seal").click();
    await page.waitForFunction(() =>
      Object.keys(localStorage).some(
        (key) => key.startsWith("cg_seal_") && localStorage.getItem(key)?.startsWith("49:"),
      ),
    );
    assert.equal(room.seals(), 1);
    await page.clock.runFor(15_001);
    await page.locator(".net-banner").waitFor();
    room.phase("reveal", false);
    await page.reload();
    await page.locator("#app").getByText("Everyone has revealed.").waitFor();
    assert.equal(room.play()?.score, 49);
    assert.equal(room.play()?.revealed, true);
  } finally {
    await context.close();
  }
});

test("storage refusal prevents transmitting a seal whose proof cannot survive reload", async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const room = await isolatedRoom(context);
    const page = await context.newPage();
    await page.goto(`${ORIGIN}/r/regression`);
    await page.locator("#rng").waitFor();
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key.startsWith("cg_seal_"))
          throw new DOMException("storage full", "QuotaExceededError");
        return original.call(this, key, value);
      };
    });
    await page.locator("#seal").click();
    await page.locator(".net-banner").waitFor();
    assert.match(
      (await page.locator(".net-banner").textContent()) || "",
      /could not save|cannot save/i,
    );
    assert.equal(room.seals(), 0);
    assert.equal(room.play(), undefined);
    assert.equal(await page.locator("#rng").count(), 1);
  } finally {
    await context.close();
  }
});

test("restoring a persisted page reauthenticates the same seat and reveals its seal", async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const room = await isolatedRoom(context);
    const page = await context.newPage();
    await page.goto(`${ORIGIN}/r/regression`);
    await page.locator("#rng").fill("62");
    await page.locator("#seal").click();
    await page.locator("#chg").waitFor();
    room.acknowledgeFirst();
    const originalPid = room.identities()[0];
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })),
    );
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
    );
    await page.locator("#chg").waitFor();
    assert.equal(room.identities().length, 2);
    assert.equal(room.identities()[1], originalPid);
    room.phase("reveal");
    await page.locator("#app").getByText("Everyone has revealed.").waitFor();
    assert.equal(room.play()?.score, 62);
  } finally {
    await context.close();
  }
});

test("tied standings use the same name and seat order in Swedish and English browsers", async ({
  browser,
}) => {
  const roster = [
    { pid: "p-z", name: "Alice", joinedAt: 0 },
    { pid: "p-a", name: "Alice", joinedAt: 0 },
    { pid: "p-aa", name: "Zoë", joinedAt: 0 },
    { pid: "p-ab", name: "Åsa", joinedAt: 0 },
  ];
  for (const locale of ["sv-SE", "en-GB"]) {
    const context = await browser.newContext({ locale });
    try {
      await context.addInitScript(() => localStorage.setItem("cg_pid", "p-z"));
      await isolatedRoom(context, { phase: GAME_PHASE.ENDED, players: roster });
      const page = await context.newPage();
      await page.goto(`${ORIGIN}/r/regression`);
      await page.locator(".board .seat").first().waitFor();
      assert.deepEqual(await page.locator(".board .who").allTextContents(), [
        "Alice",
        "Alice",
        "Zoë",
        "Åsa",
      ]);
      assert.equal(await page.locator(".board .seat").nth(1).getAttribute("class"), "seat me");
    } finally {
      await context.close();
    }
  }
});

test("ending an interrupted grade includes its authoritative closed nominee", async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const room = await isolatedRoom(context, { phase: "reveal", host: true, closedAt: Date.now() });
    const page = await context.newPage();
    await page.goto(`${ORIGIN}/r/regression`);
    await page.locator("#bEnd").click();
    await page.locator("#cEnd").click();
    await page.locator(".board").waitFor();
    assert.deepEqual(room.stateWrite(), { phase: GAME_PHASE.ENDED, gradedThrough: 1 });
    assert.match(
      (await page.locator("#app h3").first().textContent()) || "",
      /1 of 1 nominees scored/,
    );
  } finally {
    await context.close();
  }
});

test("a late joiner waits for the next nominee without seal, recusal or report controls", async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const room = await isolatedRoom(context, { lateJoin: true });
    const page = await context.newPage();
    await page.goto(`${ORIGIN}/r/regression`);
    await page.locator("#app").getByText("You joined after this nominee opened").waitFor();
    assert.equal(await page.locator("#seal, #rec, #unrec, #rng").count(), 0);
    assert.equal(await page.locator("#rep, #repBtn").count(), 0);
    assert.match((await page.locator("#app").textContent()) || "", /next nominee/i);
    assert.equal(room.seals(), 0);
    room.phase(GAME_PHASE.REVEAL);
    await page.locator("#app h1").getByText("Opening").waitFor();
    assert.equal(await page.locator("#rep, #repBtn").count(), 0);
  } finally {
    await context.close();
  }
});
