import type { ProjectList } from "@/data/contracts";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { LoadError } from "./field-entry";
import { COLUMN, GROUP, KeyFigure } from "./home-parts";
import { overBudgetFigure } from "./home-text";
import { JobsAddBar } from "./jobs-add-bar";
import { JobsGroup } from "./jobs-group";
import { JobsFilter } from "./jobs-filter";
import { overBudgetJobs, statusEmptyMessage, type JobFilter } from "./job-input";

/** The Jobs page column: left-aligned from 1024 px, where the list is a table the width of the content. */
const JOBS_COLUMN = cx(COLUMN, "lg:max-w-none");

/** The title, and Add job beside it from 1024 px (on a phone it is pinned at the bottom instead, in thumb reach). */
function Header({ canAdd }: { canAdd: boolean }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-x-4">
      <h1 className="text-title text-ink">Jobs</h1>
      {canAdd ? (
        <div className="hidden lg:block">
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
        <Header canAdd={false} />
        <div className="flex min-h-[50dvh] flex-col justify-center">
          {foreman ? (
            <EmptyState message="You can see jobs once a manager adds you to one." />
          ) : canAdd ? (
            <EmptyState message="No jobs yet. Add your first job." actionLabel="Add your first job" href="/jobs/new" />
          ) : (
            <EmptyState message="No jobs yet." actionLabel="Go to Home" href="/" />
          )}
        </div>
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
      {foreman ? null : <JobsFilter value={filter} demo={demo} />}
      {list.rows.length === 0 ? (
        <p className="text-body text-ink">{statusEmptyMessage(filter === "all" ? "active" : filter)}</p>
      ) : (
        <JobsGroup list={list} today={today} />
      )}
      {canAdd ? <JobsAddBar /> : null}
    </div>
  );
}

/** The list when the server can't answer: the title and filter stay, the list area says so. */
export function JobsError({ canAdd, filter, demo }: { canAdd: boolean; filter: JobFilter; demo?: string }) {
  return (
    <div data-screen="jobs" className={JOBS_COLUMN}>
      <Header canAdd={canAdd} />
      <JobsFilter value={filter} demo={demo} />
      <LoadError />
      {canAdd ? <JobsAddBar /> : null}
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

/**
 * The list while it loads (`?demo=loading`): the title and filter are real, the rows are blocks shaped like them.
 * `manager` = money figures and the filter (owner, manager, accountant); `canAdd` = the Add job bar.
 */
export function JobsSkeleton({ manager, canAdd }: { manager: boolean; canAdd: boolean }) {
  return (
    <div data-screen="jobs" aria-busy="true" className={JOBS_COLUMN}>
      <div className="flex min-h-12 items-center justify-between gap-4">
        <h1 className="text-title text-ink">Jobs</h1>
        {canAdd ? <Skeleton width={104} height={52} className="hidden lg:block" /> : null}
      </div>
      {manager ? (
        <div className="flex flex-wrap gap-2">
          {[84, 92, 96, 104, 96, 56].map((w, i) => (
            <Skeleton key={i} width={w} height={48} rounded="full" />
          ))}
        </div>
      ) : null}
      <div className={cx(GROUP, "divide-y divide-line overflow-hidden")}>
        {Array.from({ length: 4 }, (_, i) => (
          <JobRowSkeleton key={i} manager={manager} />
        ))}
      </div>
    </div>
  );
}
