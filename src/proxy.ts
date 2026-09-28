/**
 * Copies `?demo=<state>` into the `x-roofy-demo` request header so layouts — which get no
 * `searchParams` — can read the prototype's demo state through `getData()` (e.g. the offline
 * banner). Runs only on requests that carry `?demo`; `getData()` ignores it outside fake mode.
 */
import { NextResponse, type NextRequest } from "next/server";

/** Same value as `DEMO_HEADER` in `src/data/session.ts` (kept free of server imports here). */
const DEMO_HEADER = "x-roofy-demo";

export function proxy(request: NextRequest): NextResponse {
  const headers = new Headers(request.headers);
  const demo = request.nextUrl.searchParams.get("demo");
  if (demo) headers.set(DEMO_HEADER, demo);
  else headers.delete(DEMO_HEADER);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      has: [{ type: "query", key: "demo" }],
    },
  ],
};
