import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const call = (query: string, cookie?: string) =>
  GET(
    new NextRequest(`http://127.0.0.1:3100/prototype/role${query}`, {
      headers: cookie ? { cookie } : {},
    }),
  );

afterEach(() => vi.unstubAllEnvs());

describe("GET /prototype/role", () => {
  it("sets the role and a new demo session, then goes to next", async () => {
    vi.stubEnv("ROOFY_DATA", "fake");
    const res = await call("?as=foreman&next=/jobs?demo=offline");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/jobs?demo=offline");
    const cookies = res.headers.getSetCookie();
    expect(cookies[0]).toBe("roofy_role=foreman; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax");
    expect(cookies[1]).toMatch(/^roofy_demo=[0-9a-f-]{36}; Path=\/; Max-Age=2592000; HttpOnly; SameSite=Lax$/);
  });

  it("keeps an existing demo session", async () => {
    const id = crypto.randomUUID();
    const res = await call("?as=accountant", `roofy_demo=${id}`);
    expect(res.headers.get("location")).toBe("/");
    expect(res.headers.getSetCookie()).toEqual([
      "roofy_role=accountant; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax",
    ]);
  });

  it("refuses an unknown role and never redirects off-site", async () => {
    expect((await call("?as=admin")).status).toBe(400);
    expect((await call("")).status).toBe(400);
    for (const next of ["https://evil.example/", "//evil.example", "/\\evil.example"]) {
      const res = await call(`?as=owner&next=${encodeURIComponent(next)}`);
      expect(res.headers.get("location")).toBe("/");
    }
  });

  it("is not found outside fake mode", async () => {
    vi.stubEnv("ROOFY_DATA", "postgres");
    const res = await call("?as=owner");
    expect(res.status).toBe(404);
    expect(res.headers.getSetCookie()).toEqual([]);
  });
});
