import type { PayFlag, PayPeriod, PayRunListItem } from "@/data/contracts";
import { formatDate } from "@/lib/format";

/** The latest runs the list shows before "Show older pay runs". */
export const RUNS_SHOWN = 8;

/** "Show older pay runs" / "Show fewer pay runs": the one button under the list. */
export const olderRunsLabel = (open: boolean): string => (open ? "Show fewer pay runs" : "Show older pay runs");

/** A date that never breaks inside itself: "Mon 21 Sep" (and "Mon 29 Dec 2025") joined with non-breaking spaces. */
const wholeDate = (date: string, today: string): string => formatDate(date, today).replace(/ /g, "\u00a0");

/** "Mon 21 Sep to Sun 27 Sep": one wording for a pay period across the list and the review; it can only break at "to". */
export const payRunPeriodText = (period: PayPeriod, today: string): string => `${wholeDate(period.start, today)} to ${wholeDate(period.end, today)}`;

/** "4 people", the number kept with its word. */
export function peopleCountText(count: number): string {
  if (count === 0) return "No one yet";
  return count === 1 ? "1 person" : `${count} people`;
}

/** The draft's flag line: how many things to check and what stops approval, worded for who is reading. */
export function draftFlagsText(flags: PayFlag[], role: "owner" | "manager" | "accountant"): string {
  if (flags.length === 0) return role === "accountant" ? "Nothing to check in this pay run." : "Nothing to check before you approve.";
  const things = flags.length === 1 ? "1 thing to check" : `${flags.length} things to check`;
  if (role === "accountant") return `${things} in this pay run.`;
  // One sentence (lesson 3, pay iter2 N5): "6 things to check, and Jake's missing rate stops approval."
  const [first, ...rest] = flags.filter((f) => f.blocking);
  if (!first) return `${things} before you approve.`;
  const what =
    first.kind === "owner_2fa_off" ? "two-factor sign-in being off" : first.crewName ? `${first.crewName}'s missing rate` : "a missing rate";
  return rest.length === 0 ? `${things}, and ${what} stops approval.` : `${things}, and ${what} and ${rest.length} more stop approval.`;
}

/**
 * The draft to review now on its own, then every other run newest first. A draft with no one in it yet (no one has logged
 * on it) is left out whatever its dates: there is nothing to open. The draft to review stays whatever it holds.
 */
export function splitRuns(runs: PayRunListItem[], reviewId: string | null): { review: PayRunListItem | null; others: PayRunListItem[] } {
  const review = runs.find((r) => r.id === reviewId) ?? null;
  const others = runs
    .filter((r) => r !== review && !(r.status === "draft" && r.peopleCount === 0))
    .sort((a, b) => b.period.start.localeCompare(a.period.start));
  return { review, others };
}
