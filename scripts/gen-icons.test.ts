import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ICON_TARGETS } from "./gen-icons";

const root = join(__dirname, "..");

describe("committed icons", () => {
  it.each(ICON_TARGETS)("$file is a $size px PNG", ({ file, size }) => {
    expect(existsSync(join(root, file))).toBe(true);
    const buf = readFileSync(join(root, file));
    expect(buf.subarray(1, 4).toString()).toBe("PNG");
    expect(buf.readUInt32BE(16)).toBe(size);
    expect(buf.readUInt32BE(20)).toBe(size);
  });
  it("the SVG mark is plain: no gradients, no filters", () => {
    const svg = readFileSync(join(root, "scripts", "icon.svg"), "utf8");
    expect(svg).not.toMatch(/gradient|filter|<image/i);
  });
});
