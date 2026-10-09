import { DurableObject } from "cloudflare:workers";
import { MAX_BODY_BYTES, SIGNUP_LIMITS } from "../public/protocol.js";
import { isPlainObject } from "./merge";

type Row = { name: string; email: string; consent_at: number };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ROWS = 5000;
const FORMULA_PREFIX = /^[\t\r\n ]*[=+@-]/;
const SCHEMA = `CREATE TABLE IF NOT EXISTS signups (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  consent_at INTEGER NOT NULL
);`;

function json(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, { status });
}

function csvCell(value: string): string {
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export class Signups extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(SCHEMA);
  }

  override async fetch(request: Request): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (request.method === "POST" && pathname === "/add") {
      const reader = request.body?.getReader();
      if (!reader) return json({ ok: false, error: "invalid_json" }, 400);
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          length += chunk.value.byteLength;
          if (length > MAX_BODY_BYTES) {
            await reader.cancel();
            return json({ ok: false, error: "body_too_large" }, 413);
          }
          chunks.push(chunk.value);
        }
      } finally {
        reader.releaseLock();
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return this.add(new TextDecoder().decode(bytes));
    }
    if (request.method === "GET" && pathname === "/export") return this.export();
    return new Response("Not found", { status: 404 });
  }

  private add(rawBody: string): Response {
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }
    if (
      !isPlainObject(body) ||
      typeof body["name"] !== "string" ||
      typeof body["email"] !== "string"
    ) {
      return json({ ok: false, error: "invalid_fields" }, 400);
    }
    const name = body["name"].trim().slice(0, SIGNUP_LIMITS.name);
    const email = body["email"].trim().toLowerCase();
    if (name === "" || email.length > SIGNUP_LIMITS.email || !EMAIL.test(email)) {
      return json({ ok: false, error: "invalid_fields" }, 400);
    }
    return this.ctx.storage.transactionSync(() => {
      const existing =
        this.ctx.storage.sql.exec("SELECT email FROM signups WHERE email = ?", email).toArray()
          .length > 0;
      const count = this.ctx.storage.sql
        .exec<{ n: number }>("SELECT COUNT(*) AS n FROM signups")
        .one().n;
      if (!existing && count >= MAX_ROWS) return json({ ok: false, error: "full" }, 507);
      this.ctx.storage.sql.exec(
        `INSERT INTO signups (email, name, consent_at) VALUES (?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET name = excluded.name`,
        email,
        name,
        Date.now(),
      );
      return json({ ok: true }, 201);
    });
  }

  private export(): Response {
    const rows = this.ctx.storage.sql
      .exec<Row>("SELECT name, email, consent_at FROM signups ORDER BY consent_at, email")
      .toArray();
    const lines = ["name,email,consent_at"];
    for (const row of rows) {
      lines.push(
        `${csvCell(row.name)},${csvCell(row.email)},${new Date(row.consent_at).toISOString()}`,
      );
    }
    return new Response(`${lines.join("\n")}\n`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="decentralized-curation-signups.csv"',
        "cache-control": "no-store",
      },
    });
  }
}
