import type { CrewRowForeman, CrewRowManager } from "@/data/contracts";
import type { Cents, RateBasis, Unit, WorkerType } from "@/domain/types";
import { formatDate, formatMoney } from "@/lib/format";

export const typeLabel = (type: WorkerType): string => (type === "employee" ? "Employee" : "Contractor");

/** How the person is usually paid, in words. It never carries a rate: the foreman's row reads it too. */
export function payBasisLabel(basis: RateBasis, unit: Unit | null): string {
  if (basis === "daily") return "Paid by the day";
  if (basis === "hourly") return "Paid by the hour";
  if (unit === "m2") return "Paid per m²";
  if (unit === "lm") return "Paid per lm";
  if (unit === "each") return "Paid per item";
  return "Paid per unit";
}

/** The line under a name: type, level (manager only), how they are paid, and Inactive once they have left. */
export function crewLine(row: CrewRowForeman | CrewRowManager): string {
  const level = "level" in row ? row.level?.name : undefined;
  return [typeLabel(row.type), level, payBasisLabel(row.defaultBasis, row.defaultUnit), row.active ? undefined : "Inactive"]
    .filter((p): p is string => Boolean(p))
    .join(" · ");
}

export type BalanceView = { kind: "owed" | "ahead" | "clear"; amount: string; word: string };

/**
 * A ledger balance in plain words. Positive = the business owes the person; negative = they were paid ahead
 * (an advance bigger than what they have earned). The amount is always shown without a sign.
 */
export function balanceView(cents: Cents): BalanceView {
  if (cents > 0) return { kind: "owed", amount: formatMoney(cents), word: "Owed" };
  if (cents < 0) return { kind: "ahead", amount: formatMoney(-cents), word: "Paid ahead" };
  return { kind: "clear", amount: formatMoney(0), word: "Nothing owed" };
}

export function lastLoggedText(date: string | null, today: string): string {
  return date === null ? "Not logged yet" : `Last logged ${formatDate(date, today)}`;
}

/** The headline on the list: how many people are owed money right now. */
export function owedCountText(rows: Pick<CrewRowManager, "balanceCents">[]): string {
  const n = rows.filter((r) => r.balanceCents > 0).length;
  return n === 0 ? "No one is owed" : n === 1 ? "Owed to 1 person" : `Owed to ${n} people`;
}
