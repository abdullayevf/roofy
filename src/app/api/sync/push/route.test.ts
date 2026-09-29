import { NextRequest } from "next/server";
import { v7 as uuidv7 } from "uuid";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MutationEnvelope, ProjectDetailManager, PushResponse } from "@/data/contracts";
import { getSeed } from "@/data/fake/store";

// getData() reads cookies through next/headers; point it at the cookies the route handed out.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
  }),
  headers: async () => new Headers(),
}));

const { POST } = await import("./route");
const { getData } = await import("@/data");

const { meta } = getSeed();

const crewDay = (): MutationEnvelope => ({
  id: uuidv7(),
  type: "crew_day",
  schemaVersion: 1,
  appVersion: "0.1.0",
  createdAt: "2026-09-27T21:00:00.000Z",
  payload: {
    date: "2026-09-28",
    projectId: meta.projects.smith,
    stageId: meta.stages.smithSheetInstall,
    entries: [{ crewMemberId: meta.crew.jake, basis: "hourly", days: null, hours: 800, multiplier: null }],
  },
});

const post = (body: unknown, cookie?: string) =>
  POST(
    new NextRequest("http://127.0.0.1:3100/api/sync/push", {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

afterEach(() => {
  vi.unstubAllEnvs();
  jar.clear();
});

describe("POST /api/sync/push (fake mode)", () => {
  it("applies into a new demo session, sets its cookie, and the session's next render shows the log", async () => {
    const entry = crewDay();
    const res = await post({ mutations: [entry] });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as PushResponse;
    expect(body.results[0]).toMatchObject({ id: entry.id, status: "applied" });
    const cookie = res.headers.getSetCookie()[0]!;
    expect(cookie).toMatch(/^roofy_demo=[0-9a-f-]{36}; Path=\/; Max-Age=2592000; HttpOnly; SameSite=Lax$/);
    const id = cookie.slice("roofy_demo=".length, cookie.indexOf(";"));

    jar.set("roofy_demo", id);
    const { data, actor } = await getData();
    const job = (await data.projects.get(actor, meta.projects.smith)) as ProjectDetailManager;
    expect(job.recentLogs[0]).toMatchObject({ crewName: "Jake", date: "2026-09-28", hours: 800 });

    // Same session, same id again: stored result, no new cookie, no second log.
    const again = await post({ mutations: [entry] }, `roofy_demo=${id}`);
    expect(again.headers.getSetCookie()).toEqual([]);
    expect(await again.json()).toEqual(body);
    const after = (await data.projects.get(actor, meta.projects.smith)) as ProjectDetailManager;
    expect(after.recentLogs.filter((l) => l.date === "2026-09-28")).toHaveLength(1);
  });

  it("acts as the role cookie's person: a foreman is refused on a job he isn't assigned", async () => {
    const entry = { ...crewDay(), payload: { ...crewDay().payload, projectId: meta.projects.rydeHeritage, stageId: meta.stages.rydeRepairs } };
    const res = await post({ mutations: [entry] }, "roofy_role=foreman");
    expect(((await res.json()) as PushResponse).results[0]).toMatchObject({ status: "rejected", code: "forbidden" });
  });

  it("refuses 26 entries, bad JSON and a missing list with 400 and a plain message", async () => {
    const tooMany = await post({ mutations: Array.from({ length: 26 }, crewDay) });
    expect(tooMany.status).toBe(400);
    expect(await tooMany.json()).toEqual({ error: { code: "invalid", message: "Send at most 25 entries at a time." } });
    const junk = await post("{not json");
    expect(junk.status).toBe(400);
    expect((await junk.json()).error.message).toBe("Send the entries as JSON.");
    expect((await post({})).status).toBe(400);
  });

  it("is not found outside fake mode", async () => {
    vi.stubEnv("ROOFY_DATA", "postgres");
    expect((await post({ mutations: [] })).status).toBe(404);
  });
});
