import type { CrewRowForeman, CrewRowManager } from "@/data/contracts";
import type { Cents, RateBasis, Unit, WorkerType } from "@/domain/types";
import { formatDate, formatMoney } from "@/lib/format";

export const typeLabel = (type: WorkerType): string => (type === "employee" ? "Employee" : "Contractor");

/** Spaces that must not wrap: "yr 1" and "by the day" never split across two lines. */
const glue = (text: string): string => text.replace(/ /g, "\u00a0");
/** A level such as "Apprentice yr 1": the number stays with the word before it. */
export const levelText = (name: string): string => name.replace(/ (?=\d+$)/, "\u00a0");

/** How the person is usually paid, in words. It never carries a rate: the foreman's row reads it too. */
export function payBasisLabel(basis: RateBasis, unit: Unit | null): string {
  if (basis === "daily") return glue("Paid by the day");
  if (basis === "hourly") return glue("Paid by the hour");
  if (unit === "m2") return glue("Paid per m²");
  if (unit === "lm") return glue("Paid per lm");
  if (unit === "each") return glue("Paid per item");
  return glue("Paid per unit");
}

/**
 * The line under a name, as plain sentences: type and level (manager only), then how they are paid. Whether they have left
 * is a chip of its own, not part of this line.
 */
export function crewLine(row: CrewRowForeman | CrewRowManager): string {
  const level = "level" in row && row.level ? levelText(row.level.name) : undefined;
  return `${[typeLabel(row.type), level].filter(Boolean).join(", ")}. ${payBasisLabel(row.defaultBasis, row.defaultUnit)}.`;
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

/** The date alone, for a column already headed "Last logged". */
export function lastLoggedDate(date: string | null, today: string): string {
  return date === null ? "Not logged yet" : formatDate(date, today);
}

export function lastLoggedText(date: string | null, today: string): string {
  return date === null ? "Not logged yet" : `Last logged ${formatDate(date, today)}`;
}

/** The headline on the list: how many people are owed money right now. */
export function owedCountText(rows: Pick<CrewRowManager, "balanceCents">[]): string {
  const n = rows.filter((r) => r.balanceCents > 0).length;
  return n === 0 ? "No one is owed" : n === 1 ? "Owed to 1 person" : `Owed to ${n} people`;
}
