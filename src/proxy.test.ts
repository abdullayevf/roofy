import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { DEMO_HEADER } from "./data/session";
import { config, proxy } from "./proxy";

/** NextResponse.next({ request: { headers } }) passes overrides as x-middleware-request-* headers. */
const forwarded = (res: Response, name: string) => res.headers.get(`x-middleware-request-${name}`);

describe("proxy", () => {
  it("copies ?demo= into the request header layouts read", () => {
    const res = proxy(new NextRequest("http://127.0.0.1:3100/jobs?demo=offline"));
    expect(forwarded(res, DEMO_HEADER)).toBe("offline");
  });

  it("drops a client-sent header when the URL has no demo value", () => {
    const res = proxy(new NextRequest("http://127.0.0.1:3100/jobs?demo=", { headers: { [DEMO_HEADER]: "error" } }));
    expect(forwarded(res, DEMO_HEADER)).toBeNull();
  });

  it("only runs on requests with ?demo, never on static assets", () => {
    expect(config.matcher[0]!.has).toEqual([{ type: "query", key: "demo" }]);
    expect(config.matcher[0]!.source).toContain("_next/static");
  });
});
