/**
 * The workspace export file (flows.md screen 26): one zip holding every file the data layer lists. Owner only; anyone
 * else gets 403 with nothing in it. The prototype makes it from the fake data; Phase 3 makes it on the server.
 */
import type { NextRequest } from "next/server";
import { getData } from "@/data";
import { isDataError } from "@/data/contracts";
import { EXPORT_FILENAME } from "@/components/screens/export-text";
import { makeZip } from "@/lib/zip";

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(request: NextRequest): Promise<Response> {
  const { data, actor } = await getData({ searchParams: request.nextUrl.searchParams });
  try {
    const listing = await data.exports.listing(actor);
    const files = await Promise.all(listing.files.map((f) => data.exports.file(actor, f.name)));
    // TODO(Phase 3): zip the attachment files (receipts, photos) too, not only the CSVs.
    const zip = makeZip(files.map((f) => ({ name: f.filename, body: f.body })));
    return new Response(new Blob([zip as BlobPart], { type: "application/zip" }), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${EXPORT_FILENAME}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (isDataError(e) && e.code === "forbidden") return text("You don't have access to this. Ask your manager.", 403);
    if (isDataError(e) && e.code === "unavailable") return text("Couldn't make the file. Try again.", 503);
    throw e;
  }
}
