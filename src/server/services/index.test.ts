import { describe, expect, it } from "vitest";
import { DataError, type Actor } from "@/data/contracts";
import { createDbOnboarding, createDbServices, DATA_SERVICE_METHODS, NOT_READY, ONBOARDING_METHODS } from "./index";
import { createWorkspaceService } from "./workspace";

/** Methods with a real implementation, read from the services themselves (never a hand list). */
const BUILT_METHODS: Record<string, readonly string[]> = { workspace: Object.keys(createWorkspaceService()) };
const isBuilt = (service: string, method: string) => (BUILT_METHODS[service] ?? []).includes(method);

const actor: Actor = { userId: "u-1", workspaceId: "w-1", role: "owner", name: "Ann Lee" };

async function refusal(p: unknown): Promise<DataError> {
  expect(p).toBeInstanceOf(Promise);
  return (p as Promise<unknown>).then(
    () => expect.fail("expected a refusal"),
    (e: unknown) => {
      expect(e).toBeInstanceOf(DataError);
      return e as DataError;
    },
  );
}

describe("createDbServices (until each real service lands)", () => {
  it("has every DataServices service, and only those", () => {
    expect(Object.keys(createDbServices(actor)).sort()).toEqual(Object.keys(DATA_SERVICE_METHODS).sort());
  });

  it("every method not built yet rejects with unavailable and 'This part isn't ready yet.'", async () => {
    expect(NOT_READY).toBe("This part isn't ready yet.");
    const services = createDbServices(actor) as unknown as Record<string, Record<string, (...a: unknown[]) => unknown>>;
    let count = 0;
    for (const [service, methods] of Object.entries(DATA_SERVICE_METHODS)) {
      expect(Object.keys(services[service]!).sort()).toEqual(Object.keys(methods).sort());
      for (const method of Object.keys(methods)) {
        if (isBuilt(service, method)) continue;
        const e = await refusal(services[service]![method]!());
        expect([service, method, e.code, e.message, e.issues]).toEqual([service, method, "unavailable", NOT_READY, []]);
        count++;
      }
    }
    const all = Object.values(DATA_SERVICE_METHODS).reduce((n, m) => n + Object.keys(m).length, 0);
    const built = Object.values(BUILT_METHODS).reduce((n, m) => n + m.length, 0);
    expect(built).toBeGreaterThan(0);
    expect(count).toBe(all - built);
  });

  it("built methods are the real ones, and every one is a method of its service", () => {
    const services = createDbServices(actor) as unknown as Record<string, Record<string, unknown>>;
    const real = { workspace: createWorkspaceService() } as unknown as Record<string, Record<string, unknown>>;
    for (const [service, methods] of Object.entries(BUILT_METHODS)) {
      for (const method of methods) {
        expect(Object.keys(DATA_SERVICE_METHODS[service as keyof typeof DATA_SERVICE_METHODS])).toContain(method);
        expect(String(services[service]![method])).toBe(String(real[service]![method]));
      }
    }
  });

  it("the set-up wizard is built: every method in the contract list is a real function, none a placeholder", async () => {
    const service = createDbOnboarding({ userId: "u-1" }) as unknown as Record<string, unknown>;
    expect(Object.keys(service).sort()).toEqual(Object.keys(ONBOARDING_METHODS).sort());
    for (const method of Object.keys(ONBOARDING_METHODS)) {
      expect(typeof service[method], method).toBe("function");
      // A set-up user (no workspace yet) is answered before any connection: never "not ready".
      const e = await refusal((service[method] as (a: Actor) => Promise<unknown>)({ ...actor, userId: "u-2" }));
      expect([method, e.code]).toEqual([method, "forbidden"]);
    }
  });
});
