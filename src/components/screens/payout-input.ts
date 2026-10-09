/**
 * Record payout (flows.md screen 20): the form's values, what is missing, and the save input. Amounts are integer
 * cents read by `src/domain/money` (never a float); unreadable text is refused, never saved as $0.00.
 */
import type { PayoutInput, PayoutMethod } from "@/data/contracts";
import type { Cents } from "@/domain/types";
import { toCents } from "@/domain/money";

export type PayoutKind = PayoutInput["kind"];

export type PayoutFormValues = {
  date: string;
  /** Integer cents; null when blank; "unreadable" when the text can't be read as dollars and cents. */
  amountCents: Cents | null | "unreadable";
  /** Neither defaults on: both carry real consequences (flows.md "Record a payout"). */
  kind: PayoutKind | "";
  method: PayoutMethod;
  note: string;
};

export const AMOUNT_MISSING = "Add an amount before saving.";
export const AMOUNT_UNREADABLE = "Enter an amount in dollars and cents, like 1,482.00.";
export const KIND_MISSING = "Choose Advance or Payment.";
const DATE_MISSING = "Add the date it was paid.";

export const PAYOUT_KINDS: { value: PayoutKind; label: string }[] = [
  { value: "advance", label: "Advance" },
  { value: "payment", label: "Payment" },
];

export const PAYOUT_METHODS: { value: PayoutMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "other", label: "Other" },
];

/** A new payout: dated today (workspace timezone), no amount, neither Advance nor Payment, paid by bank transfer. */
export function emptyPayout(today: string): PayoutFormValues {
  return { date: today, amountCents: null, kind: "", method: "bank_transfer", note: "" };
}

export type PayoutProblems = { ready: boolean; date?: string; amount?: string; kind?: string };

/** Each missing thing, in the words its field shows; ready only when nothing is missing. */
export function payoutProblems(v: PayoutFormValues): PayoutProblems {
  const p: PayoutProblems = { ready: true };
  if (v.date === "") p.date = DATE_MISSING;
  if (v.amountCents === "unreadable") p.amount = AMOUNT_UNREADABLE;
  else if (v.amountCents === null || v.amountCents <= 0) p.amount = AMOUNT_MISSING;
  if (v.kind === "") p.kind = KIND_MISSING;
  p.ready = !p.date && !p.amount && !p.kind;
  return p;
}

/** The save input, or null while anything is missing. */
export function payoutInput(crewMemberId: string, v: PayoutFormValues): PayoutInput | null {
  if (!payoutProblems(v).ready || typeof v.amountCents !== "number" || v.kind === "") return null;
  const note = v.note.trim();
  return {
    crewMemberId,
    date: v.date,
    amountCents: v.amountCents,
    kind: v.kind,
    method: v.method,
    note: note === "" ? null : note,
  };
}

type Query = Record<string, string | string[] | undefined>;
const one = (q: Query, key: string) => {
  const v = q[key];
  return Array.isArray(v) ? v[0] : v;
};

function readAmount(text: string | undefined): PayoutFormValues["amountCents"] {
  const raw = (text ?? "").replace(/[$,\s]/g, "");
  if (raw === "") return null;
  try {
    return toCents(raw);
  } catch {
    return "unreadable";
  }
}

/**
 * The prototype's filled and refused states from the address: `amount`, `kind`, `method`, `note`, and `check=1` to
 * show what is missing as if Save payout had been tapped. Unknown kinds and methods are ignored.
 */
export function payoutFromQuery(q: Query, today: string): { values: PayoutFormValues; check: boolean } {
  const values = emptyPayout(today);
  values.amountCents = readAmount(one(q, "amount"));
  const kind = PAYOUT_KINDS.find((k) => k.value === one(q, "kind"));
  if (kind) values.kind = kind.value;
  const method = PAYOUT_METHODS.find((m) => m.value === one(q, "method"));
  if (method) values.method = method.value;
  values.note = one(q, "note") ?? "";
  return { values, check: one(q, "check") === "1" };
}

/** The toast on the crew member's page after a save (`?saved=payment|advance`); null for anything else. */
export function savedToastText(saved: string | undefined): string | null {
  const kind = PAYOUT_KINDS.find((k) => k.value === saved);
  return kind ? `${kind.label} saved.` : null;
}
