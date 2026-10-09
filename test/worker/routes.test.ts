import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { MSG } from "../../public/protocol.js";
import { openRoom } from "./helpers";

const SELF = exports.default;
const BASE = "https://example.com";

describe("Worker routes", () => {
  it("serves the game for case-insensitive codes with an optional slash", async () => {
    for (const path of ["/r/leiden", "/r/Leiden/", "/r/iosp-2026"]) {
      const response = await SELF.fetch(`${BASE}${path}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(await response.text()).toContain("Coherence game");
    }
  });

  it("refuses a missing upgrade, invalid room codes and missing API endpoints", async () => {
    expect((await SELF.fetch(`${BASE}/r/leiden/ws`)).status).toBe(426);
    expect((await SELF.fetch(`${BASE}/r/leiden/ws`, { method: "POST" })).status).toBe(405);
    for (const path of ["/r/a", "/r/has%20space", "/r/" + "a".repeat(33), "/api/missing"]) {
      expect((await SELF.fetch(`${BASE}${path}`)).status).toBe(404);
    }
    expect(
      (
        await SELF.fetch(`${BASE}/api/signups.csv`, {
          method: "POST",
          headers: { Authorization: "Bearer test-admin-token" },
        })
      ).status,
    ).toBe(405);
  });

  it("routes two spellings of a room code to one object", async () => {
    const a = await openRoom("RouteRoom");
    const b = await openRoom("routeroom");
    await b.sub("s1", "scratch/state", "doc");
    expect(
      (await a.call({ t: MSG.SET, path: "scratch/state", data: { phase: "lobby" } }))["ok"],
    ).toBe(true);
    const changed = await b.next((message) => message["id"] === "s1");
    expect(changed["doc"]).toMatchObject({ exists: true, data: { phase: "lobby" } });
  });

  it("serves the landing page at the root", async () => {
    const response = await SELF.fetch(`${BASE}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Coherence game");
  });
});
