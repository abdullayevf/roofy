/**
 * A minimal zip writer for the prototype's workspace export: every file is stored as it is (no compression), names are
 * UTF-8, and the time stamp is fixed so the same files always make the same bytes. Real exports are made by the server
 * in Phase 3; this keeps the download real enough to open.
 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** 28 Sep 2026, 7:00 a.m. as a DOS date and time. */
const DOS_DATE = ((2026 - 1980) << 9) | (9 << 5) | 28;
const DOS_TIME = 7 << 11;
const FLAG_UTF8 = 0x0800;

export function makeZip(files: { name: string; body: string }[]): Uint8Array {
  const enc = new TextEncoder();
  const entries = files.map((f) => ({ name: enc.encode(f.name), data: enc.encode(f.body) }));
  const local = entries.reduce((n, e) => n + 30 + e.name.length + e.data.length, 0);
  const central = entries.reduce((n, e) => n + 46 + e.name.length, 0);
  const out = new Uint8Array(local + central + 22);
  const v = new DataView(out.buffer);
  let at = 0;
  const offsets: number[] = [];
  for (const e of entries) {
    offsets.push(at);
    v.setUint32(at, 0x04034b50, true);
    v.setUint16(at + 4, 20, true); // version needed
    v.setUint16(at + 6, FLAG_UTF8, true);
    v.setUint16(at + 8, 0, true); // stored
    v.setUint16(at + 10, DOS_TIME, true);
    v.setUint16(at + 12, DOS_DATE, true);
    v.setUint32(at + 14, crc32(e.data), true);
    v.setUint32(at + 18, e.data.length, true);
    v.setUint32(at + 22, e.data.length, true);
    v.setUint16(at + 26, e.name.length, true);
    v.setUint16(at + 28, 0, true);
    out.set(e.name, at + 30);
    out.set(e.data, at + 30 + e.name.length);
    at += 30 + e.name.length + e.data.length;
  }
  const centralStart = at;
  entries.forEach((e, i) => {
    v.setUint32(at, 0x02014b50, true);
    v.setUint16(at + 4, 20, true); // made by
    v.setUint16(at + 6, 20, true); // version needed
    v.setUint16(at + 8, FLAG_UTF8, true);
    v.setUint16(at + 10, 0, true);
    v.setUint16(at + 12, DOS_TIME, true);
    v.setUint16(at + 14, DOS_DATE, true);
    v.setUint32(at + 16, crc32(e.data), true);
    v.setUint32(at + 20, e.data.length, true);
    v.setUint32(at + 24, e.data.length, true);
    v.setUint16(at + 28, e.name.length, true);
    v.setUint32(at + 42, offsets[i]!, true);
    out.set(e.name, at + 46);
    at += 46 + e.name.length;
  });
  v.setUint32(at, 0x06054b50, true);
  v.setUint16(at + 8, entries.length, true);
  v.setUint16(at + 10, entries.length, true);
  v.setUint32(at + 12, central, true);
  v.setUint32(at + 16, centralStart, true);
  return out;
}
