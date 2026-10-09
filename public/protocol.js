export const MSG = Object.freeze({
  HELLO: "hello",
  SUB: "sub",
  UNSUB: "unsub",
  GET: "get",
  SET: "set",
  UPDATE: "update",
  DELETE: "delete",
  ACQUIRE: "acquire",
  REPORT: "report",
  WIPE: "wipe",
  RES: "res",
  SNAP: "snap",
  TIME: "time",
});

export const ERR = Object.freeze({
  INVALID: "invalid_argument",
  EXHAUSTED: "resource_exhausted",
  UNAVAILABLE: "unavailable",
  DENIED: "permission_denied",
  CONFLICT: "conflict",
});

export const MAX_SUBSCRIPTIONS = 64;
export const MAX_BODY_BYTES = 262144;
export const MAX_SEGMENTS = 16;
export const MAX_SEGMENT_LENGTH = 200;
export const MAX_PATH_LENGTH = 1000;
export const MAX_STAMPS = 8;
export const LEASE_DEFAULT_MS = 30000;
export const LEASE_MIN_MS = 1000;
export const LEASE_MAX_MS = 600000;
export const SEAT_ID_MIN_LENGTH = 6;
export const SEAT_ID_MAX_LENGTH = 64;
export const SEAT_ID = new RegExp(`^[A-Za-z0-9_-]{${SEAT_ID_MIN_LENGTH},${SEAT_ID_MAX_LENGTH}}$`);
export const ROOM_PATH = Object.freeze({
  STATE: "game/state",
  GAMES: "games",
  PLAYERS: "players",
  NOMINEES: "nominees",
  PLAYS: "plays",
  LEAKS: "leaks",
  NOMINEE_PREFIX: "n",
});
export const OWNED_COLLECTIONS = Object.freeze([ROOM_PATH.PLAYERS, ROOM_PATH.PLAYS]);
const ROOM_CODE_MIN_LENGTH = 3;
const ROOM_CODE_MAX_LENGTH = 32;
export const ROOM_CODE = Object.freeze({
  minLength: ROOM_CODE_MIN_LENGTH,
  maxLength: ROOM_CODE_MAX_LENGTH,
  pattern: `[A-Za-z0-9\\-]{${ROOM_CODE_MIN_LENGTH},${ROOM_CODE_MAX_LENGTH}}`,
});
export const SIGNUP_LIMITS = Object.freeze({ name: 80, email: 254 });
export const SCORE_MIN = 0;
export const SCORE_MAX = 100;
export const FIXED_GAME_SUBSCRIPTIONS = 3;
export const SUBSCRIPTIONS_PER_NOMINEE = 2;
export const MAX_NOMINEES = Math.floor(
  (MAX_SUBSCRIPTIONS - FIXED_GAME_SUBSCRIPTIONS) / SUBSCRIPTIONS_PER_NOMINEE,
);
export const GAME_PHASE = Object.freeze({
  LOBBY: "lobby",
  COMMIT: "commit",
  REVEAL: "reveal",
  GRADED: "results",
  ENDED: "done",
});

const SEGMENT = /^[A-Za-z0-9_\-.~:@+]+$/;
const DOCUMENT_LEVEL_SEGMENTS = 2;
const DOCUMENT_PARITY = 0;
const ROOM_PREFIX = "/r/";
const WEBSOCKET_SUFFIX = "/ws";
const ROOM_IDENTITY = new RegExp(`^(?:${ROOM_CODE.pattern})$`);
const ROOM_ROUTE = new RegExp(`^${ROOM_PREFIX}(${ROOM_CODE.pattern})(${WEBSOCKET_SUFFIX})?/?$`);

/**
 * Reads a browser or WebSocket room route and normalizes the room identity.
 * @param {unknown} pathname
 * @returns {{code: string, websocket: boolean} | null} Null for an invalid route.
 */
export function parseRoomRoute(pathname) {
  if (typeof pathname !== "string") return null;
  const match = ROOM_ROUTE.exec(pathname);
  return match ? { code: match[1].toLowerCase(), websocket: Boolean(match[2]) } : null;
}

/**
 * Constructs a canonical route using the shared room identity limits.
 * @param {unknown} code
 * @param {boolean} [websocket=false]
 * @returns {string}
 * @throws {TypeError} When the room identity is invalid.
 */
export function roomPath(code, websocket = false) {
  if (typeof code !== "string" || !ROOM_IDENTITY.test(code)) {
    throw new TypeError(
      `a room code must have ${ROOM_CODE.minLength} to ${ROOM_CODE.maxLength} ASCII letters, digits or hyphens`,
    );
  }
  return `${ROOM_PREFIX}${code.toLowerCase()}${websocket ? WEBSOCKET_SUFFIX : ""}`;
}

/**
 * Encodes an already validated score and salt for sealing and proof verification.
 * Callers own input validation; this function preserves the supplied salt exactly.
 * @param {number} score
 * @param {string} salt
 * @returns {string}
 */
export function sealText(score, salt) {
  return `${score}:${salt}`;
}

/**
 * @typedef {{kind: "doc", path: string, segments: string[], collection: string, id: string} |
 * {kind: "collection", path: string, segments: string[]}} ParsedPath
 */

/**
 * Parses a document or collection reference using alternating collection and document segments.
 * @param {unknown} path
 * @returns {ParsedPath}
 * @throws {TypeError} When the input is not a valid path within the protocol limits.
 */
export function parsePath(path) {
  if (typeof path !== "string" || path === "") {
    throw new TypeError("a path must be a non-empty string");
  }
  if (path.length > MAX_PATH_LENGTH) {
    throw new TypeError(`a path may be at most ${MAX_PATH_LENGTH} characters`);
  }
  const segments = path.split("/");
  if (segments.length > MAX_SEGMENTS) {
    throw new TypeError(`a path may have at most ${MAX_SEGMENTS} segments`);
  }
  for (const segment of segments) {
    if (segment === "." || segment === "..") {
      throw new TypeError(`"${segment}" is not a segment`);
    }
    if (segment.length > MAX_SEGMENT_LENGTH) {
      throw new TypeError(`a segment may be at most ${MAX_SEGMENT_LENGTH} characters`);
    }
    if (!SEGMENT.test(segment)) {
      throw new TypeError(`"${segment}" has a character outside A-Z a-z 0-9 _ - . ~ : @ +`);
    }
  }
  if (segments.length % DOCUMENT_LEVEL_SEGMENTS === DOCUMENT_PARITY) {
    return {
      kind: "doc",
      path,
      segments,
      collection: segments.slice(0, -1).join("/"),
      id: /** @type {string} */ (segments.at(-1)),
    };
  }
  return { kind: "collection", path, segments };
}
