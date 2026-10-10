import type { ReactNode } from "react";
import Link from "next/link";
import { CaretRight, Paperclip, X } from "@phosphor-icons/react/dist/ssr";
import type { ExpenseList, ExpenseRowForeman, ExpenseRowManager } from "@/data/contracts";
import { cx } from "@/lib/cx";
import { formatDate, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { KeepTogether } from "@/components/keep-together";
import { LoadError } from "./field-entry";
import { COLUMN, FOCUS, GROUP, KeyFigure, KeyFigureSkeleton } from "./home-parts";
import { JobsAddBar } from "./jobs-add-bar";
import { TD, TH } from "./table-cells";
import { emptyFilterText, expenseHref, paidByCrew, paidByShort, paidByText, supplierText, type ExpenseFilter } from "./expense-input";

/** The Expenses page column: left-aligned from 1024 px, where the manager's list is a table the width of the content. */
const EXPENSES_COLUMN = cx(COLUMN, "lg:max-w-none");
/**
 * A phone row: the supplier and the total on the first line, then every other line across the full width, so the text
 * runs to the right edge instead of stopping short of the total column. The total column is as wide as the figure.
 */
const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4";
const ROW_GRID_FOREMAN = "grid grid-cols-1 items-start";

/** A long history stays quick to open: the newest rows show, the totals still cover them all. */
export const EXPENSES_SHOWN = 50;

export type ExpenseNames = { job: string | null; stage: string | null };

function Header({ addHref }: { addHref: string | null }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-x-4">
      <h1 className="text-title text-ink">Expenses</h1>
      {addHref ? (
        <div className="jobs-add-head hidden lg:block">
          <Button variant="primary" href={addHref}>
            Add expense
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** One clearable filter: the job or stage the list is narrowed to. Tapping it takes the filter off. */
function FilterChip({ label, href, kind }: { label: string; href: string; kind: "job" | "stage" }) {
  return (
    <Link
      href={href}
      prefetch={false}
      data-expense-filter={kind}
      aria-label={`Clear filter: ${label}`}
      className={cx("flex min-h-12 max-w-full items-center gap-1.5 rounded-3xl border-[1.5px] border-edge bg-surface px-4 py-1 text-body-strong text-ink", FOCUS)}
    >
      <span className="min-w-0 [overflow-wrap:anywhere]">
        <KeepTogether text={label} />
      </span>
      <X size={24} aria-hidden="true" className="shrink-0" />
    </Link>
  );
}

function FilterChips({ filter, names, demo }: { filter: ExpenseFilter; names: ExpenseNames; demo?: string }) {
  if (!filter.projectId && !filter.stageId) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {filter.projectId ? (
        <FilterChip kind="job" label={names.job ?? "This job"} href={expenseHref({ projectId: null, stageId: null }, demo)} />
      ) : null}
      {filter.stageId ? (
        <FilterChip kind="stage" label={names.stage ?? "This stage"} href={expenseHref({ projectId: filter.projectId, stageId: null }, demo)} />
      ) : null}
    </div>
  );
}

/** The paperclip, only when a photo is attached; a missing receipt adds no words to the row. */
function Receipt({ has }: { has: boolean }) {
  if (!has) return null;
  return (
    <span data-expense-receipt="yes" className="inline-flex shrink-0 items-center align-middle text-ink-2">
      <Paperclip size={20} aria-hidden="true" />
      <span className="sr-only">Receipt attached</span>
    </span>
  );
}

/**
 * The lines of a phone row, three for most: supplier (and the total beside it), date and job, category and stage as
 * two facts. A fourth line says who paid only when a crew member did (their pay run reimburses them).
 */
function Lines({ row, today, total }: { row: ExpenseRowForeman; today: string; total?: ReactNode }) {
  const span = total ? "col-span-2" : "";
  return (
    <span className={total ? ROW_GRID : ROW_GRID_FOREMAN}>
      <span data-expense-supplier="" className="flex min-w-0 items-center gap-x-1.5 text-body-strong text-ink">
        <span className="min-w-0 [overflow-wrap:anywhere]">{supplierText(row.supplier)}</span>
        <Receipt has={row.hasReceipt} />
      </span>
      {total}
      <span className={cx("flex gap-x-3 text-meta text-ink", span)}>
        <span className="shrink-0 whitespace-nowrap">{formatDate(row.date, today)}</span>
        <span data-expense-job="" className="min-w-0 [overflow-wrap:anywhere]">
          <KeepTogether text={row.projectName} />
        </span>
      </span>
      <span className={cx("flex flex-wrap gap-x-3 text-meta text-ink", span)}>
        <span data-expense-category="" className="[overflow-wrap:anywhere]">{row.category.name}</span>
        {row.stageName ? (
          <span data-expense-stage="" className="[overflow-wrap:anywhere]">
            <KeepTogether text={row.stageName} />
          </span>
        ) : null}
      </span>
      {paidByCrew(row) ? (
        <span data-expense-paid-by="" className={cx("text-meta text-ink [overflow-wrap:anywhere]", span)}>
          {paidByText(row)}
        </span>
      ) : null}
    </span>
  );
}

function Total({ row }: { row: ExpenseRowManager }) {
  return (
    <span data-expense-total="" className="text-figure num whitespace-nowrap text-right text-ink">
      {formatMoney(row.totalCents)}
    </span>
  );
}

/** A manager's phone or tablet row: opens the expense; the total sits in the right column. */
function ManagerPhoneRow({ row, today }: { row: ExpenseRowManager; today: string }) {
  return (
    <Link
      href={`/expenses/${row.id}`}
      prefetch={false}
      data-expense-row=""
      data-expense-id={row.id}
      className={cx("relative block min-h-16 py-2 pl-4 pr-9 first:rounded-t-group last:rounded-b-group active:bg-galv", FOCUS)}
    >
      <Lines row={row} today={today} total={<Total row={row} />} />
      <CaretRight size={24} aria-hidden="true" className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-2" />
    </Link>
  );
}

/** A foreman's row: the same lines, no total, and not a link (changing an expense is the manager's). */
function ForemanRow({ row, today }: { row: ExpenseRowForeman; today: string }) {
  return (
    <div data-expense-row="" className="min-h-16 px-4 py-2">
      <Lines row={row} today={today} />
    </div>
  );
}

/** Table column widths: the date and total are as wide as their figures; the rest share what is left, so no cell wraps. */
const COL = {
  date: "w-28",
  supplier: "w-[22%]",
  job: "w-[21%]",
  category: "w-[13%]",
  paidBy: "w-[22%]",
  total: "w-28",
} as const;

/** Who paid, for a table cell: "Company card", "Cash", or the name with where the reimbursement stands under it. */
function PaidByCell({ row }: { row: ExpenseRowForeman }) {
  const { label, note } = paidByShort(row);
  return (
    <td data-expense-paid-by="" className={cx(TD, "text-body text-ink")}>
      <span className="[overflow-wrap:anywhere]">{label}</span>
      {note ? <span className="ml-2 text-meta text-ink">{note}</span> : null}
    </td>
  );
}

/**
 * From 1024 px the list is a table, one line a row: date, supplier, job, category (the stage is on the phone row and the detail), who paid and, for a
 * manager, the total, whose row is the link. A foreman's table has no total column and nothing to open.
 */
function ExpenseTable({ rows, today, manager }: { rows: ExpenseRowForeman[]; today: string; manager: boolean }) {
  return (
    <table className="hidden w-full table-fixed lg:table" data-expense-table="">
      <thead>
        <tr>
          <th scope="col" className={cx(TH, COL.date)}>Date</th>
          <th scope="col" className={cx(TH, COL.supplier)}>Supplier</th>
          <th scope="col" className={cx(TH, COL.job)}>Job</th>
          <th scope="col" className={cx(TH, COL.category)}>Category</th>
          <th scope="col" className={cx(TH, manager ? COL.paidBy : "")}>Paid by</th>
          {manager ? <th scope="col" className={cx(TH, COL.total, "text-right")}>Total</th> : null}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((row) => (
          <tr key={row.id} data-expense-row="" data-expense-id={row.id} className={cx("relative", manager && "hover:bg-galv")}>
            <td className={cx(TD, "whitespace-nowrap text-body text-ink")}>{formatDate(row.date, today)}</td>
            <td className={TD}>
              <span className="flex items-center gap-x-1.5">
                {manager ? (
                  <Link href={`/expenses/${row.id}`} prefetch={false} data-expense-supplier="" className={cx("min-w-0 text-body-strong text-ink [overflow-wrap:anywhere] after:absolute after:inset-0", FOCUS)}>
                    {supplierText(row.supplier)}
                  </Link>
                ) : (
                  <span data-expense-supplier="" className="min-w-0 text-body-strong text-ink [overflow-wrap:anywhere]">{supplierText(row.supplier)}</span>
                )}
                <Receipt has={row.hasReceipt} />
              </span>
            </td>
            <td data-expense-job="" className={cx(TD, "text-body text-ink [overflow-wrap:anywhere]")}>
              <KeepTogether text={row.projectName} />
            </td>
            <td data-expense-category="" className={cx(TD, "text-body text-ink [overflow-wrap:anywhere]")}>
              {row.category.name}
            </td>
            <PaidByCell row={row} />
            {manager ? (
              <td className={cx(TD, "pr-4 text-right")}>
                <Total row={row as ExpenseRowManager} />
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export type ExpenseListProps = {
  list: ExpenseList;
  filter: ExpenseFilter;
  names: ExpenseNames;
  /** The workspace has expenses, just none under this filter. */
  anyExpenses: boolean;
  /** Owner, manager and foreman add expenses; an accountant only reads. */
  canAdd: boolean;
  today: string;
  demo?: string;
};

/** Expenses list (flows.md screen 16): totals, the filter chips, then one row per expense. Props only; the page fetches. */
export function ExpenseListBody({ list, filter, names, anyExpenses, canAdd, today, demo }: ExpenseListProps) {
  const count = list.rows.length;
  const addHref = canAdd ? (filter.projectId ? `/expenses/new?job=${encodeURIComponent(filter.projectId)}` : "/expenses/new") : null;
  if (list.rows.length === 0 && !anyExpenses) {
    return (
      <div data-screen="expenses" className={EXPENSES_COLUMN}>
        <Header addHref={null} />
        <div className="flex min-h-[50dvh] flex-col justify-center">
          {canAdd ? (
            <EmptyState message="No expenses yet. Add your first receipt." actionLabel="Add expense" href="/expenses/new" />
          ) : (
            <EmptyState message="No expenses yet." actionLabel="Go to Home" href="/" />
          )}
        </div>
      </div>
    );
  }
  return (
    <div data-screen="expenses" className={EXPENSES_COLUMN}>
      <div className="flex flex-col gap-2">
        <Header addHref={addHref} />
        {list.view === "manager" && list.rows.length > 0 ? (
          <div data-expense-totals="" className="flex flex-col gap-1">
            <KeyFigure>{formatMoney(list.totals.thisMonth.exGstCents)}</KeyFigure>
            <p className="text-meta text-ink">
              spent this month, ex&nbsp;GST, plus {formatMoney(list.totals.thisMonth.gstCents)}&nbsp;GST
            </p>
          </div>
        ) : null}
      </div>
      <FilterChips filter={filter} names={names} demo={demo} />
      {list.rows.length === 0 ? (
        <p data-expense-empty="" className="text-body text-ink">{emptyFilterText(filter)}</p>
      ) : list.view === "manager" ? (
        <div className={cx(GROUP, "overflow-hidden")}>
          <div className="divide-y divide-line lg:hidden">
            {list.rows.slice(0, EXPENSES_SHOWN).map((row) => (
              <ManagerPhoneRow key={row.id} row={row} today={today} />
            ))}
          </div>
          <ExpenseTable rows={list.rows.slice(0, EXPENSES_SHOWN)} today={today} manager />
        </div>
      ) : (
        <div className={cx(GROUP, "overflow-hidden")}>
          <div className="divide-y divide-line lg:hidden">
            {list.rows.slice(0, EXPENSES_SHOWN).map((row) => (
              <ForemanRow key={row.id} row={row} today={today} />
            ))}
          </div>
          <ExpenseTable rows={list.rows.slice(0, EXPENSES_SHOWN)} today={today} manager={false} />
        </div>
      )}
      {count > EXPENSES_SHOWN ? (
        <p data-expense-more="" className="text-meta text-ink">
          Showing the newest {EXPENSES_SHOWN} of {count}&nbsp;expenses. Open a job to see only its expenses.
        </p>
      ) : null}
      {addHref ? <JobsAddBar label="Add expense" href={addHref} /> : null}
    </div>
  );
}

/** The list when the server can't answer: the title and filter stay, Try again is the one primary button. */
export function ExpensesError({ filter, names, demo }: { filter: ExpenseFilter; names: ExpenseNames; demo?: string }) {
  return (
    <div data-screen="expenses" className={EXPENSES_COLUMN}>
      <Header addHref={null} />
      <FilterChips filter={filter} names={names} demo={demo} />
      <LoadError primary />
    </div>
  );
}

/** A phone row's shape while it loads: supplier and total, date and job, category: the same three lines, the same heights. */
function RowSkeleton({ manager }: { manager: boolean }) {
  return (
    <div className="min-h-16 px-4 py-2">
      <div className={manager ? ROW_GRID : ROW_GRID_FOREMAN}>
        <div className="flex h-6 items-center">
          <Skeleton width={180} height={20} />
        </div>
        {manager ? (
          <div className="flex h-6 items-center justify-end">
            <Skeleton width={72} height={20} />
          </div>
        ) : null}
        <div className={cx("flex h-5 items-center", manager && "col-span-2")}>
          <Skeleton width={230} height={14} />
        </div>
        <div className={cx("flex h-5 items-center", manager && "col-span-2")}>
          <Skeleton width={150} height={14} />
        </div>
      </div>
    </div>
  );
}

/** The desktop table's rows while it loads: real headers, rows at the real 48 px height. */
function TableSkeleton({ manager }: { manager: boolean }) {
  const widths = [72, 150, 170, 100, 110];
  return (
    <table className="hidden w-full table-fixed lg:table">
      <thead>
        <tr>
          <th scope="col" className={cx(TH, COL.date)}>Date</th>
          <th scope="col" className={cx(TH, COL.supplier)}>Supplier</th>
          <th scope="col" className={cx(TH, COL.job)}>Job</th>
          <th scope="col" className={cx(TH, COL.category)}>Category</th>
          <th scope="col" className={cx(TH, manager ? COL.paidBy : "")}>Paid by</th>
          {manager ? <th scope="col" className={cx(TH, COL.total, "text-right")}>Total</th> : null}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {Array.from({ length: 6 }, (_, i) => (
          <tr key={i} className="h-12">
            {widths.map((w, j) => (
              <td key={j} className={TD}>
                <Skeleton width={w} height={16} />
              </td>
            ))}
            {manager ? (
              <td className={cx(TD, "pr-4")}>
                <div className="flex justify-end">
                  <Skeleton width={72} height={20} />
                </div>
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The list while it loads (`?demo=loading`): the real title with its Add expense button, a block for the totals, and
 * rows shaped like the real ones: phone rows with the pinned Add expense bar, the desktop table at its real row height.
 */
export function ExpensesSkeleton({ manager, canAdd = true }: { manager: boolean; canAdd?: boolean }) {
  return (
    <div data-screen="expenses" aria-busy="true" className={EXPENSES_COLUMN}>
      <div className="flex flex-col gap-2">
        <Header addHref={canAdd ? "/expenses/new" : null} />
        {manager ? (
          <div className="flex flex-col gap-1">
            <KeyFigureSkeleton width={240} />
            <div className="flex h-6 items-center">
              <Skeleton width={170} height={14} />
            </div>
          </div>
        ) : null}
      </div>
      <div className={cx(GROUP, "overflow-hidden")}>
        <div className="divide-y divide-line lg:hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <RowSkeleton key={i} manager={manager} />
          ))}
        </div>
        <TableSkeleton manager={manager} />
      </div>
      {canAdd ? <JobsAddBar label="Add expense" href="/expenses/new" skeleton /> : null}
    </div>
  );
}
