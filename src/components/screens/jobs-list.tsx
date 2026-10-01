import type { ProjectList, ProjectRowForeman, ProjectRowManager } from "@/data/contracts";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { LoadError } from "./field-entry";
import { COLUMN, GROUP, JobCardSkeleton } from "./home-parts";
import { JobsGroup } from "./jobs-group";
import { JobsFilter } from "./jobs-filter";
import { statusEmptyMessage, type JobFilter } from "./job-input";

function Header({ canAdd }: { canAdd: boolean }) {
  return (
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h1 className="text-title text-ink">Jobs</h1>
      {canAdd ? (
        <Button variant="primary" href="/jobs/new">
          Add job
        </Button>
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
  demo?: string;
};

/** Jobs list (flows.md screen 9): the status filter, then one card per job. Props only; the page fetches. */
export function JobsListBody({ list, filter, anyJobs, canAdd, demo }: JobsListProps) {
  const foreman = list.view === "foreman";
  const rows: (ProjectRowForeman | ProjectRowManager)[] = list.rows;
  if (rows.length === 0 && !anyJobs) {
    return (
      <div data-screen="jobs" className={COLUMN}>
        <Header canAdd={false} />
        <div className="flex min-h-[50dvh] flex-col justify-center">
          {foreman ? (
            <EmptyState message="You can see jobs once a manager adds you to one." actionLabel="Go to Log" href="/log" />
          ) : canAdd ? (
            <EmptyState message="No jobs yet. Add your first job." actionLabel="Add your first job" href="/jobs/new" />
          ) : (
            <EmptyState message="No jobs yet." actionLabel="Go to Home" href="/" />
          )}
        </div>
      </div>
    );
  }
  return (
    <div data-screen="jobs" className={COLUMN}>
      <Header canAdd={canAdd} />
      <JobsFilter value={filter} demo={demo} />
      {rows.length === 0 ? (
        <p className="text-body text-ink">{statusEmptyMessage(filter === "all" ? "active" : filter)}</p>
      ) : (
        <JobsGroup rows={rows} manager={!foreman} />
      )}
    </div>
  );
}

/** The list when the server can't answer: the title and filter stay, the list area says so. */
export function JobsError({ canAdd, filter, demo }: { canAdd: boolean; filter: JobFilter; demo?: string }) {
  return (
    <div data-screen="jobs" className={COLUMN}>
      <Header canAdd={canAdd} />
      <JobsFilter value={filter} demo={demo} />
      <LoadError />
    </div>
  );
}

/** The list while it loads (`?demo=loading`): the title and filter are real, the cards are blocks shaped like them. */
export function JobsSkeleton({ manager }: { manager: boolean }) {
  return (
    <div data-screen="jobs" aria-busy="true" className={COLUMN}>
      <div className="flex min-h-12 items-center justify-between gap-4">
        <h1 className="text-title text-ink">Jobs</h1>
        {manager ? <Skeleton width={104} height={52} /> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {[84, 92, 96, 104, 96, 56].map((w, i) => (
          <Skeleton key={i} width={w} height={48} rounded="full" />
        ))}
      </div>
      <div className={cx(GROUP, "overflow-hidden")}>
        {Array.from({ length: 4 }, (_, i) => (
          <JobCardSkeleton key={i} lines={2} figures={manager ? 3 : 0} />
        ))}
      </div>
    </div>
  );
}
