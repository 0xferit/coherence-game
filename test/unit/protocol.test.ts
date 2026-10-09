import { describe, expect, it } from "vitest";
import {
  MAX_PATH_LENGTH,
  MAX_SEGMENT_LENGTH,
  MAX_SEGMENTS,
  parsePath,
  parseRoomRoute,
  ROOM_CODE,
  roomPath,
  sealText,
} from "../../public/protocol.js";

describe("parsePath", () => {
  it("returns document identity and its immediate collection for nested paths", () => {
    expect(parsePath("games/e1/nominees/n0/plays/p-ada")).toEqual({
      kind: "doc",
      path: "games/e1/nominees/n0/plays/p-ada",
      segments: ["games", "e1", "nominees", "n0", "plays", "p-ada"],
      collection: "games/e1/nominees/n0/plays",
      id: "p-ada",
    });
    expect(parsePath("players")).toEqual({
      kind: "collection",
      path: "players",
      segments: ["players"],
    });
    expect(parsePath("games/e1/nominees/n0/plays").kind).toBe("collection");
  });

  it.each([
    null,
    undefined,
    0,
    {},
    [],
    "",
    "/game",
    "game/",
    "game//state",
    "game/.",
    "game/..",
    "game/sta te",
    "game/%2e",
    "game/é",
    "game/state?x=1",
  ])("rejects the invalid path %j with TypeError", (invalid) => {
    expect(() => parsePath(invalid)).toThrow(TypeError);
  });

  it("accepts the largest segment and refuses its first invalid length", () => {
    expect(parsePath("x".repeat(MAX_SEGMENT_LENGTH)).kind).toBe("collection");
    expect(() => parsePath("x".repeat(MAX_SEGMENT_LENGTH + 1))).toThrow(TypeError);
  });

  it("accepts the deepest path and refuses the next segment", () => {
    const deepest = Array.from({ length: MAX_SEGMENTS }, () => "a").join("/");
    expect(parsePath(deepest).kind).toBe("doc");
    expect(() => parsePath(`${deepest}/b`)).toThrow(TypeError);
  });

  it("enforces the total length separately from segment length", () => {
    const prefix = Array.from({ length: 4 }, () => "a".repeat(MAX_SEGMENT_LENGTH)).join("/");
    const remaining = MAX_PATH_LENGTH - prefix.length - 1;
    const longest = `${prefix}/${"b".repeat(remaining)}`;
    expect(parsePath(longest).path).toBe(longest);
    expect(() => parsePath(`${longest}b`)).toThrow(TypeError);
  });

  it("accepts every allowed segment character", () => {
    expect(parsePath("p_1-2.3~4:5@6+7/d").kind).toBe("doc");
  });
});

describe("room routes", () => {
  it("normalizes room identities and keeps browser and socket routes in agreement", () => {
    for (const code of ["Ada", "a-b", "Z9-", "a".repeat(ROOM_CODE.maxLength)]) {
      for (const websocket of [false, true]) {
        const pathname = roomPath(code, websocket);
        const parsed = { code: code.toLowerCase(), websocket };
        expect(parseRoomRoute(pathname)).toEqual(parsed);
        expect(parseRoomRoute(`${pathname}/`)).toEqual(parsed);
      }
    }
    expect(roomPath("Ada")).toBe("/r/ada");
  });

  it("accepts both length boundaries and refuses the first invalid length", () => {
    for (const length of [ROOM_CODE.minLength, ROOM_CODE.maxLength]) {
      expect(parseRoomRoute(`/r/${"a".repeat(length)}`)?.code).toHaveLength(length);
    }
    for (const length of [ROOM_CODE.minLength - 1, ROOM_CODE.maxLength + 1]) {
      const code = "a".repeat(length);
      expect(parseRoomRoute(`/r/${code}`)).toBeNull();
      expect(() => roomPath(code)).toThrow(TypeError);
    }
  });

  it.each([
    null,
    undefined,
    0,
    "",
    "a_b",
    "a b",
    "éab",
    "a/b",
    "a\\b",
    "abc?x=1",
    "abc#x",
    "abc\n",
    "abc\r",
  ])("refuses an invalid room identity %j before constructing a route", (invalid) => {
    expect(() => roomPath(invalid)).toThrow(TypeError);
    expect(parseRoomRoute(typeof invalid === "string" ? `/r/${invalid}` : invalid)).toBeNull();
  });

  it.each([
    "/r/abc/socket",
    "/r/abc/ws/extra",
    "/r/abc//",
    "/r/abc//ws",
    "/R/abc",
    "r/abc",
    "/r/%61bc",
  ])("rejects an unsupported room route %s", (pathname) =>
    expect(parseRoomRoute(pathname)).toBeNull(),
  );

  it("uses an HTML-compatible pattern with the same room identity boundary", () => {
    const pattern = new RegExp(`^(?:${ROOM_CODE.pattern})$`, "v");
    for (const code of ["a-b", "ABC", "-9-"]) expect(pattern.test(code)).toBe(true);
    for (const code of ["ab", "a_b", "a\\b", "x".repeat(ROOM_CODE.maxLength + 1)]) {
      expect(pattern.test(code)).toBe(false);
    }
  });
});

describe("sealText", () => {
  it("preserves the validated score and salt encoding used by both reveal and leak proofs", () => {
    expect(sealText(0, "zero boundary")).toBe("0:zero boundary");
    expect(sealText(100, "top boundary")).toBe("100:top boundary");
    expect(sealText(62, "salt with  spaces")).toBe("62:salt with  spaces");
  });
});
