import { describe, expect, it, vi } from "vitest";
import type { CrewDayInput, PushResponse } from "@/data/contracts";
import { APP_VERSION, buildEnvelope, PUSH_URL, submit, submitMany } from "./submit";

const input: CrewDayInput = {
  date: "2026-09-28",
  projectId: "p1",
  stageId: "s1",
  entries: [{ crewMemberId: "jake", basis: "hourly", days: null, hours: 800, multiplier: null }],
};

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function fetchReturning(body: unknown, status = 200) {
  return vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  );
}

describe("buildEnvelope", () => {
  it("wraps a payload in the architecture §7 envelope: UUIDv7, schema 1, app version, ISO time", () => {
    const now = new Date("2026-09-27T21:00:00Z");
    const e = buildEnvelope("crew_day", input, { now });
    expect(e).toEqual({
      id: expect.stringMatching(UUID_V7),
      type: "crew_day",
      schemaVersion: 1,
      appVersion: APP_VERSION,
      createdAt: "2026-09-27T21:00:00.000Z",
      payload: input,
    });
  });

  it("ids are new each time and sort in creation order", () => {
    const ids = Array.from({ length: 5 }, () => buildEnvelope("crew_day", input).id);
    expect(new Set(ids).size).toBe(5);
    expect([...ids].sort()).toEqual(ids);
  });
});

describe("submit", () => {
  it("POSTs one envelope as JSON to the push endpoint and returns its result", async () => {
    const result = { status: "applied", result: { ids: ["l1"], flags: ["auto_started"] } };
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const sent = JSON.parse(String(init!.body)) as { mutations: { id: string }[] };
      return Response.json({ results: [{ id: sent.mutations[0]!.id, ...result }] } satisfies PushResponse | object);
    });
    const r = await submit("crew_day", input, { fetch });
    expect(r).toMatchObject(result);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(PUSH_URL);
    expect(init).toMatchObject({ method: "POST", credentials: "same-origin" });
    expect(new Headers(init!.headers).get("content-type")).toBe("application/json");
    const body = JSON.parse(String(init!.body));
    expect(body.mutations).toHaveLength(1);
    expect(body.mutations[0]).toMatchObject({ type: "crew_day", schemaVersion: 1, payload: input });
    expect(r.id).toBe(body.mutations[0].id);
  });

  it("no signal or a server fault → retry; a refused request → rejected with the server's words", async () => {
    const offline = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect((await submit("crew_day", input, { fetch: offline })).status).toBe("retry");
    expect((await submit("crew_day", input, { fetch: fetchReturning("oops", 503) })).status).toBe("retry");
    const refused = await submit("crew_day", input, {
      fetch: fetchReturning({ error: { code: "invalid", message: "Send at most 25 entries at a time." } }, 400),
    });
    expect(refused).toMatchObject({ status: "rejected", code: "invalid", message: "Send at most 25 entries at a time." });
  });

  it("an answer without this entry's id counts as retry", async () => {
    const r = await submit("crew_day", input, { fetch: fetchReturning({ results: [] }) });
    expect(r.status).toBe("retry");
  });

  it("submitMany sends up to 25 in one request, in order", async () => {
    const envelopes = Array.from({ length: 3 }, () => buildEnvelope("crew_day", input));
    const fetch = fetchReturning({ results: envelopes.map((e) => ({ id: e.id, status: "retry" })) });
    const results = await submitMany(envelopes, { fetch });
    expect(results.map((r) => r.id)).toEqual(envelopes.map((e) => e.id));
    expect(JSON.parse(String(fetch.mock.calls[0]![1]!.body)).mutations.map((m: { id: string }) => m.id)).toEqual(
      envelopes.map((e) => e.id),
    );
    await expect(submitMany(Array.from({ length: 26 }, () => envelopes[0]!), { fetch })).rejects.toThrow(RangeError);
  });
});
