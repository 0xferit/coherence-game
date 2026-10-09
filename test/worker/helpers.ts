import { exports } from "cloudflare:workers";
import { afterEach, expect } from "vitest";
import { MSG } from "../../public/protocol.js";

export type Msg = Record<string, unknown>;
type Waiter = { pred: (m: Msg) => boolean; resolve: (m: Msg) => void };
export type RoomClient = {
  ws: WebSocket;
  call(msg: Msg): Promise<Msg>;
  sub(id: string, path: string, kind: "doc" | "col"): Promise<Msg>;
  next(pred: (m: Msg) => boolean, timeoutMs?: number): Promise<Msg>;
  send(msg: Msg): void;
  close(): void;
};
export type OpenOptions = { pid?: string; secret?: string; anonymous?: boolean };
const MESSAGE_TIMEOUT_MS = 3000;
const sockets = new Set<WebSocket>();
let seatCounter = 0;

afterEach(() => {
  for (const socket of sockets) socket.close();
  sockets.clear();
});

export async function openRoom(code: string, options: OpenOptions = {}): Promise<RoomClient> {
  const response = await exports.default.fetch(`https://example.com/r/${code}/ws`, {
    headers: { Upgrade: "websocket" },
  });
  expect(response.status).toBe(101);
  const ws = response.webSocket;
  if (!ws) throw new Error("the upgrade response carried no socket");
  ws.accept();
  sockets.add(ws);
  const inbox: Msg[] = [];
  const waiters: Waiter[] = [];
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data as string) as Msg;
    const index = waiters.findIndex((waiter) => waiter.pred(msg));
    if (index >= 0) waiters.splice(index, 1)[0]?.resolve(msg);
    else inbox.push(msg);
  });
  function next(pred: (m: Msg) => boolean, timeoutMs = MESSAGE_TIMEOUT_MS): Promise<Msg> {
    const index = inbox.findIndex(pred);
    if (index >= 0) return Promise.resolve(inbox.splice(index, 1)[0] as Msg);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const waiting = waiters.indexOf(waiter);
        if (waiting >= 0) waiters.splice(waiting, 1);
        reject(new Error("timed out waiting for a message"));
      }, timeoutMs);
      const waiter: Waiter = {
        pred,
        resolve: (message) => {
          clearTimeout(timer);
          resolve(message);
        },
      };
      waiters.push(waiter);
    });
  }
  let seq = 0;
  const send = (msg: Msg): void => ws.send(JSON.stringify(msg));
  function call(msg: Msg): Promise<Msg> {
    const rid = `r${++seq}`;
    send({ ...msg, rid });
    return next((message) => message["t"] === MSG.RES && message["rid"] === rid);
  }
  function sub(id: string, path: string, kind: "doc" | "col"): Promise<Msg> {
    send({ t: MSG.SUB, id, path, kind });
    return next((message) => message["t"] === MSG.SNAP && message["id"] === id);
  }
  const client: RoomClient = { ws, call, sub, next, send, close: () => ws.close() };
  if (!options.anonymous) {
    seatCounter += 1;
    const pid = options.pid ?? `p-test-${seatCounter}`;
    const secret = options.secret ?? `secret-${pid}`;
    const res = await call({ t: MSG.HELLO, pid, secret });
    if (!res["ok"]) throw new Error(`hello refused: ${String(res["message"])}`);
  }
  return client;
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
