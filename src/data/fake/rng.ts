/**
 * Seeded pseudo-random numbers for the fake seed. Floats here only choose things (who, which day,
 * how many m²); money is never derived from them except through integer draws and `src/domain`.
 */

/** mulberry32: a small, fast 32-bit PRNG. Returns a generator of floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export class Rng {
  private readonly next: () => number;

  constructor(seed: number) {
    this.next = mulberry32(seed);
  }

  float(): number {
    return this.next();
  }

  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) {
      throw new RangeError(`bad integer range [${min}, ${max}]`);
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError("cannot pick from an empty list");
    return items[this.int(0, items.length - 1)]!;
  }

  /** An unsigned 32-bit integer. */
  u32(): number {
    return Math.floor(this.next() * 4_294_967_296);
  }

  hex(digits: number): string {
    let out = "";
    while (out.length < digits) out += hex8(this.u32());
    return out.slice(0, digits);
  }

  /** A deterministic UUID-shaped id (version 4 layout). */
  uuid(): string {
    const d = this.u32();
    const h = hex8(this.u32()) + hex8(this.u32()) + hex8(this.u32()) + hex8(d);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${"89ab"[d & 3]}${h.slice(17, 20)}-${h.slice(20, 32)}`;
  }
}

const hex8 = (n: number) => n.toString(16).padStart(8, "0");
