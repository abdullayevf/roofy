/**
 * Prototype shortcut (fake mode only; 404 otherwise) until the pay run screen exists:
 * `GET /prototype/approve-pay-run?next=/crew/<id>` approves last week's draft pay run in this
 * browser's own demo session (`roofy_demo`), as the signed-in role, waiving the seed's missing rate,
 * then sends it back to `next`. Lets the "Record a payout" flow test start from flows.md's figures.
 */
import type { NextRequest } from "next/server";
import { isFakeMode, writeContext } from "@/data";
import { isDataError } from "@/data/contracts";
import { getSeed } from "@/data/fake/store";
import { DEMO_COOKIE, ROLE_COOKIE, isDemoSessionId, parseRole, safeNextPath } from "@/data/session";

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(request: NextRequest): Promise<Response> {
  if (!isFakeMode()) return text("Not found", 404);
  const role = parseRole(request.cookies.get(ROLE_COOKIE)?.value);
  const demoSessionId = request.cookies.get(DEMO_COOKIE)?.value;
  if (role === null || !isDemoSessionId(demoSessionId)) return text("Sign in through /prototype/role first.", 400);
  const { data, actor } = writeContext({ role, demoSessionId });
  try {
    await data.payRuns.approve(actor, getSeed().meta.payRuns.review, { waiveMissingRate: true });
  } catch (e) {
    if (isDataError(e)) return text(e.message, e.code === "forbidden" ? 403 : 409);
    throw e;
  }
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  return new Response(null, { status: 303, headers: { Location: next, "Cache-Control": "no-store" } });
}
