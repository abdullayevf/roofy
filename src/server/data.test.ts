import { describe, expect, it, vi } from "vitest";
import type { Actor } from "@/data/contracts";
import type { ActorResult } from "@/server/auth/actor";

vi.mock("@/server/auth/actor", () => ({ actorFromHeaders: vi.fn() }));
const { createDbDataProvider, NO_WORKSPACE_ACTOR_ID } = await import("./data");
const { NOT_READY, ONBOARDING_METHODS } = await import("./services");

const actor: Actor = { userId: "u-1", workspaceId: "w-1", role: "manager", name: "Ann Lee" };
const inSydney: ActorResult = { kind: "actor", actor, timezone: "Australia/Sydney", workspaceName: "Lee Roofing", onboardingStep: "done" };

function provider(result: ActorResult, now = new Date("2026-10-14T03:00:00Z")) {
  const seen: Headers[] = [];
  const p = createDbDataProvider({
    actorFromHeaders: async (h) => (seen.push(h), result),
    now: () => now,
  });
  return { p, seen };
}

describe("db data provider: session → actor", () => {
  it("today is the workspace's date, not UTC's: 13:30 UTC on the 14th is already the 15th in Sydney", async () => {
    const now = new Date("2026-10-14T13:30:00Z"); // 00:30 AEDT on the 15th
    const ctx = await provider(inSydney, now).p.context(new Headers());
    expect("redirect" in ctx ? ctx : ctx.today).toBe("2026-10-15");
    expect(now.toISOString().slice(0, 10)).toBe("2026-10-14");
    const utc = await provider({ ...inSydney, timezone: "UTC" }, now).p.context(new Headers());
    expect("redirect" in utc ? utc : utc.today).toBe("2026-10-14");
  });

  it("an actor gets their services, workspace name and today, from this request's headers", async () => {
    const h = new Headers({ cookie: "x=1" });
    const { p, seen } = provider(inSydney);
    const ctx = await p.context(h);
    if ("redirect" in ctx) throw new Error("expected a context");
    expect([ctx.actor, ctx.workspaceName, ctx.today, seen]).toEqual([actor, "Lee Roofing", "2026-10-14", [h]]);
    await expect(ctx.data.projects.list({} as never)).rejects.toMatchObject({ code: "unavailable", message: NOT_READY });
  });

  it("signed out → /sign-in; no workspace yet → /onboarding", async () => {
    expect(await provider({ kind: "signed-out" }).p.context(new Headers())).toEqual({ redirect: "/sign-in" });
    expect(await provider({ kind: "no-workspace", userId: "u-1" }).p.context(new Headers())).toEqual({
      redirect: "/onboarding",
    });
  });

  it("set-up wizard: signed out → /sign-in; already in a workspace → /; otherwise the wizard as a new owner", async () => {
    expect(await provider({ kind: "signed-out" }).p.onboarding(new Headers())).toEqual({ redirect: "/sign-in" });
    expect(await provider(inSydney).p.onboarding(new Headers())).toEqual({ redirect: "/" });
    const found = await provider({ kind: "no-workspace", userId: "u-9" }).p.onboarding(new Headers());
    if ("redirect" in found) throw new Error("expected the wizard");
    expect(found.actor).toEqual({ userId: "u-9", workspaceId: NO_WORKSPACE_ACTOR_ID, role: "owner", name: "" });
    expect(Object.keys(found.service).sort()).toEqual(Object.keys(ONBOARDING_METHODS).sort());
  });

  it("an unfinished workspace (T10): the app sends its members to /onboarding, and the wizard is theirs", async () => {
    const unfinished = provider({ ...inSydney, onboardingStep: "trade" }).p;
    expect(await unfinished.context(new Headers())).toEqual({ redirect: "/onboarding" });
    const found = await unfinished.onboarding(new Headers());
    if ("redirect" in found) throw new Error("expected the wizard");
    expect(found.actor).toEqual(actor);
  });

  it("auth service is not ready yet: sign in rejects as unavailable", async () => {
    const auth = provider(inSydney).p.auth();
    await expect(auth.signIn({ email: "a@b.co", password: "x" })).rejects.toMatchObject({ code: "unavailable", message: NOT_READY });
  });
});
