import { parseRoomRoute } from "../public/protocol.js";
import { Room } from "./room";
import { Signups } from "./signups";

export { Room, Signups };

const ADMIN_EXPORT_PATH = "/api/signups.csv";

function movedTo(url: URL, env: Env): URL | null {
  if (!env.REDIRECT_TO || url.pathname === ADMIN_EXPORT_PATH) return null;
  const target = new URL(env.REDIRECT_TO);
  target.pathname = url.pathname;
  target.search = url.search;
  return target;
}

function adminAllowed(request: Request, env: Env): boolean {
  return (
    Boolean(env.ADMIN_TOKEN) && request.headers.get("Authorization") === `Bearer ${env.ADMIN_TOKEN}`
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const moved = movedTo(url, env);
    if (moved) return Response.redirect(moved.href, 301);
    const room = parseRoomRoute(url.pathname);
    if (room) {
      const code = room.code;
      if (room.websocket) {
        if (request.method !== "GET")
          return new Response("Method not allowed", { status: 405, headers: { Allow: "GET" } });
        if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
          return new Response("Expected a WebSocket upgrade", { status: 426 });
        }
        return env.ROOM.get(env.ROOM.idFromName(code)).fetch(request);
      }
      return env.ASSETS.fetch(new Request(new URL("/r/", url), request));
    }
    if (url.pathname === "/api/signup") {
      if (request.method !== "POST")
        return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
      return env.SIGNUPS.get(env.SIGNUPS.idFromName("all")).fetch(
        new Request("https://signups/add", request),
      );
    }
    if (url.pathname === ADMIN_EXPORT_PATH) {
      if (request.method !== "GET")
        return new Response("Method not allowed", { status: 405, headers: { Allow: "GET" } });
      if (!adminAllowed(request, env))
        return new Response("Unauthorized", {
          status: 401,
          headers: { "cache-control": "no-store" },
        });
      return env.SIGNUPS.get(env.SIGNUPS.idFromName("all")).fetch("https://signups/export");
    }
    if (url.pathname.startsWith("/r/") || url.pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
