import { afterEach, describe, expect, it, vi } from "vitest";

const marker = { marker: "db provider" };
vi.mock("@/server/data", () => ({ dbDataProvider: marker }));
const { register } = await import("./instrumentation");
const { dbData, registerDbData } = await import("@/data/db-registry");

afterEach(() => {
  vi.unstubAllEnvs();
  registerDbData(null);
});

describe("instrumentation register()", () => {
  it("registers the database data layer on the Node.js runtime when ROOFY_DATA=db", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("ROOFY_DATA", "db");
    await register();
    expect(dbData()).toBe(marker);
  });

  it("registers nothing for the fake data, or on the edge runtime", async () => {
    for (const [runtime, mode] of [["nodejs", "fake"], ["edge", "db"], ["nodejs", ""]] as const) {
      vi.stubEnv("NEXT_RUNTIME", runtime);
      vi.stubEnv("ROOFY_DATA", mode);
      await register();
      expect(() => dbData()).toThrow("The database data layer is not registered");
    }
  });
});
