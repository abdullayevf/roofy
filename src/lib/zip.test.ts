import { describe, expect, it } from "vitest";
import { makeZip } from "./zip";

/** Reads the stored entries back out of a zip, checking the end record and each header on the way. */
function readZip(zip: Uint8Array) {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.byteLength - 22;
  expect(v.getUint32(end, true)).toBe(0x06054b50);
  const count = v.getUint16(end + 10, true);
  let at = v.getUint32(end + 16, true);
  const out: { name: string; body: string }[] = [];
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(at, true)).toBe(0x02014b50);
    const size = v.getUint32(at + 24, true);
    const nameLen = v.getUint16(at + 28, true);
    const local = v.getUint32(at + 42, true);
    const name = new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLen));
    expect(v.getUint32(local, true)).toBe(0x04034b50);
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    out.push({ name, body: new TextDecoder().decode(zip.subarray(start, start + size)) });
    at += 46 + nameLen;
  }
  return out;
}

describe("makeZip", () => {
  it("stores each file under its name, readable back byte for byte", () => {
    const files = [
      { name: "jobs.csv", body: "id,name\n1,Smith job\n" },
      { name: "empty.csv", body: "" },
      { name: "crew.csv", body: "id,name\n1,Dímá\n" },
    ];
    expect(readZip(makeZip(files))).toEqual(files);
  });

  it("writes the standard checksum of each file", () => {
    const zip = makeZip([{ name: "a.txt", body: "123456789" }]);
    // The CRC-32 check value for "123456789" is 0xCBF43926; it sits at byte 14 of the first header.
    expect(new DataView(zip.buffer, zip.byteOffset).getUint32(14, true)).toBe(0xcbf43926);
  });

  it("makes an empty archive with no files", () => {
    expect(readZip(makeZip([]))).toEqual([]);
  });
});
