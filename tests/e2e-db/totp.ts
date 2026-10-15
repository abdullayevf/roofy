import { createHmac } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32 to bytes. Spaces, dashes, case and `=` padding are ignored: the setup screen shows the key in groups of four. */
export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error(`"${char}" is not a base32 character.`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

/**
 * The RFC 6238 time-based code (HMAC-SHA1, 30 s, 6 digits: Better Auth's defaults) for the base32 key the two-factor
 * setup screen shows. `nowMs` is injectable for the RFC test vectors. Better Auth accepts one step either side.
 */
export function totpCode(secret: string, { nowMs = Date.now(), digits = 6, periodSeconds = 30 } = {}): string {
  const counter = Math.floor(nowMs / 1000 / periodSeconds);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", base32Decode(secret)).update(message).digest();
  const offset = (mac.at(-1) ?? 0) & 0x0f;
  const binary = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, "0");
}
