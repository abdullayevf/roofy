import { afterEach, describe, expect, it, vi } from "vitest";
import { pool } from "./client";
import { databaseName } from "./env";
import { resetTestDatabase } from "./admin";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("pool", () => {
  it.each([
    ["app", "DATABASE_URL"],
    ["auth", "AUTH_DATABASE_URL"],
    ["owner", "MIGRATE_DATABASE_URL"],
  ] as const)("names %s's missing variable %s in the error", (role, name) => {
    vi.stubEnv(name, "");
    expect(() => pool(role)).toThrow(`${name} is not set`);
  });
});

describe("resetTestDatabase", () => {
  it("refuses a database whose name does not end in _test", async () => {
    await expect(resetTestDatabase("postgres://u:p@127.0.0.1:5440/roofy_dev")).rejects.toThrow(
      /only databases ending in _test/,
    );
  });
});

describe("databaseName", () => {
  it("reads the database from a connection URL", () => {
    expect(databaseName("postgres://u:p@127.0.0.1:5440/roofy_test")).toBe("roofy_test");
  });
});
