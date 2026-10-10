import type { Cents } from "@/domain/types";
import type { Statement } from "@/data/contracts";
import { METHOD_PHRASE } from "./crew-detail-text";

/** Pay rules §16: a contractor's statement is not their invoice. */
export const CONTRACTOR_FOOTER = "Statement only — not a tax invoice. Please send your invoice as usual.";

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

/** The statement page's own link, copied where there is no share sheet. */
export const LINK_COPIED = "Link copied.";

/** An expired, turned-off or made-up link: one plain sentence, nothing about the person or the business. */
export const STATEMENT_GONE = "This statement link has expired or been turned off. Ask for a new one.";
