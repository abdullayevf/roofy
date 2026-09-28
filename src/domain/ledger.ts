import { daysBetween } from "./dates";
import { sum } from "./money";
import type { Cents, LocalDate } from "./types";

export type LedgerKind = "payrun_credit" | "advance" | "payment";

export interface LedgerEntry {
  date: LocalDate;
  kind: LedgerKind;
  /** Always positive; kind decides the sign. */
  amountCents: Cents;
}

const isCredit = (e: LedgerEntry) => e.kind === "payrun_credit";

/** Pay rules §15. Positive = the business owes the person. */
export function ledgerBalance(entries: readonly LedgerEntry[]): Cents {
  return sum(entries.map((e) => (isCredit(e) ? e.amountCents : 0 - e.amountCents)));
}

/** Debits pay off credits oldest first; returns the date of the first credit not fully paid. */
export function oldestUnpaidCreditDate(entries: readonly LedgerEntry[]): LocalDate | null {
  let debits = sum(entries.filter((e) => !isCredit(e)).map((e) => e.amountCents));
  const credits = entries.filter(isCredit).sort((a, b) => a.date.localeCompare(b.date));
  for (const c of credits) {
    if (debits < c.amountCents) return c.date;
    debits -= c.amountCents;
  }
  return null;
}

export function unpaidTooLong(entries: readonly LedgerEntry[], asOf: LocalDate, periodDays: number): boolean {
  const oldest = oldestUnpaidCreditDate(entries);
  return oldest !== null && daysBetween(oldest, asOf) > periodDays;
}
