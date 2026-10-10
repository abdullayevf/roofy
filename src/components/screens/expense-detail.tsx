import type { ExpenseRowManager } from "@/data/contracts";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { List, type ListRow } from "@/components/ui/list";
import { MoneyCell } from "@/components/ui/money-cell";
import { Skeleton } from "@/components/ui/skeleton";
import { APPROVED_PAY_RUN_WARNING, categoryLine, paidByText, supplierText } from "./expense-input";

/** Phone: one column. Desktop: the figures and the facts side by side, so the width is used. */
const COLUMN = "mx-auto flex w-full max-w-150 flex-col gap-6 lg:mx-0 lg:max-w-240";
const PAIR = "flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start";

type ExpenseDetailProps = {
  expense: ExpenseRowManager;
  receiptName: string | null;
  inApprovedPayRun: boolean;
  historyHref: string;
  today: string;
  /** Back here after Save changes: one line says the new figures are kept. */
  saved: boolean;
  /** Carries `?demo=` onto Edit, so the prototype's states stay on. */
  editHref: string;
};

/**
 * One saved expense (Owner/Manager): what was paid, the GST, what it cost the job, and who paid. Edit opens the same
 * form as Add expense, filled in; Record history shows each change, who made it and when (flows.md "Expense edit").
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
  const rows: ListRow[] = [
    {
      key: "total",
      primary: "Total paid",
      meta: "Including GST",
      figure: <MoneyCell cents={e.totalCents} />,
    },
    {
      key: "gst",
      primary: "GST",
      meta: e.gstCents === 0 ? "No GST on this receipt" : undefined,
      figure: <MoneyCell cents={e.gstCents} />,
    },
    {
      key: "cost",
      primary: "Cost to the job",
      meta: e.costCents === e.amountExGstCents ? "Ex GST" : undefined,
      figure: <MoneyCell cents={e.costCents} />,
    },
  ];
  const facts: ListRow[] = [
    { key: "date", primary: formatDate(e.date, today), meta: "Date" },
    { key: "job", primary: e.projectName, meta: categoryLine(e) },
    { key: "paid", primary: paidByText(e), meta: "Paid by" },
    { key: "receipt", primary: receiptName ?? "No receipt attached", meta: "Receipt" },
  ];
  return (
    <div data-screen="expense-detail" className={COLUMN}>
      <div className="flex flex-col gap-1">
        <Button variant="link" href="/expenses" className="self-start">
          Back to expenses
        </Button>
        <h1 className="text-title text-ink [overflow-wrap:anywhere]">{supplierText(e.supplier)}</h1>
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
        <List rows={rows} quietLabels />
        <List rows={facts} quietLabels />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button href={editHref}>Edit</Button>
        <Button variant="link" href={historyHref}>
          Record history
        </Button>
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex min-h-16 flex-col justify-center px-4 py-2.5 lg:min-h-12">
      <div className="flex h-6 items-center">
        <Skeleton width={140} height={20} />
      </div>
      <div className="flex h-6 items-center">
        <Skeleton width={100} height={14} />
      </div>
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
      </div>
      <div className={PAIR}>
        {group(3)}
        {group(4)}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton width={96} height={48} />
        <Skeleton width={130} height={24} />
      </div>
    </div>
  );
}
