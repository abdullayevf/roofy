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

  it("strips a client-sent header on requests without ?demo", () => {
    const res = proxy(new NextRequest("http://127.0.0.1:3100/jobs", { headers: { [DEMO_HEADER]: "error" } }));
    expect(forwarded(res, DEMO_HEADER)).toBeNull();
    expect(res.headers.get("x-middleware-override-headers") ?? "").not.toContain(DEMO_HEADER);
  });

  it("runs on every page request, never on static assets or icons", () => {
    const matcher = config.matcher[0]!;
    const re = new RegExp(`^${matcher}$`);
    for (const path of ["/", "/jobs", "/jobs/abc", "/prototype/role"]) expect(re.test(path), path).toBe(true);
    for (const path of ["/_next/static/x.js", "/_next/image", "/favicon.ico", "/icon.png", "/apple-icon.png", "/manifest.webmanifest"])
      expect(re.test(path), path).toBe(false);
  });
});
