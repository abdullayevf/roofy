import type { Cents } from "@/domain/types";
import type { Statement } from "@/data/contracts";
import { formatDate } from "@/lib/format";
import { METHOD_PHRASE } from "./crew-detail-text";

/** Pay rules §16: a contractor's statement is not their invoice. */
export const CONTRACTOR_FOOTER = "This is a statement. It is not a tax invoice. Please send your invoice as usual.";

export function statementFooter(s: Pick<Statement, "contractorFooter">): string | null {
  return s.contractorFooter ? CONTRACTOR_FOOTER : null;
}

type Payout = Pick<Statement["payouts"][number], "kind" | "method">;

/** "Advance in cash", "Payment by bank transfer", or just "Payment" when no method was kept. */
export function statementPayoutText(p: Payout): string {
  return `${p.kind === "advance" ? "Advance" : "Payment"}${p.method ? METHOD_PHRASE[p.method] : ""}`;
}

/** Where the person stands once this pay run and the period's payouts are in, said to them in words. */
export function statementBalance(cents: Cents): { label: string; cents: Cents } {
  if (cents > 0) return { label: "Still owed to you", cents };
  if (cents < 0) return { label: "Paid ahead", cents: -cents };
  return { label: "Nothing owed", cents: 0 };
}

/** The balance carried in from before this pay run, in words: "Owed from earlier" or "Paid ahead earlier". */
export function statementEarlier(cents: Cents): { label: string; cents: Cents } {
  return cents < 0 ? { label: "Paid ahead earlier", cents: -cents } : { label: "Owed from earlier", cents };
}

/** The statement page's own link, copied where there is no share sheet. */
export const LINK_COPIED = "Link copied.";

/** An expired, turned-off or made-up link: one plain sentence, nothing about the person or the business. */
export const STATEMENT_GONE = "This statement link has expired or been turned off. Ask for a new one.";

/**
 * "Paid to you", or "Paid to you up to Mon 21 Sep" when a payout is dated after the period (pay iter2 N6), so a payout
 * outside the period's dates is never left unexplained. The date never breaks inside itself.
 */
export function statementPaidLabel(period: Pick<Statement["period"], "end">, payouts: { date: string }[], today: string): string {
  const last = payouts.reduce((a, p) => (p.date > a ? p.date : a), period.end);
  return last > period.end ? `Paid to you up to ${formatDate(last, today).replace(/ /g, "\u00a0")}` : "Paid to you";
}
