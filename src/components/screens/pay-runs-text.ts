import type { PayFlag, PayPeriod, PayRunListItem } from "@/data/contracts";
import { statementPeriodText } from "./crew-detail-text";
import { payFlagsText } from "./home-text";

/** "Mon 21 Sep to Sun 27 Sep": one wording for a pay period across the list, the review and statements. */
export const payRunPeriodText = (period: PayPeriod, today: string): string => statementPeriodText(period, today);

/** "4 people", the number kept with its word. */
export function peopleCountText(count: number): string {
  if (count === 0) return "No one yet";
  return count === 1 ? "1 person" : `${count} people`;
}

/** The draft's flag line: how many things to check and what stops approval, worded for who is reading. */
export function draftFlagsText(flags: PayFlag[], role: "owner" | "manager" | "accountant"): string {
  if (flags.length === 0) return role === "accountant" ? "Nothing to check in this pay run." : "Nothing to check before you approve.";
  const blockers = flags.filter((f) => f.blocking).map((f) => ({ kind: f.kind as "missing_rate" | "owner_2fa_off", crewName: f.crewName }));
  return payFlagsText(flags.length, blockers, role);
}

/** The draft to review now on its own, then every other run newest first. */
export function splitRuns(runs: PayRunListItem[], reviewId: string | null): { review: PayRunListItem | null; others: PayRunListItem[] } {
  const review = runs.find((r) => r.id === reviewId) ?? null;
  const others = runs.filter((r) => r !== review).sort((a, b) => b.period.start.localeCompare(a.period.start));
  return { review, others };
}
