/**
 * Prototype shortcut (fake mode only; 404 otherwise) for the "payout saved" capture:
 * `GET /prototype/record-payout?crew=<id>&cents=148200&kind=payment&method=bank_transfer&approve=1&next=/crew/<id>?saved=payment`
 * records the payout dated today (the workspace's date) in this browser's own demo session (`roofy_demo`), as the
 * signed-in role, after approving last week's pay run when `approve=1`, then sends it to `next`. The page there
 * re-reads, so its balance and top ledger row show the save, exactly as after Save payout.
 */
import type { NextRequest } from "next/server";
import { isFakeMode, writeContext } from "@/data";
import { isDataError, type PayoutInput } from "@/data/contracts";
import { getSeed } from "@/data/fake/store";
import { DEMO_COOKIE, ROLE_COOKIE, isDemoSessionId, parseRole, safeNextPath } from "@/data/session";

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(request: NextRequest): Promise<Response> {
  if (!isFakeMode()) return text("Not found", 404);
  const role = parseRole(request.cookies.get(ROLE_COOKIE)?.value);
  const demoSessionId = request.cookies.get(DEMO_COOKIE)?.value;
  if (role === null || !isDemoSessionId(demoSessionId)) return text("Sign in through /prototype/role first.", 400);
  const q = request.nextUrl.searchParams;
  const cents = Number(q.get("cents"));
  const kind = q.get("kind");
  const method = q.get("method");
  if (!Number.isInteger(cents) || cents <= 0 || (kind !== "advance" && kind !== "payment"))
    return text("Give crew, cents (a whole number) and kind (advance or payment).", 400);
  const { data, actor, today } = writeContext({ role, demoSessionId });
  const input: PayoutInput = {
    crewMemberId: q.get("crew") ?? "",
    date: today,
    amountCents: cents,
    kind,
    method: method === "cash" || method === "other" ? method : "bank_transfer",
    note: q.get("note"),
  };
  try {
    if (q.get("approve") === "1") await data.payRuns.approve(actor, getSeed().meta.payRuns.review, { waiveMissingRate: true });
    await data.ledger.recordPayout(actor, input);
  } catch (e) {
    if (isDataError(e)) return text(e.message, e.code === "forbidden" ? 403 : 409);
    throw e;
  }
  const next = safeNextPath(q.get("next"));
  return new Response(null, { status: 303, headers: { Location: next, "Cache-Control": "no-store" } });
}
