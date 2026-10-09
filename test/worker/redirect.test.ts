import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../../src/worker";

const OLD_ORIGIN = "https://example.com";
const NEW_ORIGIN = "https://decentralized-curation.example";
const moved: Env = { ...env, REDIRECT_TO: NEW_ORIGIN };

describe("A Worker with REDIRECT_TO set", () => {
  it("sends pages and rooms to the same path and query on the new origin", async () => {
    for (const path of ["/", "/deck/?v=2", "/r/leiden", "/join/"]) {
      const response = await worker.fetch(new Request(`${OLD_ORIGIN}${path}`), moved);
      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(`${NEW_ORIGIN}${path}`);
    }
  });

  it("keeps the admin export answering in place", async () => {
    const response = await worker.fetch(
      new Request(`${OLD_ORIGIN}/api/signups.csv`, {
        headers: { Authorization: `Bearer ${moved.ADMIN_TOKEN}` },
      }),
      moved,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
  });
});
