/**
 * Prototype role switch (fake mode only; 404 otherwise):
 * `GET /prototype/role?as=foreman&next=/jobs` sets `roofy_role`, gives the browser its own demo
 * session (`roofy_demo`) if it has none, and sends it back to `next` (same-origin paths only).
 */
import type { NextRequest } from "next/server";
import { isFakeMode } from "@/data";
import {
  DEMO_COOKIE,
  ROLE_COOKIE,
  ROLES,
  SESSION_COOKIE_OPTIONS,
  isDemoSessionId,
  isHttps,
  newDemoSessionId,
  parseRole,
  safeNextPath,
} from "@/data/session";

function cookie(name: string, value: string, secure: boolean): string {
  const o = SESSION_COOKIE_OPTIONS;
  return `${name}=${value}; Path=${o.path}; Max-Age=${o.maxAge}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export async function GET(request: NextRequest): Promise<Response> {
  if (!isFakeMode()) return new Response("Not found", { status: 404 });
  const params = request.nextUrl.searchParams;
  const role = parseRole(params.get("as"));
  if (role === null) {
    return new Response(`Choose a role: ${ROLES.join(", ")}.`, {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  // A relative Location keeps the browser on the host it used (127.0.0.1 vs localhost), so the
  // cookies set here are the ones it sends next.
  const headers = new Headers({ Location: safeNextPath(params.get("next")), "Cache-Control": "no-store" });
  const secure = isHttps(request.url, request.headers);
  headers.append("Set-Cookie", cookie(ROLE_COOKIE, role, secure));
  if (!isDemoSessionId(request.cookies.get(DEMO_COOKIE)?.value)) {
    headers.append("Set-Cookie", cookie(DEMO_COOKIE, newDemoSessionId(), secure));
  }
  return new Response(null, { status: 303, headers });
}
