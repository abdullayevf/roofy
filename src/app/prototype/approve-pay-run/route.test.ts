import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeContext } from "@/data";
import { newDemoSessionId } from "@/data/session";
import { getSeed } from "@/data/fake/store";
import { GET } from "./route";

const { meta } = getSeed();
const call = (query: string, cookie?: string) =>
  GET(new NextRequest(`http://127.0.0.1:3100/prototype/approve-pay-run${query}`, { headers: cookie ? { cookie } : {} }));

afterEach(() => vi.unstubAllEnvs());

describe("GET /prototype/approve-pay-run", () => {
  it("approves last week's pay run in this demo session, then goes to next", async () => {
    const id = newDemoSessionId();
    const res = await call(`?next=${encodeURIComponent(`/crew/${meta.crew.dima}`)}`, `roofy_role=manager; roofy_demo=${id}`);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/crew/${meta.crew.dima}`);
    const { data, actor } = writeContext({ role: "manager", demoSessionId: id });
    expect((await data.payRuns.get(actor, meta.payRuns.review)).status).toBe("approved");
    // Another session's store is untouched.
    const other = writeContext({ role: "manager", demoSessionId: newDemoSessionId() });
    expect((await other.data.payRuns.get(other.actor, meta.payRuns.review)).status).toBe("draft");
  });

  it("needs a demo session and a role that can approve", async () => {
    expect((await call("")).status).toBe(400);
    expect((await call("", `roofy_role=foreman; roofy_demo=${newDemoSessionId()}`)).status).toBe(403);
  });

  it("is not found outside fake mode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ROOFY_DATA", undefined);
    expect((await call("", `roofy_role=manager; roofy_demo=${newDemoSessionId()}`)).status).toBe(404);
  });
});
