import { ERR, LEASE_DEFAULT_MS, MSG, parsePath } from "./protocol.js";

const RETRY_MIN_MS = 500;
const RETRY_MAX_MS = 8000;
const REQUEST_TIMEOUT_MS = 15000;
const META = Object.freeze({ fromCache: false, hasPendingWrites: false });

function failure(code, message) {
  return Object.assign(new Error(message), { code });
}

function randomId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function docSnapshot(doc) {
  return {
    id: doc.id,
    exists: doc.exists,
    data: () => (doc.exists ? doc.data : undefined),
    metadata: META,
  };
}

function collectionSnapshot(docs) {
  const list = docs.map((d) => ({ id: d.id, exists: true, data: () => d.data, metadata: META }));
  return { docs: list, size: list.length, empty: list.length === 0, metadata: META };
}

/** Connect to a Room. Reconnect authenticates the same seat before replaying
 * requests or subscriptions. Requests reject with the Room's code or unavailable.
 * close() rejects outstanding requests and prevents another connection. */
export function connect(url) {
  const WebSocketImpl = WebSocket;
  const timeoutMs = REQUEST_TIMEOUT_MS;
  const pending = new Map();
  const subscriptions = new Map();
  const statusListeners = new Set();
  let socket = null;
  let status = "connecting";
  let attempt = 0;
  let offset = 0;
  let closed = false;
  let seq = 0;
  let identity = null;
  let authenticated = false;
  let reconnectTimer = null;
  let authRid = null;

  function nextId(prefix) {
    seq += 1;
    return prefix + seq;
  }

  function setStatus(next) {
    if (status === next) return;
    status = next;
    for (const fn of statusListeners) fn(next);
  }

  function isOpen() {
    return socket !== null && socket.readyState === WebSocketImpl.OPEN;
  }

  function transmit(msg) {
    if (!isOpen()) return false;
    socket.send(JSON.stringify(msg));
    return true;
  }

  function ready() {
    return isOpen() && (!identity || authenticated) && !closed;
  }

  function flush() {
    if (!ready()) return;
    attempt = 0;
    setStatus("open");
    for (const [id, sub] of subscriptions)
      transmit({ t: MSG.SUB, id, path: sub.path, kind: sub.kind });
    for (const entry of pending.values()) {
      if (!entry.sent && entry.msg.t !== MSG.HELLO) entry.sent = transmit(entry.msg);
    }
  }

  function rejectPending(error) {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    pending.clear();
  }

  function authenticate() {
    if (!identity || !isOpen() || authRid) return;
    const existing = Array.from(pending.values()).find((entry) => entry.msg.t === MSG.HELLO);
    const entry =
      existing ??
      makeRequest(
        { t: MSG.HELLO, ...identity },
        () => {},
        () => {},
      );
    authRid = entry.msg.rid;
    entry.sent = transmit(entry.msg);
  }

  function open() {
    if (closed) return;
    const active = new WebSocketImpl(url);
    socket = active;
    active.addEventListener("open", () => {
      if (socket !== active || closed) return;
      authenticated = false;
      if (identity) authenticate();
      else flush();
    });
    active.addEventListener("message", (event) => {
      if (socket !== active || closed) return;
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      receive(message);
    });
    active.addEventListener("close", () => {
      if (socket !== active) return;
      socket = null;
      authenticated = false;
      authRid = null;
      if (closed) return;
      setStatus("reconnecting");
      for (const entry of pending.values()) entry.sent = false;
      const wait = Math.min(RETRY_MAX_MS, RETRY_MIN_MS * 2 ** attempt);
      attempt += 1;
      reconnectTimer = setTimeout(open, wait);
    });
  }

  function receive(msg) {
    if (msg.t === MSG.TIME) {
      offset = msg.now - Date.now();
      return;
    }
    if (msg.t === MSG.RES) {
      const entry = pending.get(msg.rid);
      if (!entry) return;
      pending.delete(msg.rid);
      clearTimeout(entry.timer);
      if (msg.rid === authRid) {
        authRid = null;
        authenticated = !!msg.ok;
        if (msg.ok) flush();
        else
          rejectPending(
            failure(msg.code ?? ERR.UNAVAILABLE, msg.message ?? "the room refused this seat"),
          );
      }
      if (msg.ok) entry.resolve(msg);
      else
        entry.reject(
          failure(msg.code ?? ERR.UNAVAILABLE, msg.message ?? "the room refused the request"),
        );
      return;
    }
    if (msg.t === MSG.SNAP) {
      const sub = subscriptions.get(msg.id);
      if (!sub) return;
      if (msg.error) {
        subscriptions.delete(msg.id);
        if (sub.error) sub.error(failure(msg.error.code, msg.error.message));
        return;
      }
      sub.next(msg.doc ? docSnapshot(msg.doc) : collectionSnapshot(msg.docs));
    }
  }

  function makeRequest(msg, resolve, reject) {
    const rid = nextId("r");
    const body = { ...msg, rid };
    const timer = setTimeout(() => {
      pending.delete(rid);
      const error = failure(ERR.UNAVAILABLE, "no answer from the room");
      if (authRid === rid) {
        authRid = null;
        rejectPending(error);
      }
      reject(error);
    }, timeoutMs);
    const entry = { msg: body, resolve, reject, timer, sent: false };
    pending.set(rid, entry);
    return entry;
  }

  function request(msg) {
    if (closed) return Promise.reject(failure(ERR.UNAVAILABLE, "the connection is closed"));
    return new Promise((resolve, reject) => {
      const entry = makeRequest(msg, resolve, reject);
      if (msg.t === MSG.HELLO) authenticate();
      else if (ready()) entry.sent = transmit(entry.msg);
    });
  }

  function subscribe(path, kind, next, error) {
    const id = nextId("s");
    subscriptions.set(id, { path, kind, next, error });
    if (ready()) transmit({ t: MSG.SUB, id, path, kind });
    return () => {
      subscriptions.delete(id);
      transmit({ t: MSG.UNSUB, id });
    };
  }

  function writeOptions(opts) {
    const out = {};
    if (opts && opts.stamp) out.stamp = opts.stamp;
    if (opts && opts.expect) out.expect = opts.expect;
    return out;
  }

  function docRef(path) {
    const parsed = parsePath(path);
    if (parsed.kind !== "doc")
      throw new TypeError(path + " is a collection path, not a document path");
    return {
      id: parsed.id,
      path,
      get: () => request({ t: MSG.GET, path }).then((res) => docSnapshot(res.doc)),
      set: (data, opts) =>
        request({ t: MSG.SET, path, data, ...writeOptions(opts) }).then(() => undefined),
      update: (data, opts) =>
        request({ t: MSG.UPDATE, path, data, ...writeOptions(opts) }).then(() => undefined),
      delete: (opts) =>
        request({ t: MSG.DELETE, path, ...writeOptions(opts) }).then(() => undefined),
      acquire: ({ holder, ttlMs = LEASE_DEFAULT_MS }) =>
        request({ t: MSG.ACQUIRE, path, holder, ttlMs }).then((res) => ({
          acquired: res.acquired,
          expiresAt: res.expiresAt,
          holder: res.acquired ? holder : undefined,
        })),
      onSnapshot: (next, error) => subscribe(path, "doc", next, error),
      collection: (name) => collectionRef(path + "/" + name),
    };
  }

  function collectionRef(path) {
    const parsed = parsePath(path);
    if (parsed.kind !== "collection")
      throw new TypeError(path + " is a document path, not a collection path");
    return {
      path,
      doc: (id) => docRef(path + "/" + (id ?? randomId())),
      get: () => request({ t: MSG.GET, path }).then((res) => collectionSnapshot(res.docs)),
      onSnapshot: (next, error) => subscribe(path, "col", next, error),
    };
  }

  open();

  return {
    doc: docRef,
    collection: collectionRef,
    hello: (pid, secret) => {
      if (identity && (identity.pid !== pid || identity.secret !== secret)) {
        return Promise.reject(
          failure(ERR.INVALID, "this connection already belongs to another seat"),
        );
      }
      identity = { pid, secret };
      authenticated = false;
      if (status === "open") setStatus("connecting");
      return request({ t: MSG.HELLO, pid, secret });
    },
    report: (nominee, proof) => request({ t: MSG.REPORT, nominee, proof }),
    wipe: () => request({ t: MSG.WIPE }).then(() => undefined),
    now: () => Date.now() + offset,
    status: () => status,
    onStatus: (fn) => {
      statusListeners.add(fn);
      return () => statusListeners.delete(fn);
    },
    close: () => {
      closed = true;
      clearTimeout(reconnectTimer);
      setStatus("reconnecting");
      rejectPending(failure(ERR.UNAVAILABLE, "the connection is closed"));
      if (socket) socket.close();
    },
  };
}
