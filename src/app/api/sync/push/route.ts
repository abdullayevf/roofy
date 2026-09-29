/**
 * `POST /api/sync/push` — the fake push endpoint (fake mode only; 404 otherwise; the real one is
 * Phase 5). Architecture §7 shape:
 *
 * ```
 * POST { "mutations": [ { "id": "<uuidv7>", "type": "crew_day", "schemaVersion": 1,
 *        "appVersion": "0.1.0", "createdAt": "2026-09-27T21:00:00.000Z", "payload": { … } } ] }
 * 200  { "results": [ { "id": "<uuidv7>", "status": "applied", "result": { "ids": […], "flags": [] } } ] }
 * 400  { "error": { "code": "invalid", "message": "Send at most 25 entries at a time." } }
 * ```
 *
 * The person is the role cookie's (`roofy_role`, default manager). Writes go to the browser's own demo
 * session store (`roofy_demo`); a browser without one gets it here (`Set-Cookie`), so its next page
 * render reads what it just sent.
 */
import type { NextRequest } from "next/server";
import { isFakeMode, writeContext } from "@/data";
import type { MutationEnvelope } from "@/data/contracts";
import { parsePushRequest } from "@/data/mutations";
import {
  DEFAULT_ROLE,
  DEMO_COOKIE,
  ROLE_COOKIE,
  isDemoSessionId,
  isHttps,
  newDemoSessionId,
  parseRole,
  serializeSessionCookie,
} from "@/data/session";

const NO_STORE = { "Cache-Control": "no-store" };

const badRequest = (message: string) =>
  Response.json({ error: { code: "invalid", message } }, { status: 400, headers: NO_STORE });

export async function POST(request: NextRequest): Promise<Response> {
  if (!isFakeMode()) return new Response("Not found", { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Send the entries as JSON.");
  }
  const parsed = parsePushRequest(body);
  if (!parsed.ok) return badRequest(parsed.message);

  const role = parseRole(request.cookies.get(ROLE_COOKIE)?.value) ?? DEFAULT_ROLE;
  const existing = request.cookies.get(DEMO_COOKIE)?.value;
  const demoSessionId = isDemoSessionId(existing) ? existing : newDemoSessionId();
  const { data, actor } = writeContext({ role, demoSessionId });
  // Each mutation is validated on its own inside push; a bad one is rejected, the rest still apply.
  const response = await data.sync.push(actor, {
    mutations: parsed.mutations as unknown as MutationEnvelope[],
  });

  const headers = new Headers(NO_STORE);
  if (demoSessionId !== existing) {
    headers.append(
      "Set-Cookie",
      serializeSessionCookie(DEMO_COOKIE, demoSessionId, isHttps(request.url, request.headers)),
    );
  }
  return Response.json(response, { headers });
}
