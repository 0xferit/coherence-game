import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { ERR, MAX_BODY_BYTES, MSG } from "../../public/protocol.js";
import { openRoom, sleep } from "./helpers";

describe("Room store", () => {
  it("greets a connection with the server clock", async () => {
    const c = await openRoom("greet");
    const time = await c.next((m) => m["t"] === MSG.TIME);
    expect(Math.abs((time["now"] as number) - Date.now())).toBeLessThan(5000);
    c.close();
  });

  it("handles a reserved close-event status on a real socket without an invalid wire reply", async () => {
    const c = await openRoom("close-status");
    const stub = env.ROOM.get(env.ROOM.idFromName("close-status"));
    await expect(
      runInDurableObject(stub, (room, state) => {
        const socket = state.getWebSockets()[0];
        if (!socket) throw new Error("the room has no socket");
        room.webSocketClose(socket, 1005, "");
      }),
    ).resolves.toBeUndefined();
    c.close();
  });

  it("set writes a whole document and get reads it back", async () => {
    const c = await openRoom("setget");
    expect(
      (
        await c.call({ t: MSG.SET, path: "scratch/state", data: { phase: "lobby", nomineeIdx: 0 } })
      )["ok"],
    ).toBe(true);
    const res = await c.call({ t: MSG.GET, path: "scratch/state" });
    expect(res["doc"]).toEqual({
      id: "state",
      exists: true,
      data: { phase: "lobby", nomineeIdx: 0 },
    });
    const missing = await c.call({ t: MSG.GET, path: "scratch/none" });
    expect(missing["doc"]).toEqual({ id: "none", exists: false });
    c.close();
  });

  it("update merges into an existing document and refuses a missing one", async () => {
    const c = await openRoom("update");
    await c.call({ t: MSG.SET, path: "scratch/state", data: { a: { b: 1 }, list: [1] } });
    await c.call({ t: MSG.UPDATE, path: "scratch/state", data: { a: { c: 2 }, list: [2], d: 3 } });
    const res = await c.call({ t: MSG.GET, path: "scratch/state" });
    expect((res["doc"] as { data: unknown }).data).toEqual({ a: { b: 1, c: 2 }, list: [2], d: 3 });
    const refused = await c.call({ t: MSG.UPDATE, path: "scratch/none", data: { x: 1 } });
    expect(refused["ok"]).toBe(false);
    expect(refused["code"]).toBe(ERR.INVALID);
    c.close();
  });

  it("delete is idempotent and leaves documents nested under the path", async () => {
    const c = await openRoom("delete");
    await c.call({ t: MSG.SET, path: "drafts/e1", data: { epoch: "e1" } });
    await c.call({ t: MSG.SET, path: "drafts/e1/notes/n0", data: { openedAt: 1 } });
    expect((await c.call({ t: MSG.DELETE, path: "drafts/e1" }))["ok"]).toBe(true);
    expect((await c.call({ t: MSG.DELETE, path: "drafts/e1" }))["ok"]).toBe(true);
    expect(
      ((await c.call({ t: MSG.GET, path: "drafts/e1" }))["doc"] as { exists: boolean }).exists,
    ).toBe(false);
    expect(
      ((await c.call({ t: MSG.GET, path: "drafts/e1/notes/n0" }))["doc"] as { exists: boolean })
        .exists,
    ).toBe(true);
    c.close();
  });

  it("acquire is exclusive until the lease lapses, and its holder may renew it", async () => {
    const a = await openRoom("lease");
    const b = await openRoom("lease");
    const first = await a.call({ t: MSG.ACQUIRE, path: "scratch/state", holder: "A", ttlMs: 1000 });
    expect(first).toMatchObject({ ok: true, acquired: true, holder: "A" });
    const busy = await b.call({ t: MSG.ACQUIRE, path: "scratch/state", holder: "B", ttlMs: 1000 });
    expect(busy).toMatchObject({ ok: true, acquired: false });
    expect(typeof busy["expiresAt"]).toBe("string");
    expect(
      (await a.call({ t: MSG.ACQUIRE, path: "scratch/state", holder: "A", ttlMs: 1000 }))[
        "acquired"
      ],
    ).toBe(true);
    await sleep(1100);
    expect(
      (await b.call({ t: MSG.ACQUIRE, path: "scratch/state", holder: "B", ttlMs: 1000 }))[
        "acquired"
      ],
    ).toBe(true);
    a.close();
    b.close();
  });

  it("a document subscriber gets the current state, then every change from any connection", async () => {
    const a = await openRoom("docsub");
    const b = await openRoom("docsub");
    const initial = await a.sub("s1", "scratch/state", "doc");
    expect(initial["doc"]).toEqual({ id: "state", exists: false });
    await b.call({ t: MSG.SET, path: "scratch/state", data: { phase: "lobby" } });
    const changed = await a.next((m) => m["t"] === MSG.SNAP && m["id"] === "s1");
    expect((changed["doc"] as { data: unknown }).data).toEqual({ phase: "lobby" });
    await b.call({ t: MSG.DELETE, path: "scratch/state" });
    const gone = await a.next((m) => m["t"] === MSG.SNAP && m["id"] === "s1");
    expect((gone["doc"] as { exists: boolean }).exists).toBe(false);
    a.close();
    b.close();
  });

  it("a collection subscriber sees additions, changes and removals in id order", async () => {
    const c = await openRoom("colsub");
    expect((await c.sub("s1", "entrants", "col"))["docs"]).toEqual([]);
    await c.call({ t: MSG.SET, path: "entrants/p2", data: { name: "two" } });
    await c.next((m) => m["t"] === MSG.SNAP && m["id"] === "s1");
    await c.call({ t: MSG.SET, path: "entrants/p1", data: { name: "one" } });
    const both = await c.next((m) => m["t"] === MSG.SNAP && m["id"] === "s1");
    expect((both["docs"] as Array<{ id: string }>).map((d) => d.id)).toEqual(["p1", "p2"]);
    await c.call({ t: MSG.DELETE, path: "entrants/p1" });
    const one = await c.next((m) => m["t"] === MSG.SNAP && m["id"] === "s1");
    expect(one["docs"]).toEqual([{ id: "p2", data: { name: "two" } }]);
    c.close();
  });

  it("refuses the sixty-fifth subscription on a connection", async () => {
    const c = await openRoom("cap");
    for (let i = 0; i < 64; i++) await c.sub(`s${i}`, `col${i}`, "col");
    const refused = await c.sub("s64", "col64", "col");
    expect((refused["error"] as { code: string }).code).toBe(ERR.EXHAUSTED);
    c.close();
  });

  it("bounds subscription metadata within the hibernating socket attachment", async () => {
    const c = await openRoom("attachment-limit");
    let exhausted = false;
    for (let index = 0; index < 64; index++) {
      const snapshot = await c.sub(`${index}`.padEnd(1000, "x"), `col${index}`, "col");
      if (snapshot["error"]) {
        expect((snapshot["error"] as { code: string }).code).toBe(ERR.EXHAUSTED);
        exhausted = true;
        break;
      }
    }
    expect(exhausted).toBe(true);
    expect((await c.sub("short", "scratch", "col"))["docs"]).toEqual([]);
    c.close();
  });

  it("stamped fields take the server clock, whatever the client sent", async () => {
    const c = await openRoom("stamp");
    await c.call({
      t: MSG.SET,
      path: "entrants/p1",
      data: { name: "A", joinedAt: 1 },
      stamp: ["joinedAt"],
    });
    const res = await c.call({ t: MSG.GET, path: "entrants/p1" });
    const joinedAt = (res["doc"] as { data: { joinedAt: number } }).data.joinedAt;
    expect(Math.abs(joinedAt - Date.now())).toBeLessThan(5000);
    c.close();
  });

  it("refuses a body over the limit, a non-object body and a collection path on a write", async () => {
    const c = await openRoom("limits");
    const big = await c.call({
      t: MSG.SET,
      path: "scratch/state",
      data: { blob: "x".repeat(300 * 1024) },
    });
    expect(big["code"]).toBe(ERR.INVALID);
    expect((await c.call({ t: MSG.SET, path: "scratch/state", data: [1, 2] }))["code"]).toBe(
      ERR.INVALID,
    );
    expect((await c.call({ t: MSG.SET, path: "entrants", data: { x: 1 } }))["code"]).toBe(
      ERR.INVALID,
    );
    c.close();
  });

  it("answers a malformed message with an error and keeps the connection", async () => {
    const c = await openRoom("malformed");
    c.ws.send("not json");
    const err = await c.next((m) => m["t"] === MSG.RES && m["ok"] === false);
    expect(err["code"]).toBe(ERR.INVALID);
    expect(
      (await c.call({ t: MSG.SET, path: "scratch/state", data: { phase: "lobby" } }))["ok"],
    ).toBe(true);
    c.close();
  });

  it("rejects a mismatched subscription kind and oversized UTF-8 document", async () => {
    const c = await openRoom("utf8-limit");
    const snap = await c.sub("invalid", "scratch/state", "col");
    expect((snap["error"] as { code: string }).code).toBe(ERR.INVALID);
    const oversized = await c.call({
      t: MSG.SET,
      path: "scratch/state",
      data: { text: "界".repeat(90000) },
    });
    expect(oversized["code"]).toBe(ERR.INVALID);
    expect(
      ((await c.call({ t: MSG.GET, path: "scratch/state" }))["doc"] as { exists: boolean }).exists,
    ).toBe(false);
    c.close();
  });

  it("keeps collection snapshots within their byte budget and reports exhaustion", async () => {
    const c = await openRoom("snapshot-limit");
    const emptyDocumentBytes = JSON.stringify({ text: "" }).length;
    const first = await c.call({
      t: MSG.SET,
      path: "scratch/first",
      data: { text: "x".repeat(MAX_BODY_BYTES - emptyDocumentBytes) },
    });
    expect(first["ok"]).toBe(true);
    const full = await c.call({ t: MSG.SET, path: "scratch/second", data: {} });
    expect(full["code"]).toBe(ERR.EXHAUSTED);
    expect((await c.sub("still-live", "scratch", "col"))["docs"]).toHaveLength(1);
    c.close();
  });

  it("two writers racing on one document leave it whole, last writer winning", async () => {
    const a = await openRoom("race");
    const b = await openRoom("race");
    await Promise.all([
      a.call({ t: MSG.SET, path: "scratch/state", data: { phase: "commit", hostPid: "A" } }),
      b.call({ t: MSG.SET, path: "scratch/state", data: { phase: "reveal", hostPid: "B" } }),
    ]);
    const res = await a.call({ t: MSG.GET, path: "scratch/state" });
    const data = (res["doc"] as { data: { phase: string; hostPid: string } }).data;
    expect([
      { phase: "commit", hostPid: "A" },
      { phase: "reveal", hostPid: "B" },
    ]).toContainEqual(data);
    a.close();
    b.close();
  });

  it("rooms are isolated by code", async () => {
    const a = await openRoom("iso-a");
    const b = await openRoom("iso-b");
    await a.call({ t: MSG.SET, path: "scratch/state", data: { phase: "lobby" } });
    expect(
      ((await b.call({ t: MSG.GET, path: "scratch/state" }))["doc"] as { exists: boolean }).exists,
    ).toBe(false);
    a.close();
    b.close();
  });
});
