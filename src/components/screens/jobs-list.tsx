import type { ProjectList } from "@/data/contracts";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { LoadError } from "./field-entry";
import { COLUMN, GROUP, KeyFigure, KeyFigureSkeleton } from "./home-parts";
import { overBudgetFigure } from "./home-text";
import { JobsAddBar } from "./jobs-add-bar";
import { JobsBrowse } from "./jobs-group";
import { TD, TH } from "./table-cells";
import { JobsFilter } from "./jobs-filter";
import { overBudgetJobs, type JobFilter } from "./job-input";

/** The Jobs page column: left-aligned from 1024 px, where the list is a table the width of the content. */
const JOBS_COLUMN = cx(COLUMN, "lg:max-w-none");

/**
 * The title, and Add job beside it from 1024 px and on a phone on its side (on a phone held upright it is pinned at
 * the bottom instead, in thumb reach; `globals.css` swaps them).
 */
function Header({ canAdd }: { canAdd: boolean }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-x-4">
      <h1 className="text-title text-ink">Jobs</h1>
      {canAdd ? (
        <div className="jobs-add-head hidden lg:block">
          <Button variant="primary" href="/jobs/new">
            Add job
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export type JobsListProps = {
  list: ProjectList;
  filter: JobFilter;
  /** The workspace has jobs, just none under this filter. */
  anyJobs: boolean;
  /** Owner and manager can add a job; a foreman and an accountant cannot. */
  canAdd: boolean;
  /** The workspace's local date, for "Mon 7 Sep" in the last-log column. */
  today: string;
  demo?: string;
};

/** Jobs list (flows.md screen 9): the status filter, then one card per job. Props only; the page fetches. */
export function JobsListBody({ list, filter, anyJobs, canAdd, today, demo }: JobsListProps) {
  const foreman = list.view === "foreman";
  if (list.rows.length === 0 && !anyJobs) {
    return (
      <div data-screen="jobs" className={JOBS_COLUMN}>
        <Header canAdd={canAdd} />
        <div className="flex min-h-[50dvh] flex-col justify-center">
          {foreman ? (
            <EmptyState message="You can see jobs once a manager adds you to one." />
          ) : canAdd ? (
            <EmptyState message="No jobs yet. Add your first job." />
          ) : (
            <EmptyState message="No jobs yet." actionLabel="Go to Home" href="/" />
          )}
        </div>
        {canAdd ? <JobsAddBar label="Add your first job" /> : null}
      </div>
    );
  }
  const over = list.view === "manager" ? overBudgetJobs(list.rows) : null;
  return (
    <div data-screen="jobs" className={JOBS_COLUMN}>
      <div className="flex flex-col gap-2">
        <Header canAdd={canAdd} />
        {over === null ? null : <KeyFigure>{over === 0 ? "No jobs over budget" : overBudgetFigure(over)}</KeyFigure>}
      </div>
      <JobsBrowse list={list} today={today} filter={filter} demo={demo} />
      {canAdd ? <JobsAddBar /> : null}
    </div>
  );
}

/**
 * The list when the server can't answer: the title and filter stay, the list area says so. There is nothing to add a
 * job to while the list can't load, so Try again is the one primary button and Add job is left out.
 */
export function JobsError({ filter, demo }: { filter: JobFilter; demo?: string }) {
  return (
    <div data-screen="jobs" className={JOBS_COLUMN}>
      <Header canAdd={false} />
      <JobsFilter value={filter} demo={demo} />
      <LoadError primary />
    </div>
  );
}

/** One job row's shape while it loads: name, status line, tape bar with its % slot, and the figure (manager). */
function JobRowSkeleton({ manager }: { manager: boolean }) {
  return (
    <div className="min-h-16 px-4 py-2.5">
      <div className="flex h-6 items-center">
        <Skeleton width={220} height={20} />
      </div>
      <div className="flex h-5 items-center">
        <Skeleton width={160} height={14} />
      </div>
      <div className="mt-1 grid grid-cols-[minmax(0,1fr)_min(8.5rem,45%)] items-center gap-x-[min(1.75rem,8vw)]">
        <Skeleton height={12} />
        <Skeleton width={110} height={24} />
      </div>
      {manager ? (
        <div className="flex h-6 items-center justify-end">
          <Skeleton width={150} height={20} />
        </div>
      ) : null}
    </div>
  );
}

/** The desktop table while it loads: the real column headers, and rows of blocks the size of each cell. */
function JobsTableSkeleton({ manager }: { manager: boolean }) {
  return (
    <table className="hidden w-full lg:table">
      <thead>
        <tr>
          <th scope="col" className={TH}>Job</th>
          <th scope="col" className={cx(TH, "w-56")}>Done</th>
          {manager ? <th scope="col" className={cx(TH, "text-right")}>Labour of budget</th> : null}
          {manager ? <th scope="col" className={cx(TH, "text-right")}>Margin</th> : null}
          <th scope="col" className={cx(TH, "text-right")}>Last log</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {Array.from({ length: 4 }, (_, i) => (
          <tr key={i} data-job-skeleton="" className="h-12">
            <td className={TD}>
              <div className="flex h-6 items-center">
                <Skeleton width={220} height={20} />
              </div>
              <div className="flex h-6 items-center">
                <Skeleton width={160} height={14} />
              </div>
            </td>
            <td className={TD}>
              <Skeleton height={12} />
            </td>
            {manager ? (
              <td className={TD}>
                <div className="flex justify-end">
                  <Skeleton width={150} height={20} />
                </div>
              </td>
            ) : null}
            {manager ? (
              <td className={TD}>
                <div className="flex justify-end">
                  <Skeleton width={80} height={20} />
                </div>
              </td>
            ) : null}
            <td className={TD}>
              <div className="flex justify-end">
                <Skeleton width={72} height={20} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The list while it loads (`?demo=loading`): the title, headline line and filter are real or lines in their place, the
 * rows are blocks shaped like them (cards on a phone, a table from 1024 px).
 * `manager` = money figures, the headline and the filter (owner, manager, accountant); `canAdd` = the Add job button.
 */
export function JobsSkeleton({ manager, canAdd }: { manager: boolean; canAdd: boolean }) {
  return (
    <div data-screen="jobs" aria-busy="true" className={JOBS_COLUMN}>
      <div className="flex flex-col gap-2">
        <div className="flex min-h-12 items-center justify-between gap-4">
          <h1 className="text-title text-ink">Jobs</h1>
          {canAdd ? <Skeleton width={104} height={52} className="jobs-add-head hidden lg:block" /> : null}
        </div>
        {manager ? <KeyFigureSkeleton width={240} /> : null}
      </div>
      {manager ? (
        <div className="flex flex-wrap gap-2">
          {[84, 92, 96, 104, 96, 56].map((w, i) => (
            <Skeleton key={i} width={w} height={48} rounded="full" />
          ))}
        </div>
      ) : null}
      <div className={cx(GROUP, "overflow-hidden")}>
        <div className="divide-y divide-line lg:hidden">
          {Array.from({ length: 4 }, (_, i) => (
            <JobRowSkeleton key={i} manager={manager} />
          ))}
        </div>
        <JobsTableSkeleton manager={manager} />
      </div>
    </div>
  );
}
