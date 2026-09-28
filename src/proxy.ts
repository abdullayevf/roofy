/**
 * Copies `?demo=<state>` into the `x-roofy-demo` request header so layouts — which get no
 * `searchParams` — can read the prototype's demo state through `getData()` (e.g. the offline
 * banner). Runs on every page request and always drops a client-sent copy of the header, so only
 * the URL decides the state. `getData()` ignores it outside fake mode.
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

/** Every page and route request (so a client-sent header is always stripped); not static files. */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon|apple-icon|manifest\\.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2)$).*)",
  ],
};
