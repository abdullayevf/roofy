import { describe, expect, it, vi } from "vitest";
import { forgetWaiting, noteWaiting, waitingCount, subscribeWaiting } from "./waiting";
import { submit } from "./submit";

describe("entries waiting on this device (Phase 2 stand-in for the device queue)", () => {
  it("counts each entry noted and tells listeners", () => {
    forgetWaiting();
    const seen = vi.fn();
    const stop = subscribeWaiting(seen);
    noteWaiting();
    noteWaiting();
    expect(waitingCount()).toBe(2);
    expect(seen).toHaveBeenCalledTimes(2);
    stop();
    noteWaiting();
    expect(seen).toHaveBeenCalledTimes(2);
    forgetWaiting();
    expect(waitingCount()).toBe(0);
  });

  it("submit notes an entry that could not be sent yet, and only that", async () => {
    forgetWaiting();
    const payload = { crewMemberIds: ["c"], date: "2026-09-28", reason: "rain" as const, note: null };
    await submit("no_work", payload, { fetch: () => Promise.reject(new Error("offline")) });
    expect(waitingCount()).toBe(1);
    const ok = (url: string, init?: RequestInit) => {
      const ids = (JSON.parse(String(init?.body)) as { mutations: { id: string }[] }).mutations.map((m) => m.id);
      return Promise.resolve(Response.json({ results: ids.map((id) => ({ id, status: "applied", result: { flags: [] } })) }));
    };
    await submit("no_work", payload, { fetch: ok });
    expect(waitingCount()).toBe(1);
    forgetWaiting();
  });
});
