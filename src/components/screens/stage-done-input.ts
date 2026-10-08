import type { Id, Shares } from "@/data/contracts";
import type { BasisPoints } from "@/domain/types";
import { hundredthsText, parseHundredths, shareTotalError } from "./field-input";
import { NEEDS_CONNECTION } from "./use-online";

/** "12% left to share" under 100%, "5% too much" over it, null at exactly 100% (basis points in, no money). */
export function sharesLeftText(total: number): string | null {
  if (total === 10000) return null;
  return total < 10000 ? `${hundredthsText(10000 - total)}% left to share` : `${hundredthsText(total - 10000)}% too much`;
}

/** What Confirm done sends: the proposal's equal split untouched, else the typed shares; 0% people are left out. */
export function doneSplit(
  people: { crewMemberId: Id; bp: BasisPoints }[],
  edited: boolean,
  hasLumpSum = true,
): { crewMemberIds: Id[]; shares: Shares } {
  if (!hasLumpSum) return { crewMemberIds: [], shares: { mode: "equal" } };
  if (!edited) return { crewMemberIds: people.map((p) => p.crewMemberId), shares: { mode: "equal" } };
  const kept = people.filter((p) => p.bp > 0);
  return { crewMemberIds: kept.map((p) => p.crewMemberId), shares: { mode: "custom", bp: kept.map((p) => p.bp) } };
}

/** Confirm done's hint when the stage has a lump sum but nobody has logged work on it. */
export const NOBODY_LOGGED = "Nobody has logged work on this stage yet. Log crew time first.";

/** True only when a typed share differs from the proposal's (retyping the equal split keeps equal mode, E5.1). */
export function splitEdited(proposalBp: readonly BasisPoints[], texts: readonly string[]): boolean {
  return proposalBp.some((bp, i) => parseHundredths(texts[i] ?? "") !== bp);
}

/** "Check Tom's share" for the first empty or unreadable box (never read as 0%); null when all can be read. */
export function unreadableShare(rows: readonly { name: string; text: string }[]): string | null {
  const bad = rows.find((r) => parseHundredths(r.text) === null);
  return bad ? `Check ${bad.name}'s share` : null;
}

/** The sentence under a disabled Confirm done, or undefined when it can be tapped. */
export function doneHint(s: {
  total: number;
  online: boolean;
  splitNeeded: boolean;
  unreadable?: string | null;
  nobodyLogged?: boolean;
}): string | undefined {
  if (s.nobodyLogged) return NOBODY_LOGGED;
  if (s.splitNeeded) {
    if (s.unreadable) return s.unreadable;
    const error = shareTotalError(s.total);
    if (error) return error;
  }
  return s.online ? undefined : NEEDS_CONNECTION;
}
