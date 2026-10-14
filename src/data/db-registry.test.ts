import { afterEach, describe, expect, it } from "vitest";
import { dbData, registerDbData, type DbDataProvider } from "./db-registry";

afterEach(() => registerDbData(null));

describe("db data registry", () => {
  it("throws exactly 'The database data layer is not registered' when nothing is registered", () => {
    expect(() => dbData()).toThrow(new Error("The database data layer is not registered"));
  });

  it("answers the registered provider, and nothing again once cleared", () => {
    const provider = { auth: () => ({}) } as unknown as DbDataProvider;
    registerDbData(provider);
    expect(dbData()).toBe(provider);
    registerDbData(null);
    expect(() => dbData()).toThrow("The database data layer is not registered");
  });
});
