"use client";

import type { ReactNode } from "react";
import type { ExpenseRowManager } from "@/data/contracts";
import { formatDate, formatMoney } from "@/lib/format";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/button";
import { List } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { KeepTogether } from "@/components/keep-together";
import { KeyFigure, KeyFigureSkeleton } from "./home-parts";
import { PinnedAction, usePinnedBar } from "./field-entry";
import { ReceiptViewer } from "./receipt-viewer";
import { APPROVED_PAY_RUN_WARNING, PAID_BY, paidByShort, supplierText } from "./expense-input";

/** Phone: one column. Desktop: the figures and the facts side by side, so the width is used. */
const COLUMN = "mx-auto flex w-full max-w-150 flex-col gap-6 lg:mx-0 lg:max-w-240";
const PAIR = "flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start";
const GROUPED = "divide-y divide-line rounded-group bg-surface border-group";

type ExpenseDetailProps = {
  expense: ExpenseRowManager;
  receiptName: string | null;
  inApprovedPayRun: boolean;
  historyHref: string;
  today: string;
  /** Back here after Save changes: one line says the new figures are kept. */
  saved: boolean;
  /** Carries `?demo=` onto Edit, so the prototype's states stay on. Null for the accountant, who only reads. */
  editHref: string | null;
};

/** The one row pattern of this page: the label small and quiet on the left, the value strong and dark on the right. */
function Fact({
  label,
  name,
  figure = false,
  children,
}: {
  label: string;
  name: string;
  figure?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-fact={name}
      className="flex min-h-16 items-center justify-between gap-x-4 px-4 py-2 lg:min-h-12"
    >
      <span className="shrink-0 text-meta text-ink-2">{label}</span>
      <span
        className={cx(
          "min-w-0 text-right text-ink [overflow-wrap:anywhere]",
          figure ? "num text-figure" : "text-body-strong",
        )}
      >
        {children}
      </span>
    </div>
  );
}

/**
 * One saved expense (Owner/Manager; the accountant reads it without Edit): what it cost the job as the key figure, then
 * the total and GST, what it was for, who paid and the receipt. Edit opens the same form as Add expense, filled in;
 * Record history shows each change, who made it and when (flows.md "Expense edit").
 */
export function ExpenseDetailView({
  expense: e,
  receiptName,
  inApprovedPayRun,
  historyHref,
  today,
  saved,
  editHref,
}: ExpenseDetailProps) {
  const { style, barProps } = usePinnedBar(editHref);
  // Card is the form's word for the company card; a crew member's name keeps its reimbursement note.
  const paidBy =
    e.paidBy === "crew"
      ? paidByShort(e)
      : { label: PAID_BY.find((p) => p.value === e.paidBy)?.label ?? paidByShort(e).label, note: null };
  return (
    <div data-screen="expense-detail" style={style} className={cx(COLUMN, editHref && "pin-pad")}>
      <div className="flex flex-col gap-1">
        <Button variant="link" href="/expenses" className="self-start">
          Back to expenses
        </Button>
        <div className="flex items-start justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-title text-ink [overflow-wrap:anywhere]">{supplierText(e.supplier)}</h1>
            <div data-expense-cost="" className="flex flex-col gap-1">
              <KeyFigure>{formatMoney(e.costCents)}</KeyFigure>
              <p className="text-meta text-ink">
                cost to the job, {e.costCents === e.amountExGstCents ? "ex\u00a0GST" : "GST included"}
              </p>
            </div>
          </div>
          {editHref ? (
            <PinnedAction barProps={barProps} className="pin-head">
              <Button href={editHref} className="w-full lg:w-48 lg:self-end">
                Edit
              </Button>
            </PinnedAction>
          ) : null}
        </div>
      </div>
      {saved ? (
        <p role="status" data-expense-saved="" className="text-body-strong text-good">
          Changes saved.
        </p>
      ) : null}
      {inApprovedPayRun ? (
        <p className="text-body text-ink-2">{APPROVED_PAY_RUN_WARNING.split(". ")[0]}.</p>
      ) : null}
      <div className={PAIR}>
        <div className={GROUPED}>
          <Fact label="Total paid" name="total" figure>
            {formatMoney(e.totalCents)}
          </Fact>
          <Fact label="GST" name="gst" figure={e.gstCents !== 0}>
            {e.gstCents === 0 ? "No\u00a0GST" : formatMoney(e.gstCents)}
          </Fact>
          <Fact label="Date" name="date">
            {formatDate(e.date, today)}
          </Fact>
          <Fact label="Paid by" name="paid-by">
            {paidBy.label}
            {paidBy.note ? (
              <span className="block text-meta font-normal text-ink-2">{paidBy.note}</span>
            ) : null}
          </Fact>
        </div>
        <div className={GROUPED}>
          <Fact label="Job" name="job">
            <KeepTogether text={e.projectName} />
          </Fact>
          <Fact label="Category" name="category">
            {e.category.name}
          </Fact>
          {e.stageName ? (
            <Fact label="Stage" name="stage">
              <KeepTogether text={e.stageName} />
            </Fact>
          ) : null}
          {receiptName ? (
            <ReceiptViewer name={receiptName} />
          ) : (
            <Fact label="Receipt" name="receipt">
              No receipt attached
            </Fact>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3 lg:max-w-md">
        <List rows={[{ key: "history", primary: "Record history", href: historyHref }]} />
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex min-h-16 items-center justify-between gap-x-4 px-4 py-2 lg:min-h-12">
      <Skeleton width={70} height={14} />
      <Skeleton width={120} height={20} />
    </div>
  );
}

/** The page while it loads (`?demo=loading`): the same rows, as blocks. The title is real; the supplier is not known yet. */
export function ExpenseDetailSkeleton() {
  const { style, barProps } = usePinnedBar(null);
  const group = (n: number) => (
    <div className="divide-y divide-line rounded-group bg-surface border-group">
      {Array.from({ length: n }, (_, i) => (
        <RowSkeleton key={i} />
      ))}
    </div>
  );
  return (
    <div data-screen="expense-detail" aria-busy="true" style={style} className={cx(COLUMN, "pin-pad")}>
      <div className="flex flex-col gap-1">
        <Skeleton width={160} height={24} className="my-3" />
        <div className="flex items-start justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-title text-ink">Expense</h1>
            <div className="flex flex-col gap-1">
              <KeyFigureSkeleton width={160} />
              <div className="flex h-6 items-center">
                <Skeleton width={150} height={14} />
              </div>
            </div>
          </div>
          <PinnedAction barProps={barProps} className="pin-head">
            <Skeleton height={48} className="w-full lg:w-48 lg:self-end" />
          </PinnedAction>
        </div>
      </div>
      <div className={PAIR}>
        {group(4)}
        {group(4)}
      </div>
      <div className="flex flex-col gap-3 lg:max-w-md">{group(1)}</div>
    </div>
  );
}
