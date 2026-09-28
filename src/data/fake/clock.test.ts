import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FAKE_NOW, FAKE_TIMEZONE, fakeNow, fakeToday } from "./clock";

afterEach(() => vi.unstubAllEnvs());

describe("fake clock", () => {
  it("defaults to 2026-09-27T21:00:00Z, which is Mon 28 Sep 2026 at 7 a.m. in Sydney", () => {
    vi.stubEnv("ROOFY_FAKE_NOW", undefined);
    expect(DEFAULT_FAKE_NOW).toBe("2026-09-27T21:00:00Z");
    expect(FAKE_TIMEZONE).toBe("Australia/Sydney");
    expect(fakeNow().toISOString()).toBe("2026-09-27T21:00:00.000Z");
    // Sunday in UTC, Monday in the workspace timezone.
    expect(fakeNow().getUTCDay()).toBe(0);
    expect(fakeToday()).toBe("2026-09-28");
  });

  it("follows ROOFY_FAKE_NOW, in the workspace timezone (daylight saving from 4 Oct)", () => {
    vi.stubEnv("ROOFY_FAKE_NOW", "2026-10-04T14:30:00Z");
    expect(fakeNow().toISOString()).toBe("2026-10-04T14:30:00.000Z");
    expect(fakeToday()).toBe("2026-10-05");
    vi.stubEnv("ROOFY_FAKE_NOW", "2026-09-28T13:59:00Z");
    expect(fakeToday()).toBe("2026-09-28");
    vi.stubEnv("ROOFY_FAKE_NOW", "2026-09-28T14:00:00Z");
    expect(fakeToday()).toBe("2026-09-29");
  });

  it("returns a fresh Date each call", () => {
    vi.stubEnv("ROOFY_FAKE_NOW", undefined);
    const a = fakeNow();
    a.setUTCFullYear(2000);
    expect(fakeNow().getUTCFullYear()).toBe(2026);
  });

  it("rejects an unparseable ROOFY_FAKE_NOW", () => {
    vi.stubEnv("ROOFY_FAKE_NOW", "next tuesday");
    expect(() => fakeNow()).toThrow(/ROOFY_FAKE_NOW/);
  });
});
