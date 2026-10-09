import { exports } from "cloudflare:workers";

const SELF = exports.default;

import { describe, expect, it } from "vitest";
import { MAX_BODY_BYTES, SIGNUP_LIMITS } from "../../public/protocol.js";

const BASE = "https://example.com";
const ADMIN = { Authorization: "Bearer test-admin-token" };

function signup(body: unknown): Promise<Response> {
  return SELF.fetch(`${BASE}/api/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("sign-ups", () => {
  it("stores a valid sign-up once per address and exports it to the admin only", async () => {
    expect((await signup({ name: "Ada", email: "Ada@Example.org" })).status).toBe(201);
    expect((await signup({ name: "Ada Lovelace", email: "ada@example.org" })).status).toBe(201);
    expect((await SELF.fetch(`${BASE}/api/signups.csv`)).status).toBe(401);
    expect(
      (await SELF.fetch(`${BASE}/api/signups.csv`, { headers: { Authorization: "Bearer wrong" } }))
        .status,
    ).toBe(401);
    const csv = await SELF.fetch(`${BASE}/api/signups.csv`, { headers: ADMIN });
    expect(csv.status).toBe(200);
    expect(csv.headers.get("content-type")).toContain("text/csv");
    const lines = (await csv.text()).trim().split("\n");
    expect(lines[0]).toBe("name,email,consent_at");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/^Ada Lovelace,ada@example\.org,\d{4}-\d\d-\d\dT/);
  });

  it("refuses a missing name, a malformed address and a body that is not JSON", async () => {
    expect((await signup({ name: "", email: "x@example.org" })).status).toBe(400);
    expect((await signup({ name: "X", email: "not-an-address" })).status).toBe(400);
    const raw = await SELF.fetch(`${BASE}/api/signup`, { method: "POST", body: "{" });
    expect(raw.status).toBe(400);
    expect((await SELF.fetch(`${BASE}/api/signup`)).status).toBe(405);
  });

  it("escapes quotes in a name so the CSV stays one row per sign-up", async () => {
    await signup({ name: 'Grace "Amazing" Hopper', email: "grace@example.org" });
    const csv = await (await SELF.fetch(`${BASE}/api/signups.csv`, { headers: ADMIN })).text();
    expect(csv).toContain('"Grace ""Amazing"" Hopper",grace@example.org');
  });

  it("rejects non-string fields and over-limit request bodies", async () => {
    expect((await signup({ name: { first: "Ada" }, email: "a@example.org" })).status).toBe(400);
    expect((await signup({ name: "Ada", email: ["a@example.org"] })).status).toBe(400);
    expect(
      (await signup({ name: "x".repeat(MAX_BODY_BYTES), email: "a@example.org" })).status,
    ).toBe(413);
  });

  it("normalizes an overlength signup name to the stored limit", async () => {
    const response = await signup({
      name: "x".repeat(SIGNUP_LIMITS.name + 1),
      email: "name-limit@example.org",
    });
    expect(response.status).toBe(201);
    const csv = await (await SELF.fetch(`${BASE}/api/signups.csv`, { headers: ADMIN })).text();
    expect(csv).toContain(`${"x".repeat(SIGNUP_LIMITS.name)},name-limit@example.org`);
    expect(csv).not.toContain("x".repeat(SIGNUP_LIMITS.name + 1));
  });

  it("neutralizes spreadsheet formulas in exported user fields", async () => {
    await signup({ name: '=HYPERLINK("https://example.org")', email: "formula@example.org" });
    const csv = await (await SELF.fetch(`${BASE}/api/signups.csv`, { headers: ADMIN })).text();
    expect(csv).toContain('"\'=HYPERLINK(""https://example.org"")",formula@example.org');
  });
});
