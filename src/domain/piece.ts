import { perUnitAmount } from "./lines";
import { splitByShares, type Shares } from "./split";
import type { Cents, Hundredths, Unit } from "./types";

export interface SplitMember {
  crewMemberId: string;
  rateCents: Cents | null;
}

export interface PieceLine {
  crewMemberId: string;
  quantity: Hundredths;
  hours: 0;
  rateCents: Cents | null;
  amountCents: Cents;
  missingRate: boolean;
}

/** Pay rules §4. Hours are 0: the crew-day grid records hours once (E4.4). */
export function pieceRateLines(
  quantity: Hundredths,
  unit: Unit,
  members: readonly SplitMember[],
  shares: Shares,
): PieceLine[] {
  if (members.length === 0) throw new RangeError("at least one crew member is required");
  if (quantity <= 0) throw new RangeError("quantity must be positive");
  const step = unit === "each" ? 100 : 1;
  if (quantity % step !== 0) throw new RangeError("'each' quantities must be whole numbers");
  const parts = splitByShares(quantity / step, members.length, shares).map((q) => q * step);
  return members.map((m, i) => {
    const q = parts[i]!;
    return {
      crewMemberId: m.crewMemberId,
      quantity: q,
      hours: 0,
      rateCents: m.rateCents,
      amountCents: m.rateCents === null || q === 0 ? 0 : perUnitAmount(q, m.rateCents),
      missingRate: m.rateCents === null,
    };
  });
}

export interface LumpLine {
  crewMemberId: string;
  amountCents: Cents;
  hours: 0;
}

/** Pay rules §5. */
export function lumpSumLines(
  amountCents: Cents,
  crewMemberIds: readonly string[],
  shares: Shares,
): LumpLine[] {
  if (crewMemberIds.length === 0) throw new RangeError("at least one crew member is required");
  const parts = splitByShares(amountCents, crewMemberIds.length, shares);
  return crewMemberIds.map((crewMemberId, i) => ({ crewMemberId, amountCents: parts[i]!, hours: 0 }));
}
