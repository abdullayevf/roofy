import type { CrewDetail, LedgerRow, PayoutMethod, RateDto, StatementRef } from "@/data/contracts";
import type { Cents, RateBasis, Unit } from "@/domain/types";
import { formatDate } from "@/lib/format";
import { balanceView, typeLabel } from "./crew-input";

/** The words under a rate's amount, in the order a manager reads them: day, hour, then each unit. */
const BASIS_ORDER: Record<RateBasis, number> = { daily: 0, hourly: 1, per_unit: 2 };

const UNIT_NAME: Record<Unit, string> = { m2: "m²", lm: "lm", each: "item" };

function rateName(rate: Pick<RateDto, "basis" | "unit">): string {
  if (rate.basis === "daily") return "Daily rate";
  if (rate.basis === "hourly") return "Hourly rate";
  return rate.unit ? `Rate per ${UNIT_NAME[rate.unit]}` : "Rate per unit";
}

export type RateRow = { key: string; primary: string; meta: string; cents: Cents };

/**
 * Every rate the person has, in reading order: the day rate, the hourly rate, then per-unit rates; a job's own rate
 * straight after the general one it overrides; inside each, newest first so the current rate leads and history follows.
 */
export function rateRows(rates: RateDto[], today: string): RateRow[] {
  return [...rates]
    .sort(
      (a, b) =>
        BASIS_ORDER[a.basis] - BASIS_ORDER[b.basis] ||
        (a.unit ?? "").localeCompare(b.unit ?? "") ||
        Number(a.project !== null) - Number(b.project !== null) ||
        (a.project?.name ?? "").localeCompare(b.project?.name ?? "") ||
        b.effectiveFrom.localeCompare(a.effectiveFrom),
    )
    .map((r) => {
      const when = formatDate(r.effectiveFrom, today);
      const meta = r.effectiveFrom > today ? `Starts ${when}` : `From ${when}, ${r.current ? "current" : "replaced"}`;
      return { key: r.id, primary: r.project ? `${rateName(r)}, ${r.project.name} only` : rateName(r), meta, cents: r.amountCents };
    });
}

const METHOD_PHRASE: Record<PayoutMethod, string> = { bank_transfer: " by bank transfer", cash: " in cash", other: "" };

export type LedgerEntry = { key: string; primary: string; meta: string; cents: Cents };

/**
 * One ledger line. A pay run adds to what the person is owed (a plain amount); an advance or a payment takes it off
 * (a minus). The line under it says the date, any note, and where the balance stood once it was in.
 */
export function ledgerEntry(row: LedgerRow, today: string): LedgerEntry {
  const after = balanceView(row.balanceAfterCents);
  const afterText = after.kind === "clear" ? "Nothing owed after" : `${after.word} ${after.amount} after`;
  const date = row.note ? `${formatDate(row.date, today)}, ${row.note}` : formatDate(row.date, today);
  const method = row.method ? METHOD_PHRASE[row.method] : "";
  if (row.kind === "payrun_credit") return { key: row.id, primary: "Pay run", meta: `${date}. ${afterText}`, cents: row.amountCents };
  const name = row.kind === "advance" ? "Advance" : "Payment";
  return { key: row.id, primary: `${name}${method}`, meta: `${date}. ${afterText}`, cents: -row.amountCents };
}

/** The sentence under the balance figure: who owes whom, in words, with no sign to decode. */
export function balanceSentence(name: string, balanceCents: Cents, owedTooLong: boolean): string {
  if (balanceCents > 0) return owedTooLong ? `You have owed ${name} this for a long time.` : `You owe ${name} this much.`;
  if (balanceCents < 0) return `You have paid ${name} this much more than they have earned so far.`;
  return `You and ${name} are square.`;
}

/** Type, level or ABN, and whether they have left: the line under the name. */
export function headerLine(
  d: Pick<CrewDetail, "type" | "abn" | "gstRegistered" | "activeTo"> & { level: { name: string } | null },
  today: string,
): string {
  const parts: (string | null)[] = [typeLabel(d.type), d.level?.name ?? null];
  if (d.type === "contractor") parts.push(d.abn ? `ABN ${d.abn}` : "No ABN yet");
  if (d.gstRegistered) parts.push("Charges GST");
  if (d.activeTo) parts.push(`${d.activeTo < today ? "Left" : "Leaves"} ${formatDate(d.activeTo, today)}`);
  return parts.filter((p): p is string => Boolean(p)).join(" · ");
}

/** A phone number as a link a phone can dial: digits and a leading plus only. */
export const phoneHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, "")}`;

export function statementPeriodText(period: StatementRef["period"], today: string): string {
  return `${formatDate(period.start, today)} to ${formatDate(period.end, today)}`;
}

/** How much of the last four weeks they worked, or nothing when they weren't down to work. */
export function utilisationText(u: CrewDetail["utilisation"]): string | null {
  return u.availableDays > 0 ? `Worked ${u.workedDays} of ${u.availableDays} days in the last 4 weeks` : null;
}
