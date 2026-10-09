import { DurableObject } from "cloudflare:workers";
import {
  ERR,
  GAME_PHASE,
  LEASE_DEFAULT_MS,
  LEASE_MAX_MS,
  LEASE_MIN_MS,
  MAX_BODY_BYTES,
  MAX_NOMINEES,
  MAX_PATH_LENGTH,
  MAX_STAMPS,
  MAX_SUBSCRIPTIONS,
  MSG,
  OWNED_COLLECTIONS,
  parsePath,
  ROOM_PATH,
  SCORE_MAX,
  SCORE_MIN,
  SEAT_ID,
  sealText,
} from "../public/protocol.js";
import { deepMerge, isPlainObject } from "./merge";

type Body = Record<string, unknown>;
type SubKind = "doc" | "col";
type Subscription = { path: string; kind: SubKind };
type Attachment = { pid: string | null; subs: Record<string, Subscription> };
type ParsedDoc = Extract<ReturnType<typeof parsePath>, { kind: "doc" }>;
type DocRow = { id: string; body: string };
type LeaseRow = { holder: string; owner: string; expires_at: number };
type SeatRow = { secret_hash: string };
type Failure = Error & { code: string };
type DomainKind = "state" | "player" | "nominee" | "play" | "leak" | "generic";

const { STATE: STATE_PATH, GAMES, PLAYERS, NOMINEES, PLAYS, LEAKS } = ROOM_PATH;
const STATE_NAMESPACE = STATE_PATH.split("/")[0];
const STATE_FIELDS = new Set([
  "phase",
  "nomineeIdx",
  "hostPid",
  "epoch",
  "seed",
  "blocFraction",
  "openProofs",
  "docket",
  "startedAt",
  "gradedThrough",
]);
const IMMUTABLE_STATE_FIELDS = ["epoch", "docket", "seed", "blocFraction", "startedAt"];
const STATE_EXPECT_FIELDS = ["epoch", "phase", "nomineeIdx", "hostPid"];
const PLAYER_FIELDS = new Set(["pid", "name", "joinedAt"]);
const NOMINEE_FIELDS = new Set(["seated", "openedAt", "closedAt"]);
const PLAY_FIELDS = new Set([
  "pid",
  "hash",
  "past",
  "revealed",
  "recused",
  "score",
  "salt",
  "revealedAt",
]);
const REVEAL_FIELDS = new Set(["score", "salt", "revealed"]);
const NOMINEE_ID = new RegExp(`^${ROOM_PATH.NOMINEE_PREFIX}(0|[1-9][0-9]*)$`);
const HASH = /^[a-f0-9]{64}$/;
const MAX_SOCKET_CONNECTIONS = 128;
const MAX_SEATS = 512;
const MAX_DOCUMENTS = 4096;
const MAX_COLLECTION_DOCUMENTS = 512;
const MAX_ROOM_BYTES = MAX_BODY_BYTES * 16;
const MAX_COLLECTION_BYTES = MAX_BODY_BYTES;
const MAX_MESSAGE_BYTES = MAX_BODY_BYTES * 2;
const MAX_ID_LENGTH = MAX_PATH_LENGTH;
const MAX_ATTACHMENT_JSON_BYTES = 8192;
const MAX_JSON_DEPTH = 32;
const MAX_NAME_LENGTH = 80;
const MAX_SALT_LENGTH = 128;
const MAX_SEAL_HISTORY = 128;
const EPOCH_POSITION = 1;
const DOMAIN_COLLECTION_POSITION = 2;
const NOMINEE_POSITION = 3;
const NOMINEE_CHILD_POSITION = 4;
const TOP_DOMAIN_SEGMENTS = 4;
const EPOCH_SCOPE_SEGMENTS = 2;
const NOMINEE_CHILD_SEGMENTS = 6;
const NEXT_NOMINEE_OFFSET = 1;
const SHA256_HEX_RADIX = 16;
const HEX_BYTE_WIDTH = 2;
const SOCKET_ERROR_CODE = 1011;
const NORMAL_CLOSE_CODE = 1000;
const RESERVED_CLOSE_CODES = new Set([1004, 1005, 1006, 1015]);
const TIMESTAMP_SUCCESSOR = 1;
const SCHEMA = `
CREATE TABLE IF NOT EXISTS docs (
  path TEXT PRIMARY KEY,
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  body TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS docs_by_collection ON docs(collection, id);
CREATE TABLE IF NOT EXISTS leases (
  path TEXT PRIMARY KEY,
  holder TEXT NOT NULL,
  owner TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS seats (
  pid TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  first_seen INTEGER NOT NULL
);`;

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

function asFailure(error: unknown): Failure {
  if (error instanceof Error && "code" in error) return error as Failure;
  return Object.assign(new Error(error instanceof Error ? error.message : String(error)), {
    code: ERR.INVALID,
  });
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(SHA256_HEX_RADIX).padStart(HEX_BYTE_WIDTH, "0"),
  ).join("");
}

function documentPath(value: unknown): ParsedDoc {
  const parsed = parsePath(value);
  if (parsed.kind !== "doc") fail(ERR.INVALID, "this call needs a document path");
  return parsed;
}

function collectionName(collection: string): string {
  return collection.slice(collection.lastIndexOf("/") + 1);
}

function sameJson(a: unknown, b: unknown): boolean {
  const aMissing = a === null || a === undefined;
  const bMissing = b === null || b === undefined;
  if (aMissing && bMissing) return true;
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => sameJson(value, b[index]));
  }
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && sameJson(a[key], b[key]))
  );
}

function validJson(value: unknown, depth = 0): boolean {
  if (depth > MAX_JSON_DEPTH) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => validJson(item, depth + 1));
  return isPlainObject(value) && Object.values(value).every((item) => validJson(item, depth + 1));
}

function fieldsAllowed(body: Body, allowed: Set<string>): void {
  if (Object.keys(body).some((key) => !allowed.has(key)))
    fail(ERR.INVALID, "the document contains an unsupported field");
}

function scoreValid(score: unknown): score is number {
  return (
    typeof score === "number" && Number.isInteger(score) && score >= SCORE_MIN && score <= SCORE_MAX
  );
}

function playView(data: Body, ownerSees: boolean): Body {
  const view: Body = {
    ...data,
    sealed: typeof data["hash"] === "string",
    resealed: Array.isArray(data["past"]) && data["past"].length > 0,
  };
  if (!ownerSees) {
    delete view["hash"];
    delete view["past"];
    if (view["revealed"] !== true) {
      delete view["score"];
      delete view["salt"];
    }
  }
  return view;
}

function domainKind(parsed: ParsedDoc): DomainKind {
  if (parsed.path === STATE_PATH) return "state";
  const segments = parsed.segments;
  const collection = segments[DOMAIN_COLLECTION_POSITION];
  if (segments[0] === GAMES) {
    if (segments.length === TOP_DOMAIN_SEGMENTS && collection === PLAYERS) return "player";
    if (segments.length === TOP_DOMAIN_SEGMENTS && collection === NOMINEES) return "nominee";
    if (segments.length === NOMINEE_CHILD_SEGMENTS && collection === NOMINEES) {
      if (segments[NOMINEE_CHILD_POSITION] === PLAYS) return "play";
      if (segments[NOMINEE_CHILD_POSITION] === LEAKS) return "leak";
    }
    fail(ERR.INVALID, "unsupported game document path");
  }
  const name = collectionName(parsed.collection);
  if (
    OWNED_COLLECTIONS.some((collection) => collection === name) ||
    name === NOMINEES ||
    name === LEAKS ||
    segments[0] === STATE_NAMESPACE
  ) {
    fail(ERR.INVALID, "game documents must use their game namespace");
  }
  return "generic";
}

export class Room extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(SCHEMA);
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.method !== "GET")
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET" } });
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426 });
    }
    if (this.ctx.getWebSockets().length >= MAX_SOCKET_CONNECTIONS) {
      return new Response("The room has reached its connection limit", { status: 429 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ pid: null, subs: {} } satisfies Attachment);
    this.push(server, { t: MSG.TIME, now: Date.now() });
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    let message: Body;
    try {
      const bytes =
        typeof raw === "string" ? new TextEncoder().encode(raw).byteLength : raw.byteLength;
      if (bytes > MAX_MESSAGE_BYTES) fail(ERR.INVALID, "the message is too large");
      const parsed: unknown = JSON.parse(
        typeof raw === "string" ? raw : new TextDecoder().decode(raw),
      );
      if (!isPlainObject(parsed) || !validJson(parsed))
        fail(ERR.INVALID, "a message must be a bounded JSON object");
      message = parsed;
    } catch (error) {
      const failure = asFailure(error);
      this.reply(ws, null, { code: failure.code, message: failure.message });
      return;
    }
    const rid = typeof message["rid"] === "string" ? message["rid"] : null;
    try {
      switch (message["t"]) {
        case MSG.HELLO:
          this.reply(ws, rid, await this.hello(ws, message));
          return;
        case MSG.SUB:
          this.subscribe(ws, message);
          return;
        case MSG.UNSUB:
          this.unsubscribe(ws, message);
          return;
        case MSG.GET:
          this.reply(ws, rid, this.read(ws, message));
          return;
        case MSG.SET:
        case MSG.UPDATE:
          await this.write(ws, message, message["t"] === MSG.SET ? "set" : "update");
          this.reply(ws, rid, {});
          return;
        case MSG.DELETE:
          this.remove(ws, message);
          this.reply(ws, rid, {});
          return;
        case MSG.ACQUIRE:
          this.reply(ws, rid, this.acquire(ws, message));
          return;
        case MSG.REPORT:
          this.reply(ws, rid, await this.report(ws, message));
          return;
        case MSG.WIPE:
          this.wipe(ws);
          this.reply(ws, rid, {});
          return;
        default:
          fail(ERR.INVALID, "unknown message type");
      }
    } catch (error) {
      const failure = asFailure(error);
      this.reply(ws, rid, { code: failure.code, message: failure.message });
    }
  }

  override webSocketClose(ws: WebSocket, code: number, reason: string): void {
    ws.close(RESERVED_CLOSE_CODES.has(code) ? NORMAL_CLOSE_CODE : code, reason);
  }

  override webSocketError(ws: WebSocket): void {
    ws.close(SOCKET_ERROR_CODE, "socket error");
  }

  private reply(ws: WebSocket, rid: string | null, body: Body): void {
    this.push(ws, { t: MSG.RES, rid, ok: !("code" in body), ...body });
  }

  private push(ws: WebSocket, body: Body): void {
    try {
      ws.send(JSON.stringify(body));
    } catch {
      return;
    }
  }

  private attachmentOf(ws: WebSocket): Attachment {
    return (ws.deserializeAttachment() as Attachment | null) ?? { pid: null, subs: {} };
  }

  private async hello(ws: WebSocket, message: Body): Promise<Body> {
    const pid = message["pid"];
    const secret = message["secret"];
    if (typeof pid !== "string" || !SEAT_ID.test(pid)) fail(ERR.INVALID, "invalid seat id");
    if (typeof secret !== "string" || !SEAT_ID.test(secret))
      fail(ERR.INVALID, "invalid seat secret");
    const secretHash = await sha256Hex(secret);
    this.ctx.storage.transactionSync(() => {
      const attachment = this.attachmentOf(ws);
      if (attachment.pid !== null && attachment.pid !== pid)
        fail(ERR.DENIED, "a connection is already bound to another seat");
      const row = this.ctx.storage.sql
        .exec<SeatRow>("SELECT secret_hash FROM seats WHERE pid = ?", pid)
        .toArray()[0];
      if (row && row.secret_hash !== secretHash)
        fail(ERR.DENIED, "that seat belongs to another browser");
      if (!row) {
        const count = this.ctx.storage.sql
          .exec<{ n: number }>("SELECT COUNT(*) AS n FROM seats")
          .one().n;
        if (count >= MAX_SEATS) fail(ERR.EXHAUSTED, "the room has reached its seat limit");
        this.ctx.storage.sql.exec(
          "INSERT INTO seats (pid, secret_hash, first_seen) VALUES (?, ?, ?)",
          pid,
          secretHash,
          Date.now(),
        );
      }
      attachment.pid = pid;
      ws.serializeAttachment(attachment);
    });
    const attachment = this.attachmentOf(ws);
    for (const [id, subscription] of Object.entries(attachment.subs)) {
      this.push(ws, {
        t: MSG.SNAP,
        id,
        ...this.snapshotFor(pid, subscription.path, subscription.kind),
      });
    }
    return { pid };
  }

  private requireSeat(ws: WebSocket): string {
    const pid = this.attachmentOf(ws).pid;
    if (pid === null) fail(ERR.DENIED, "take a seat before writing");
    return pid;
  }

  private subscribe(ws: WebSocket, message: Body): void {
    const id = typeof message["id"] === "string" ? message["id"] : "";
    try {
      if (id === "" || id.length > MAX_ID_LENGTH)
        fail(ERR.INVALID, "a subscription needs a bounded id");
      const parsed = parsePath(message["path"]);
      const kind: SubKind = parsed.kind === "doc" ? "doc" : "col";
      if (message["kind"] !== kind)
        fail(ERR.INVALID, "the subscription kind does not match its path");
      const attachment = this.attachmentOf(ws);
      if (
        !Object.hasOwn(attachment.subs, id) &&
        Object.keys(attachment.subs).length >= MAX_SUBSCRIPTIONS
      ) {
        fail(ERR.EXHAUSTED, `at most ${MAX_SUBSCRIPTIONS} live subscriptions per connection`);
      }
      Object.defineProperty(attachment.subs, id, {
        value: { path: parsed.path, kind },
        configurable: true,
        enumerable: true,
        writable: true,
      });
      if (
        new TextEncoder().encode(JSON.stringify(attachment)).byteLength > MAX_ATTACHMENT_JSON_BYTES
      ) {
        fail(ERR.EXHAUSTED, "the connection has reached its subscription metadata limit");
      }
      ws.serializeAttachment(attachment);
      this.push(ws, { t: MSG.SNAP, id, ...this.snapshotFor(attachment.pid, parsed.path, kind) });
    } catch (error) {
      const failure = asFailure(error);
      this.push(ws, { t: MSG.SNAP, id, error: { code: failure.code, message: failure.message } });
    }
  }

  private unsubscribe(ws: WebSocket, message: Body): void {
    const id = typeof message["id"] === "string" ? message["id"] : "";
    const attachment = this.attachmentOf(ws);
    delete attachment.subs[id];
    ws.serializeAttachment(attachment);
  }

  private read(ws: WebSocket, message: Body): Body {
    const parsed = parsePath(message["path"]);
    return this.snapshotFor(
      this.attachmentOf(ws).pid,
      parsed.path,
      parsed.kind === "doc" ? "doc" : "col",
    );
  }

  private snapshotFor(viewer: string | null, path: string, kind: SubKind): Body {
    if (kind === "doc") {
      const parsed = documentPath(path);
      const data = this.stored(path);
      if (!data) return { doc: { id: parsed.id, exists: false } };
      const view =
        collectionName(parsed.collection) === PLAYS ? playView(data, viewer === parsed.id) : data;
      return { doc: { id: parsed.id, exists: true, data: view } };
    }
    return {
      docs: this.listed(path).map((row) => ({
        id: row.id,
        data: collectionName(path) === PLAYS ? playView(row.data, viewer === row.id) : row.data,
      })),
    };
  }

  private stored(path: string): Body | undefined {
    const row = this.ctx.storage.sql
      .exec<DocRow>("SELECT id, body FROM docs WHERE path = ?", path)
      .toArray()[0];
    return row ? (JSON.parse(row.body) as Body) : undefined;
  }

  private listed(collection: string): Array<{ id: string; data: Body }> {
    return this.ctx.storage.sql
      .exec<DocRow>("SELECT id, body FROM docs WHERE collection = ? ORDER BY id", collection)
      .toArray()
      .map((row) => ({ id: row.id, data: JSON.parse(row.body) as Body }));
  }

  private checkExpect(existing: Body | undefined, expectation: unknown): void {
    if (expectation === undefined) return;
    if (!isPlainObject(expectation)) fail(ERR.INVALID, "expect must be an object of field values");
    for (const [field, value] of Object.entries(expectation)) {
      const current = existing && Object.hasOwn(existing, field) ? existing[field] : undefined;
      if (!sameJson(current, value)) fail(ERR.CONFLICT, `the document's ${field} has changed`);
    }
  }

  private stamps(message: Body): string[] {
    const fields = message["stamp"];
    if (fields === undefined) return [];
    if (
      !Array.isArray(fields) ||
      fields.length > MAX_STAMPS ||
      fields.some(
        (field) =>
          typeof field !== "string" ||
          field.length === 0 ||
          field.length > MAX_ID_LENGTH ||
          field === "__proto__",
      )
    ) {
      fail(ERR.INVALID, `stamp must list at most ${MAX_STAMPS} valid field names`);
    }
    return fields as string[];
  }

  private requireStateExpect(message: Body): void {
    const expectation = message["expect"];
    if (
      !isPlainObject(expectation) ||
      STATE_EXPECT_FIELDS.some((field) => !Object.hasOwn(expectation, field))
    ) {
      fail(
        ERR.INVALID,
        "a game transition needs its epoch, phase, nominee index and host in expect",
      );
    }
  }

  private stateFor(parsed: ParsedDoc): Body {
    const state = this.stored(STATE_PATH);
    if (!state) fail(ERR.INVALID, "no jury has been summoned");
    if (parsed.segments[EPOCH_POSITION] !== state["epoch"])
      fail(ERR.CONFLICT, "the game epoch has changed");
    return state;
  }

  private nomineeIndex(parsed: ParsedDoc, state: Body): number {
    const id = parsed.segments[NOMINEE_POSITION];
    if (typeof id !== "string" || !NOMINEE_ID.test(id)) fail(ERR.INVALID, "invalid nominee id");
    const index = Number(id.slice(ROOM_PATH.NOMINEE_PREFIX.length));
    const docket = state["docket"] as unknown[];
    if (!Number.isSafeInteger(index) || index < 0 || index >= docket.length)
      fail(ERR.INVALID, "the nominee is outside the docket");
    return index;
  }

  private assertStateShape(body: Body): void {
    fieldsAllowed(body, STATE_FIELDS);
    const phase = body["phase"];
    const docket = body["docket"];
    const index = body["nomineeIdx"];
    const epoch = body["epoch"];
    if (typeof phase !== "string" || !Object.values(GAME_PHASE).some((value) => value === phase))
      fail(ERR.INVALID, "invalid game phase");
    if (
      typeof epoch !== "string" ||
      documentPath(`${GAMES}/${epoch}`).segments.length !== EPOCH_SCOPE_SEGMENTS
    )
      fail(ERR.INVALID, "invalid game epoch");
    if (typeof body["hostPid"] !== "string" || !SEAT_ID.test(body["hostPid"]))
      fail(ERR.INVALID, "invalid host seat");
    if (
      !Array.isArray(docket) ||
      docket.length === 0 ||
      docket.length > MAX_NOMINEES ||
      docket.some(
        (nominee) =>
          !isPlainObject(nominee) ||
          typeof nominee["key"] !== "string" ||
          nominee["key"] === "" ||
          typeof nominee["name"] !== "string" ||
          nominee["name"].trim() === "" ||
          typeof nominee["blurb"] !== "string",
      )
    ) {
      fail(ERR.INVALID, "the game needs a bounded docket of named nominees");
    }
    if (
      typeof index !== "number" ||
      !Number.isSafeInteger(index) ||
      index < 0 ||
      index >= docket.length
    )
      fail(ERR.INVALID, "invalid nominee index");
    if (typeof body["seed"] !== "string" || body["seed"].length === 0)
      fail(ERR.INVALID, "the game needs a bloc seed");
    if (
      typeof body["blocFraction"] !== "number" ||
      body["blocFraction"] < 0 ||
      body["blocFraction"] > 1
    )
      fail(ERR.INVALID, "invalid bloc fraction");
    if (typeof body["openProofs"] !== "boolean") fail(ERR.INVALID, "invalid proof visibility");
  }

  private stateBody(
    pid: string,
    existing: Body | undefined,
    body: Body,
    message: Body,
    stamps: string[],
    now: number,
  ): Body {
    this.assertStateShape(body);
    if (!existing) {
      if (
        body["hostPid"] !== pid ||
        body["phase"] !== GAME_PHASE.LOBBY ||
        body["nomineeIdx"] !== 0 ||
        "gradedThrough" in body ||
        "startedAt" in body
      ) {
        fail(ERR.INVALID, "a new jury starts in the lobby with its summoner as host");
      }
      if (
        !isPlainObject(message["expect"]) ||
        !Object.hasOwn(message["expect"], "epoch") ||
        message["expect"]["epoch"] !== null
      ) {
        fail(ERR.INVALID, "summoning must expect an empty room");
      }
      const lease = this.ctx.storage.sql
        .exec<LeaseRow>("SELECT holder, owner, expires_at FROM leases WHERE path = ?", STATE_PATH)
        .toArray()[0];
      if (!lease || lease.owner !== pid || lease.holder !== pid || lease.expires_at <= now)
        fail(ERR.CONFLICT, "acquire the summon lease before creating the jury");
      if (stamps.some((field) => field !== "startedAt"))
        fail(ERR.INVALID, "only the game start time may be stamped here");
      const epochPrefix = `${GAMES}/${body["epoch"]}/`;
      if (
        this.ctx.storage.sql
          .exec(
            "SELECT path FROM docs WHERE SUBSTR(path, 1, ?) = ? LIMIT 1",
            epochPrefix.length,
            epochPrefix,
          )
          .toArray().length > 0
      ) {
        fail(ERR.CONFLICT, "a new jury needs an unused epoch");
      }
      return { ...body, startedAt: now };
    }
    this.requireStateExpect(message);
    if (stamps.length > 0) fail(ERR.INVALID, "the game start time is immutable");
    for (const field of IMMUTABLE_STATE_FIELDS) {
      if (!sameJson(existing[field], body[field]))
        fail(ERR.INVALID, `the game's ${field} is frozen`);
    }
    const nextHost = body["hostPid"];
    const hostChanged = nextHost !== existing["hostPid"];
    if (hostChanged && nextHost !== pid)
      fail(ERR.DENIED, "a juror can take hosting only for their own seat");
    const currentPhase = existing["phase"];
    const nextPhase = body["phase"];
    const currentIndex = existing["nomineeIdx"] as number;
    const nextIndex = body["nomineeIdx"] as number;
    const phaseChanged = nextPhase !== currentPhase || nextIndex !== currentIndex;
    if (hostChanged && (phaseChanged || body["openProofs"] !== existing["openProofs"]))
      fail(ERR.INVALID, "taking over changes only the host");
    if (phaseChanged && nextPhase !== GAME_PHASE.ENDED && pid !== existing["hostPid"])
      fail(ERR.DENIED, "only the host advances the game");
    if (body["openProofs"] !== existing["openProofs"] && pid !== existing["hostPid"])
      fail(ERR.DENIED, "only the host changes proof visibility");
    const metadata = this.stored(
      `${GAMES}/${existing["epoch"]}/${NOMINEES}/${ROOM_PATH.NOMINEE_PREFIX}${currentIndex}`,
    );
    let validTransition = !phaseChanged;
    if (nextIndex === currentIndex) {
      if (currentPhase === GAME_PHASE.LOBBY && nextPhase === GAME_PHASE.COMMIT)
        validTransition = typeof metadata?.["openedAt"] === "number" && !metadata["closedAt"];
      if (currentPhase === GAME_PHASE.COMMIT && nextPhase === GAME_PHASE.REVEAL)
        validTransition = !metadata?.["closedAt"];
      if (currentPhase === GAME_PHASE.REVEAL && nextPhase === GAME_PHASE.GRADED)
        validTransition = typeof metadata?.["closedAt"] === "number";
      if (nextPhase === GAME_PHASE.ENDED) validTransition = true;
    }
    if (
      currentPhase === GAME_PHASE.GRADED &&
      nextPhase === GAME_PHASE.LOBBY &&
      nextIndex === currentIndex + NEXT_NOMINEE_OFFSET
    )
      validTransition = true;
    if (!validTransition || (currentPhase === GAME_PHASE.ENDED && phaseChanged))
      fail(ERR.INVALID, "invalid game transition");
    if (nextPhase === GAME_PHASE.ENDED) {
      const through =
        currentPhase === GAME_PHASE.ENDED
          ? existing["gradedThrough"]
          : currentIndex + (metadata?.["closedAt"] ? NEXT_NOMINEE_OFFSET : 0);
      if (body["gradedThrough"] !== through)
        fail(ERR.INVALID, "the ending must preserve exactly the graded nominees");
    } else if ("gradedThrough" in body) {
      fail(ERR.INVALID, "gradedThrough is set only when the game ends");
    }
    return body;
  }

  private playerBody(
    pid: string,
    parsed: ParsedDoc,
    existing: Body | undefined,
    body: Body,
    stamps: string[],
    now: number,
  ): Body {
    if (pid !== parsed.id) fail(ERR.DENIED, "only a seat's owner writes it");
    fieldsAllowed(body, PLAYER_FIELDS);
    this.stateFor(parsed);
    if (body["pid"] !== parsed.id) fail(ERR.INVALID, "the body pid must match its document id");
    if (
      typeof body["name"] !== "string" ||
      body["name"].trim() === "" ||
      body["name"].length > MAX_NAME_LENGTH
    )
      fail(ERR.INVALID, "a seat needs a short name");
    if (stamps.some((field) => field !== "joinedAt"))
      fail(ERR.INVALID, "only joinedAt may be stamped on a seat");
    return { ...body, joinedAt: existing?.["joinedAt"] ?? now };
  }

  private nomineeBody(
    pid: string,
    parsed: ParsedDoc,
    existing: Body | undefined,
    body: Body,
    stamps: string[],
    now: number,
  ): Body {
    const state = this.stateFor(parsed);
    const index = this.nomineeIndex(parsed, state);
    if (pid !== state["hostPid"]) fail(ERR.DENIED, "only the host opens and grades a nominee");
    if (index !== state["nomineeIdx"]) fail(ERR.CONFLICT, "the game moved to another nominee");
    fieldsAllowed(body, NOMINEE_FIELDS);
    if (existing?.["closedAt"] !== undefined) fail(ERR.INVALID, "the graded nominee is frozen");
    if (stamps.length !== 1)
      fail(ERR.INVALID, "a nominee write stamps its opening or grading time");
    if (stamps[0] === "openedAt") {
      if (
        state["phase"] !== GAME_PHASE.LOBBY ||
        existing?.["openedAt"] !== undefined ||
        "openedAt" in body ||
        "closedAt" in body
      )
        fail(ERR.INVALID, "only an unopened lobby nominee can be opened");
      const seated = this.listed(`${GAMES}/${state["epoch"]}/${PLAYERS}`).map(
        (player) => player.id,
      );
      if ("seated" in body && !sameJson(body["seated"], seated))
        fail(ERR.INVALID, "the seated list comes from the room roster");
      return { seated, openedAt: now };
    }
    if (
      stamps[0] !== "closedAt" ||
      state["phase"] !== GAME_PHASE.REVEAL ||
      !existing?.["openedAt"] ||
      "closedAt" in body
    )
      fail(ERR.INVALID, "only a nominee in reveal can be graded");
    if (
      !sameJson(existing["openedAt"], body["openedAt"]) ||
      !sameJson(existing["seated"], body["seated"])
    )
      fail(ERR.INVALID, "the opening time and seated list are frozen");
    return { ...existing, closedAt: now };
  }

  private playBody(
    pid: string,
    parsed: ParsedDoc,
    existing: Body | undefined,
    body: Body,
    patch: Body,
    stamps: string[],
    proofHash: string | undefined,
    now: number,
  ): Body {
    if (pid !== parsed.id) fail(ERR.DENIED, "only a juror's owner writes their play");
    const state = this.stateFor(parsed);
    const index = this.nomineeIndex(parsed, state);
    const nomineePath = parsed.segments.slice(0, TOP_DOMAIN_SEGMENTS).join("/");
    const metadata = this.stored(nomineePath);
    if (!metadata?.["openedAt"]) fail(ERR.INVALID, "the nominee has not opened");
    const seated = metadata["seated"] as unknown[];
    if (!seated.includes(pid))
      fail(ERR.DENIED, "this juror was not seated when the nominee opened");
    fieldsAllowed(body, PLAY_FIELDS);
    if (stamps.length > 0 || "revealedAt" in patch)
      fail(ERR.INVALID, "the room stamps a reveal itself");
    if (body["pid"] !== parsed.id) fail(ERR.INVALID, "the body pid must match its document id");
    if (existing?.["revealed"] === true) {
      if (!Object.entries(patch).every(([field, value]) => sameJson(existing[field], value))) {
        fail(ERR.INVALID, "the first reveal is immutable");
      }
      return existing;
    }
    if (body["revealed"] === true) {
      const currentReveal = index === state["nomineeIdx"] && state["phase"] === GAME_PHASE.REVEAL;
      if (!currentReveal && typeof metadata["closedAt"] !== "number")
        fail(ERR.INVALID, "reveals open after scoring closes");
      if (
        Object.entries(patch).some(
          ([field, value]) => !REVEAL_FIELDS.has(field) && !sameJson(existing?.[field], value),
        )
      )
        fail(ERR.INVALID, "a reveal changes only the score and salt");
      if (
        !scoreValid(body["score"]) ||
        typeof body["salt"] !== "string" ||
        body["salt"].length === 0 ||
        body["salt"].length > MAX_SALT_LENGTH
      )
        fail(ERR.INVALID, "a reveal needs an integer score and short salt");
      if (
        existing?.["recused"] === true ||
        typeof existing?.["hash"] !== "string" ||
        proofHash !== existing["hash"]
      )
        fail(ERR.INVALID, "the reveal does not match the sealed score");
      const revealedAt =
        typeof metadata["closedAt"] === "number"
          ? Math.max(now, metadata["closedAt"] + TIMESTAMP_SUCCESSOR)
          : now;
      return { ...existing, score: body["score"], salt: body["salt"], revealed: true, revealedAt };
    }
    if (
      index !== state["nomineeIdx"] ||
      state["phase"] !== GAME_PHASE.COMMIT ||
      metadata["closedAt"] !== undefined
    )
      fail(ERR.INVALID, "seals and recusals are accepted only while scoring is open");
    if (body["revealed"] !== false || "score" in body || "salt" in body || "revealedAt" in body)
      fail(ERR.INVALID, "an unopened play cannot carry a score or salt");
    if (body["recused"] !== undefined && typeof body["recused"] !== "boolean")
      fail(ERR.INVALID, "recused must be a boolean");
    if (
      body["hash"] !== undefined &&
      (typeof body["hash"] !== "string" || !HASH.test(body["hash"]))
    )
      fail(ERR.INVALID, "a seal is a SHA-256 hash");
    if (body["recused"] === true && body["hash"] !== undefined)
      fail(ERR.INVALID, "a recused juror has no current seal");
    const history = Array.isArray(existing?.["past"]) ? [...existing["past"]] : [];
    if (
      typeof existing?.["hash"] === "string" &&
      existing["hash"] !== body["hash"] &&
      !history.includes(existing["hash"])
    )
      history.push(existing["hash"]);
    if (history.length > MAX_SEAL_HISTORY)
      fail(ERR.EXHAUSTED, "this play has reached its reseal limit");
    return { ...body, past: history };
  }

  private persist(parsed: ParsedDoc, body: Body, now: number): void {
    const text = JSON.stringify(body);
    const bytes = new TextEncoder().encode(text).byteLength;
    if (bytes > MAX_BODY_BYTES)
      fail(ERR.INVALID, `a document may be at most ${MAX_BODY_BYTES} bytes`);
    const existing = this.stored(parsed.path);
    if (!existing) {
      const count = this.ctx.storage.sql
        .exec<{ n: number }>("SELECT COUNT(*) AS n FROM docs")
        .one().n;
      const collectionCount = this.ctx.storage.sql
        .exec<{ n: number }>(
          "SELECT COUNT(*) AS n FROM docs WHERE collection = ?",
          parsed.collection,
        )
        .one().n;
      if (count >= MAX_DOCUMENTS || collectionCount >= MAX_COLLECTION_DOCUMENTS)
        fail(ERR.EXHAUSTED, "the room has reached its document limit");
    }
    const storedBytes = this.ctx.storage.sql
      .exec<{ n: number }>(
        "SELECT COALESCE(SUM(LENGTH(CAST(body AS BLOB))), 0) AS n FROM docs WHERE path != ?",
        parsed.path,
      )
      .one().n;
    if (storedBytes + bytes > MAX_ROOM_BYTES)
      fail(ERR.EXHAUSTED, "the room has reached its storage limit");
    const collectionBytes = this.ctx.storage.sql
      .exec<{ n: number }>(
        "SELECT COALESCE(SUM(LENGTH(CAST(body AS BLOB))), 0) AS n FROM docs WHERE collection = ? AND path != ?",
        parsed.collection,
        parsed.path,
      )
      .one().n;
    if (collectionBytes + bytes > MAX_COLLECTION_BYTES)
      fail(ERR.EXHAUSTED, "the collection has reached its subscription snapshot limit");
    this.ctx.storage.sql.exec(
      `INSERT INTO docs (path, collection, id, body, version, updated_at) VALUES (?, ?, ?, ?, 1, ?)
       ON CONFLICT(path) DO UPDATE SET body = excluded.body, version = docs.version + 1, updated_at = excluded.updated_at`,
      parsed.path,
      parsed.collection,
      parsed.id,
      text,
      now,
    );
  }

  private async write(ws: WebSocket, message: Body, mode: "set" | "update"): Promise<void> {
    const parsed = documentPath(message["path"]);
    const patch = message["data"];
    if (!isPlainObject(patch) || !validJson(patch))
      fail(ERR.INVALID, "a document body must be a bounded JSON object");
    const pid = this.requireSeat(ws);
    const kind = domainKind(parsed);
    const stamps = this.stamps(message);
    const proofHash =
      patch["revealed"] === true && scoreValid(patch["score"]) && typeof patch["salt"] === "string"
        ? await sha256Hex(sealText(patch["score"], patch["salt"]))
        : undefined;
    this.ctx.storage.transactionSync(() => {
      const existing = this.stored(parsed.path);
      this.checkExpect(existing, message["expect"]);
      if (mode === "update" && !existing) fail(ERR.INVALID, "update needs an existing document");
      const now = Date.now();
      let body = mode === "update" ? deepMerge(existing as Body, patch) : { ...patch };
      switch (kind) {
        case "state":
          body = this.stateBody(pid, existing, body, message, stamps, now);
          break;
        case "player":
          body = this.playerBody(pid, parsed, existing, body, stamps, now);
          break;
        case "nominee":
          body = this.nomineeBody(pid, parsed, existing, body, stamps, now);
          break;
        case "play":
          body = this.playBody(pid, parsed, existing, body, patch, stamps, proofHash, now);
          break;
        case "leak":
          return fail(ERR.DENIED, "a leak is recorded only through report");
        case "generic":
          for (const field of stamps) body[field] = now;
          break;
      }
      this.persist(parsed, body, now);
    });
    this.broadcast(parsed.path, parsed.collection);
  }

  private remove(ws: WebSocket, message: Body): void {
    const parsed = documentPath(message["path"]);
    const pid = this.requireSeat(ws);
    const kind = domainKind(parsed);
    const changed = this.ctx.storage.transactionSync(() => {
      const existing = this.stored(parsed.path);
      this.checkExpect(existing, message["expect"]);
      if (kind === "state") {
        this.requireStateExpect(message);
      } else if (kind === "player") {
        const state = this.stateFor(parsed);
        if (pid !== parsed.id && pid !== state["hostPid"])
          fail(ERR.DENIED, "only the owner or host removes a seat");
      } else if (kind === "play") {
        const state = this.stateFor(parsed);
        const index = this.nomineeIndex(parsed, state);
        if (pid !== parsed.id) fail(ERR.DENIED, "only a play's owner writes it");
        if (index !== state["nomineeIdx"] || state["phase"] !== GAME_PHASE.COMMIT)
          fail(ERR.INVALID, "only an ungraded play can be removed while scoring");
        if (existing) fail(ERR.INVALID, "use recusal to preserve seal history");
      } else if (kind !== "generic") {
        fail(ERR.DENIED, "nominee metadata and reports cannot be deleted");
      }
      return (
        this.ctx.storage.sql.exec("DELETE FROM docs WHERE path = ?", parsed.path).rowsWritten > 0
      );
    });
    if (changed) this.broadcast(parsed.path, parsed.collection);
  }

  private acquire(ws: WebSocket, message: Body): Body {
    const pid = this.requireSeat(ws);
    const parsed = documentPath(message["path"]);
    const holder = message["holder"];
    if (typeof holder !== "string" || holder.length === 0 || holder.length > MAX_ID_LENGTH)
      fail(ERR.INVALID, "acquire needs a bounded holder");
    if (parsed.path === STATE_PATH && holder !== pid)
      fail(ERR.DENIED, "the summon lease belongs to the bound seat");
    const requested = message["ttlMs"] ?? LEASE_DEFAULT_MS;
    if (typeof requested !== "number" || !Number.isFinite(requested) || requested <= 0)
      fail(ERR.INVALID, "a lease duration must be positive");
    const ttl = Math.min(LEASE_MAX_MS, Math.max(LEASE_MIN_MS, requested));
    return this.ctx.storage.transactionSync(() => {
      const now = Date.now();
      this.ctx.storage.sql.exec("DELETE FROM leases WHERE expires_at <= ?", now);
      const current = this.ctx.storage.sql
        .exec<LeaseRow>("SELECT holder, owner, expires_at FROM leases WHERE path = ?", parsed.path)
        .toArray()[0];
      if (current && (current.holder !== holder || current.owner !== pid))
        return { acquired: false, expiresAt: new Date(current.expires_at).toISOString() };
      const count = this.ctx.storage.sql
        .exec<{ n: number }>("SELECT COUNT(*) AS n FROM leases")
        .one().n;
      if (!current && count >= MAX_DOCUMENTS)
        fail(ERR.EXHAUSTED, "the room has reached its lease limit");
      const expiresAt = now + ttl;
      this.ctx.storage.sql.exec(
        `INSERT INTO leases (path, holder, owner, expires_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET holder = excluded.holder, owner = excluded.owner, expires_at = excluded.expires_at`,
        parsed.path,
        holder,
        pid,
        expiresAt,
      );
      return { acquired: true, holder, expiresAt: new Date(expiresAt).toISOString() };
    });
  }

  private async report(ws: WebSocket, message: Body): Promise<Body> {
    const reporter = this.requireSeat(ws);
    const nominee = documentPath(message["nominee"]);
    if (domainKind(nominee) !== "nominee") fail(ERR.INVALID, "a report names a nominee document");
    const proof = message["proof"];
    if (
      !isPlainObject(proof) ||
      !scoreValid(proof["score"]) ||
      typeof proof["salt"] !== "string" ||
      proof["salt"].length === 0 ||
      proof["salt"].length > MAX_SALT_LENGTH
    )
      fail(ERR.INVALID, "a proof needs an integer score and short salt");
    const hash = await sha256Hex(sealText(proof["score"], proof["salt"]));
    let changedPath: ParsedDoc | undefined;
    const result = this.ctx.storage.transactionSync(() => {
      const state = this.stateFor(nominee);
      const index = this.nomineeIndex(nominee, state);
      const metadata = this.stored(nominee.path);
      if (
        state["phase"] !== GAME_PHASE.COMMIT ||
        index !== state["nomineeIdx"] ||
        !metadata?.["openedAt"] ||
        metadata["closedAt"] !== undefined
      )
        fail(ERR.INVALID, "reports are accepted only while scoring is open");
      if (!this.stored(`${GAMES}/${state["epoch"]}/${PLAYERS}/${reporter}`))
        fail(ERR.DENIED, "join the jury before reporting a proof");
      const seated = metadata["seated"] as string[];
      if (!seated.includes(reporter))
        fail(ERR.DENIED, "this juror was not seated when the nominee opened");
      const matching = this.listed(`${nominee.path}/${PLAYS}`).filter(
        (play) =>
          play.data["hash"] === hash ||
          (Array.isArray(play.data["past"]) && play.data["past"].includes(hash)),
      );
      if (matching.some((play) => play.id === reporter))
        fail(ERR.INVALID, "that is your own proof");
      const leaker = matching[0];
      if (!leaker) fail(ERR.INVALID, "no sealed score matches that proof");
      const leakPath = documentPath(`${nominee.path}/${LEAKS}/${leaker.id}`);
      if (this.stored(leakPath.path)) return { leakerPid: leaker.id, duplicate: true };
      const now = Date.now();
      this.persist(leakPath, { leakerPid: leaker.id, reporterPid: reporter, at: now }, now);
      changedPath = leakPath;
      return { leakerPid: leaker.id, duplicate: false };
    });
    if (changedPath) this.broadcast(changedPath.path, changedPath.collection);
    return result;
  }

  private wipe(ws: WebSocket): void {
    this.requireSeat(ws);
    this.ctx.storage.transactionSync(() =>
      this.ctx.storage.sql.exec("DELETE FROM docs; DELETE FROM leases;"),
    );
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = this.attachmentOf(socket);
      for (const [id, subscription] of Object.entries(attachment.subs)) {
        this.push(socket, {
          t: MSG.SNAP,
          id,
          ...this.snapshotFor(attachment.pid, subscription.path, subscription.kind),
        });
      }
    }
  }

  private broadcast(path: string, collection: string): void {
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = this.attachmentOf(socket);
      for (const [id, subscription] of Object.entries(attachment.subs)) {
        if (
          (subscription.kind === "doc" && subscription.path === path) ||
          (subscription.kind === "col" && subscription.path === collection)
        ) {
          this.push(socket, {
            t: MSG.SNAP,
            id,
            ...this.snapshotFor(attachment.pid, subscription.path, subscription.kind),
          });
        }
      }
    }
  }
}
