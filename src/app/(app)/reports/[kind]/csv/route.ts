/**
 * Export CSV for one report (flows.md screen 22): the range from `?from=&to=` (the last 3 months by default), the file
 * from the data layer's `reports.csv`. A foreman gets 403 with no figures; an unknown kind is not found.
 */
import type { NextRequest } from "next/server";
import { getData } from "@/data";
import { isDataError } from "@/data/contracts";
import { isReportKind, readReportRange } from "@/components/screens/reports-text";

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }): Promise<Response> {
  const { kind } = await params;
  if (!isReportKind(kind)) return text("Not found", 404);
  const sp = request.nextUrl.searchParams;
  const { data, actor, today } = await getData({ searchParams: sp });
  const { range } = readReportRange(today, { from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
  try {
    const file = await data.reports.csv(actor, kind, range);
    return new Response(file.body, {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (isDataError(e) && e.code === "forbidden") return text("You don't have access to this. Ask your manager.", 403);
    if (isDataError(e) && e.code === "unavailable") return text("Couldn't make the file. Try again.", 503);
    throw e;
  }
}
