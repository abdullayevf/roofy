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
import { categoryLine, emptyFilterText, expenseHref, paidByText, receiptText, type ExpenseFilter } from "./expense-input";

/** The Expenses page column: left-aligned from 1024 px, where the manager's list is a table the width of the content. */
const EXPENSES_COLUMN = cx(COLUMN, "lg:max-w-none");
/** The fixed right column of a phone row: the total, right-aligned, never squeezed by a long supplier. */
const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_min(8.5rem,40%)] items-start gap-x-4";

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

function Receipt({ has }: { has: boolean }) {
  return (
    <span data-expense-receipt={has ? "yes" : "no"} className="flex items-center gap-1.5 text-meta text-ink">
      {has ? <Paperclip size={20} aria-hidden="true" className="shrink-0" /> : null}
      {receiptText(has)}
    </span>
  );
}

/** The lines of a row, one fact each: supplier, date, job, category (and stage), who paid, receipt. */
function Lines({ row, today }: { row: ExpenseRowForeman; today: string }) {
  return (
    <span className="flex flex-col">
      <span data-expense-supplier="" className="block text-body-strong text-ink [overflow-wrap:anywhere]">
        {row.supplier}
      </span>
      <span className="text-meta text-ink">{formatDate(row.date, today)}</span>
      <span data-expense-job="" className="text-meta text-ink [overflow-wrap:anywhere]">
        <KeepTogether text={row.projectName} />
      </span>
      <span className="text-meta text-ink [overflow-wrap:anywhere]">{categoryLine(row)}</span>
      <span data-expense-paid-by="" className="text-meta text-ink [overflow-wrap:anywhere]">
        {paidByText(row)}
      </span>
      <Receipt has={row.hasReceipt} />
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
      className={cx("relative block min-h-16 py-2 pl-4 pr-9 first:rounded-t-group last:rounded-b-group active:bg-galv", FOCUS)}
    >
      <span className={ROW_GRID}>
        <Lines row={row} today={today} />
        <Total row={row} />
      </span>
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

/** From 1024 px a manager's list is a table, the whole row the link: date, supplier, job, who paid, total. */
function ManagerTable({ rows, today }: { rows: ExpenseRowManager[]; today: string }) {
  return (
    <table className="hidden w-full lg:table">
      <thead>
        <tr>
          <th scope="col" className={TH}>Date</th>
          <th scope="col" className={TH}>Supplier</th>
          <th scope="col" className={TH}>Job</th>
          <th scope="col" className={TH}>Paid by</th>
          <th scope="col" className={cx(TH, "text-right")}>Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((row) => (
          <tr key={row.id} data-expense-row="" className="relative hover:bg-galv">
            <td className={cx(TD, "whitespace-nowrap text-body text-ink")}>{formatDate(row.date, today)}</td>
            <td className={TD}>
              <Link href={`/expenses/${row.id}`} prefetch={false} className={cx("block text-body-strong text-ink [overflow-wrap:anywhere] after:absolute after:inset-0", FOCUS)}>
                {row.supplier}
              </Link>
              <span className="block text-meta text-ink [overflow-wrap:anywhere]">{categoryLine(row)}</span>
              <Receipt has={row.hasReceipt} />
            </td>
            <td className={cx(TD, "text-body text-ink [overflow-wrap:anywhere]")}>
              <KeepTogether text={row.projectName} />
            </td>
            <td data-expense-paid-by="" className={cx(TD, "text-body text-ink [overflow-wrap:anywhere]")}>
              {paidByText(row)}
            </td>
            <td className={cx(TD, "pr-4 text-right")}>
              <Total row={row} />
            </td>
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
            <KeyFigure>{formatMoney(list.totals.exGstCents)}</KeyFigure>
            <p className="text-meta text-ink">
              ex GST, plus {formatMoney(list.totals.gstCents)}&nbsp;GST
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
          <ManagerTable rows={list.rows.slice(0, EXPENSES_SHOWN)} today={today} />
        </div>
      ) : (
        <div className={cx(GROUP, "overflow-hidden")}>
          {list.rows.slice(0, EXPENSES_SHOWN).map((row) => (
            <ForemanRow key={row.id} row={row} today={today} />
          ))}
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

/** One row's shape while it loads: supplier, four meta lines and the total in the right column (manager). */
function RowSkeleton({ manager }: { manager: boolean }) {
  return (
    <div className="min-h-16 px-4 py-2">
      <div className={manager ? ROW_GRID : undefined}>
        <div className="flex flex-col">
          <div className="flex h-6 items-center">
            <Skeleton width={180} height={20} />
          </div>
          {[90, 200, 150, 190, 110].map((w, i) => (
            <div key={i} className="flex h-5 items-center">
              <Skeleton width={w} height={14} />
            </div>
          ))}
        </div>
        {manager ? (
          <div className="flex h-6 items-center justify-end">
            <Skeleton width={96} height={22} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** The list while it loads (`?demo=loading`): real title, a block for the totals, rows as blocks. */
export function ExpensesSkeleton({ manager }: { manager: boolean }) {
  return (
    <div data-screen="expenses" aria-busy="true" className={EXPENSES_COLUMN}>
      <div className="flex flex-col gap-2">
        <Header addHref={null} />
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
        {Array.from({ length: 6 }, (_, i) => (
          <RowSkeleton key={i} manager={manager} />
        ))}
      </div>
    </div>
  );
}
