import type { ReactNode } from "react";
import type { ExpenseRowManager } from "@/data/contracts";
import { formatDate, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { List } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { KeepTogether } from "@/components/keep-together";
import { KeyFigure, KeyFigureSkeleton } from "./home-parts";
import { ReceiptViewer } from "./receipt-viewer";
import { APPROVED_PAY_RUN_WARNING, paidByShort, supplierText } from "./expense-input";

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
function Fact({ label, name, children }: { label: string; name: string; children: ReactNode }) {
  return (
    <div data-fact={name} className="flex min-h-16 items-center justify-between gap-x-4 px-4 py-2 lg:min-h-12">
      <span className="shrink-0 text-meta text-ink-2">{label}</span>
      <span className="min-w-0 text-right text-body-strong text-ink [overflow-wrap:anywhere]">{children}</span>
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
  return (
    <div data-screen="expense-detail" className={COLUMN}>
      <div className="flex flex-col gap-1">
        <Button variant="link" href="/expenses" className="self-start">
          Back to expenses
        </Button>
        <h1 className="text-title text-ink [overflow-wrap:anywhere]">{supplierText(e.supplier)}</h1>
        <div data-expense-cost="" className="flex flex-col gap-1">
          <KeyFigure>{formatMoney(e.costCents)}</KeyFigure>
          <p className="text-meta text-ink">
            cost to the job, {e.costCents === e.amountExGstCents ? "ex\u00a0GST" : "GST included"}
          </p>
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
          <Fact label="Total paid" name="total">
            <span className="num">{formatMoney(e.totalCents)}</span>
          </Fact>
          <Fact label="GST" name="gst">
            {e.gstCents === 0 ? "No\u00a0GST" : <span className="num">{formatMoney(e.gstCents)}</span>}
          </Fact>
          <Fact label="Date" name="date">
            {formatDate(e.date, today)}
          </Fact>
          <Fact label="Paid by" name="paid-by">
            {paidByShort(e).label}
            {paidByShort(e).note ? <span className="block text-meta font-normal text-ink-2">{paidByShort(e).note}</span> : null}
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
        {editHref ? <Button href={editHref}>Edit</Button> : null}
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
  const group = (n: number) => (
    <div className="divide-y divide-line rounded-group bg-surface border-group">
      {Array.from({ length: n }, (_, i) => (
        <RowSkeleton key={i} />
      ))}
    </div>
  );
  return (
    <div data-screen="expense-detail" aria-busy="true" className={COLUMN}>
      <div className="flex flex-col gap-1">
        <Skeleton width={160} height={24} className="my-3" />
        <h1 className="text-title text-ink">Expense</h1>
        <div className="flex flex-col gap-1">
          <KeyFigureSkeleton width={160} />
          <div className="flex h-6 items-center">
            <Skeleton width={150} height={14} />
          </div>
        </div>
      </div>
      <div className={PAIR}>
        {group(4)}
        {group(4)}
      </div>
      <div className="flex flex-col gap-3 lg:max-w-md">
        <Skeleton height={48} className="w-full" />
        {group(1)}
      </div>
    </div>
  );
}
