import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ERR, MSG } from "../../public/protocol.js";
import { connect } from "../../public/store.js";

type Listener = (event: { data?: string }) => void;
type Store = ReturnType<typeof connect>;
type DocSnapshot = Awaited<ReturnType<ReturnType<Store["doc"]>["get"]>>;
type CollectionSnapshot = Awaited<ReturnType<ReturnType<Store["collection"]>["get"]>>;

class FakeSocket {
  static instances: FakeSocket[] = [];
  static OPEN = 1;
  readyState = 0;
  sent: Array<Record<string, unknown>> = [];
  private listeners: Record<string, Listener[]> = {};
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  addEventListener(type: string, fn: Listener): void {
    const listeners = this.listeners[type] ?? [];
    this.listeners[type] = listeners;
    listeners.push(fn);
  }
  send(text: string): void {
    this.sent.push(JSON.parse(text));
  }
  close(): void {
    this.drop();
  }
  open(): void {
    this.readyState = FakeSocket.OPEN;
    this.emit("open", {});
  }
  receive(msg: Record<string, unknown>): void {
    this.emit("message", { data: JSON.stringify(msg) });
  }
  drop(): void {
    this.readyState = 3;
    this.emit("close", {});
  }
  private emit(type: string, event: { data?: string }): void {
    for (const fn of this.listeners[type] ?? []) fn(event);
  }
}

function latest(): FakeSocket {
  const socket = FakeSocket.instances.at(-1);
  if (!socket) throw new Error("no socket yet");
  return socket;
}

function answer(
  socket: FakeSocket,
  match: (m: Record<string, unknown>) => boolean,
  reply: Record<string, unknown>,
): void {
  const req = socket.sent.find(match);
  if (!req) throw new Error("the page never sent the expected request");
  socket.receive({ t: MSG.RES, rid: req["rid"], ok: true, ...reply });
}

describe("store client", () => {
  beforeEach(() => {
    vi.stubGlobal("WebSocket", FakeSocket);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it("authenticates a replacement socket before subscriptions and queued writes", async () => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    const store = connect("ws://room");
    const first = latest();
    first.open();
    const hello = store.hello("p-ada", "secret-1");
    answer(first, (m) => m["t"] === MSG.HELLO, { pid: "p-ada" });
    await hello;
    store.collection("games/e1/nominees/n0/plays").onSnapshot(() => {});
    first.drop();
    const write = store.doc("games/e1/nominees/n0/plays/p-ada").set({ hash: "abc" });
    await vi.advanceTimersByTimeAsync(600);
    const second = latest();
    second.open();
    expect(store.status()).toBe("reconnecting");
    expect(second.sent.map((m) => m["t"])).toEqual([MSG.HELLO]);
    answer(second, (m) => m["t"] === MSG.HELLO, { pid: "p-ada" });
    expect(second.sent.map((m) => m["t"])).toEqual([MSG.HELLO, MSG.SUB, MSG.SET]);
    expect(store.status()).toBe("open");
    answer(second, (m) => m["t"] === MSG.SET, {});
    await write;
    store.close();
  });

  it("refreshes an anonymous subscription after first authenticating its owner", async () => {
    FakeSocket.instances = [];
    const store = connect("ws://room");
    const socket = latest();
    socket.open();
    store.collection("games/e1/nominees/n0/plays").onSnapshot(() => {});
    const hello = store.hello("p-ada", "secret-1");
    answer(socket, (m) => m["t"] === MSG.HELLO, { pid: "p-ada" });
    await hello;
    expect(socket.sent.filter((m) => m["t"] === MSG.SUB)).toHaveLength(2);
    store.close();
  });

  it("rejects queued writes if reconnect authentication is refused", async () => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    const store = connect("ws://room");
    const first = latest();
    first.open();
    const hello = store.hello("p-ada", "secret-1");
    answer(first, (m) => m["t"] === MSG.HELLO, { pid: "p-ada" });
    await hello;
    first.drop();
    const write = store.doc("game/state").update({ phase: "reveal" });
    const rejected = expect(write).rejects.toMatchObject({ code: ERR.INVALID });
    await vi.advanceTimersByTimeAsync(600);
    const second = latest();
    second.open();
    answer(second, (m) => m["t"] === MSG.HELLO, {
      ok: false,
      code: ERR.INVALID,
      message: "seat refused",
    });
    await rejected;
    expect(second.sent.filter((m) => m["t"] === MSG.UPDATE)).toHaveLength(0);
    expect(store.status()).toBe("reconnecting");
    store.close();
  });

  it("rejects pending requests and cancels reconnect after closing", async () => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    const store = connect("ws://room");
    latest().open();
    const request = store.doc("game/state").get();
    const rejected = expect(request).rejects.toMatchObject({ code: ERR.UNAVAILABLE });
    store.close();
    await rejected;
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(store.status()).not.toBe("open");
  });
  it("delivers document and collection snapshots in the contract's shape", async () => {
    FakeSocket.instances = [];
    const store = connect("ws://room");
    latest().open();
    const seen: unknown[] = [];
    store
      .doc("game/state")
      .onSnapshot((snap: DocSnapshot) => seen.push([snap.id, snap.exists, snap.data()]));
    store
      .collection("players")
      .onSnapshot((snap: CollectionSnapshot) =>
        seen.push([snap.size, snap.empty, snap.docs.map((d: DocSnapshot) => [d.id, d.data()])]),
      );
    const [docSub, colSub] = latest().sent.filter((m) => m["t"] === MSG.SUB);
    latest().receive({
      t: MSG.SNAP,
      id: docSub?.["id"],
      doc: { id: "state", exists: true, data: { phase: "lobby" } },
    });
    latest().receive({
      t: MSG.SNAP,
      id: colSub?.["id"],
      docs: [{ id: "p1", data: { name: "Ada" } }],
    });
    expect(seen).toEqual([
      ["state", true, { phase: "lobby" }],
      [1, false, [["p1", { name: "Ada" }]]],
    ]);
  });

  it("answers requests by id, carries stamp and expect, and rejects with the server's code", async () => {
    FakeSocket.instances = [];
    const store = connect("ws://room");
    latest().open();
    const pending = store
      .doc("games/e1/players/p1")
      .set({ name: "Ada" }, { stamp: ["joinedAt"], expect: { name: null } });
    const sent = latest().sent.find((m) => m["t"] === MSG.SET);
    expect(sent).toMatchObject({
      path: "games/e1/players/p1",
      data: { name: "Ada" },
      stamp: ["joinedAt"],
      expect: { name: null },
    });
    latest().receive({ t: MSG.RES, rid: sent?.["rid"], ok: true });
    await expect(pending).resolves.toBeUndefined();
    const refused = store
      .doc("game/state")
      .update({ phase: "reveal" }, { expect: { phase: "commit" } });
    answer(latest(), (m) => m["t"] === MSG.UPDATE, {
      ok: false,
      code: ERR.CONFLICT,
      message: "changed",
    });
    await expect(refused).rejects.toMatchObject({ code: ERR.CONFLICT });
  });

  it("re-subscribes after a reconnect and flushes a write that waited for the socket", async () => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    const store = connect("ws://room");
    const first = latest();
    first.open();
    const states: string[] = [];
    store.onStatus((s: string) => states.push(s));
    store.doc("game/state").onSnapshot(() => {});
    first.drop();
    const pending = store.doc("game/state").set({ phase: "lobby" });
    expect(FakeSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(600);
    const second = latest();
    expect(second).not.toBe(first);
    second.open();
    expect(second.sent.map((m) => m["t"])).toEqual([MSG.SUB, MSG.SET]);
    answer(second, (m) => m["t"] === MSG.SET, {});
    await expect(pending).resolves.toBeUndefined();
    expect(states).toEqual(["reconnecting", "open"]);
    vi.useRealTimers();
  });

  it("times out a request the room never answers and aligns now() to the server clock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    FakeSocket.instances = [];
    const store = connect("ws://room");
    latest().open();
    latest().receive({ t: MSG.TIME, now: 1_005_000 });
    expect(store.now()).toBe(1_005_000);
    const pending = store.doc("game/state").get();
    const rejected = expect(pending).rejects.toMatchObject({ code: ERR.UNAVAILABLE });
    await vi.advanceTimersByTimeAsync(15_001);
    await rejected;
    vi.useRealTimers();
  });

  it("sends hello, report and wipe with their fields", async () => {
    FakeSocket.instances = [];
    const store = connect("ws://room");
    latest().open();
    const hello = store.hello("p-ada", "secret-1");
    answer(latest(), (m) => m["t"] === MSG.HELLO, { pid: "p-ada" });
    await expect(hello).resolves.toMatchObject({ pid: "p-ada" });
    const report = store.report("games/e1/nominees/n0", { score: 62, salt: "apple banana" });
    const sent = latest().sent.find((m) => m["t"] === MSG.REPORT);
    expect(sent).toMatchObject({
      nominee: "games/e1/nominees/n0",
      proof: { score: 62, salt: "apple banana" },
    });
    answer(latest(), (m) => m["t"] === MSG.REPORT, { leakerPid: "p-bob", duplicate: false });
    await expect(report).resolves.toMatchObject({ leakerPid: "p-bob" });
    const wipe = store.wipe();
    answer(latest(), (m) => m["t"] === MSG.WIPE, {});
    await expect(wipe).resolves.toBeUndefined();
  });
});
