import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTestEnv, databaseName, requireEnv } from "./env";

const TEST_URL = "postgres://app:pw@127.0.0.1:5440/roofy_test";
const TEST_AUTH_URL = "postgres://auth:pw@127.0.0.1:5440/roofy_test";
const TEST_OWNER_URL = "postgres://owner:pw@127.0.0.1:5440/roofy_test";

beforeEach(() => {
  vi.stubEnv("TEST_DATABASE_URL", TEST_URL);
  vi.stubEnv("TEST_AUTH_DATABASE_URL", TEST_AUTH_URL);
  vi.stubEnv("TEST_MIGRATE_DATABASE_URL", TEST_OWNER_URL);
  vi.stubEnv("DATABASE_URL", "postgres://app:pw@127.0.0.1:5440/roofy_dev");
  vi.stubEnv("AUTH_DATABASE_URL", "postgres://auth:pw@127.0.0.1:5440/roofy_dev");
  vi.stubEnv("MIGRATE_DATABASE_URL", "postgres://owner:pw@127.0.0.1:5440/roofy_dev");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("databaseName", () => {
  it("reads the database from a connection URL", () => {
    expect(databaseName(TEST_URL)).toBe("roofy_test");
  });
});

describe("requireEnv", () => {
  it("names the missing variable in a plain error", () => {
    vi.stubEnv("SOME_MISSING_VAR", "");
    expect(() => requireEnv("SOME_MISSING_VAR")).toThrow(
      "SOME_MISSING_VAR is not set. Add it to .env (see .env.example).",
    );
  });
});

describe("applyTestEnv", () => {
  it("points the three app-facing variables at the test database", () => {
    applyTestEnv();
    expect(process.env.DATABASE_URL).toBe(TEST_URL);
    expect(process.env.AUTH_DATABASE_URL).toBe(TEST_AUTH_URL);
    expect(process.env.MIGRATE_DATABASE_URL).toBe(TEST_OWNER_URL);
  });

  it.each(["TEST_DATABASE_URL", "TEST_AUTH_DATABASE_URL", "TEST_MIGRATE_DATABASE_URL"])(
    "refuses when %s names roofy_dev, and changes nothing",
    (name) => {
      vi.stubEnv(name, "postgres://u:p@127.0.0.1:5440/roofy_dev");
      expect(() => applyTestEnv()).toThrow(`${name} must point at the database roofy_test.`);
      expect(process.env.DATABASE_URL).toMatch(/roofy_dev$/);
      expect(process.env.AUTH_DATABASE_URL).toMatch(/roofy_dev$/);
      expect(process.env.MIGRATE_DATABASE_URL).toMatch(/roofy_dev$/);
    },
  );

  it("refuses another database that merely ends in _test", () => {
    vi.stubEnv("TEST_DATABASE_URL", "postgres://u:p@127.0.0.1:5440/other_test");
    expect(() => applyTestEnv()).toThrow("must point at the database roofy_test");
  });

  it("throws the plain missing-variable error when a test URL is absent", () => {
    vi.stubEnv("TEST_AUTH_DATABASE_URL", "");
    expect(() => applyTestEnv()).toThrow("TEST_AUTH_DATABASE_URL is not set");
  });
});
