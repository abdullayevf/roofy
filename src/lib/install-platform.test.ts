import { describe, expect, it } from "vitest";
import { detectPlatform, parsePlatform } from "./install-platform";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
const DESKTOP = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

describe("detectPlatform", () => {
  it("reads iPhone and iPad as iOS", () => {
    expect(detectPlatform(IPHONE)).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15")).toBe("ios");
  });
  it("reads Android Chrome as Android", () => expect(detectPlatform(ANDROID)).toBe("android"));
  it("reads anything else, and a missing header, as desktop", () => {
    expect(detectPlatform(DESKTOP)).toBe("desktop");
    expect(detectPlatform(null)).toBe("desktop");
    expect(detectPlatform("")).toBe("desktop");
  });
});

describe("parsePlatform", () => {
  it("accepts the three names (first of a repeated value) and nothing else", () => {
    expect(parsePlatform("ios")).toBe("ios");
    expect(parsePlatform(["android", "ios"])).toBe("android");
    expect(parsePlatform("desktop")).toBe("desktop");
    expect(parsePlatform("windows")).toBeNull();
    expect(parsePlatform(undefined)).toBeNull();
  });
});
