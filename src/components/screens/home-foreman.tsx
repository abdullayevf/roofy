import Link from "next/link";
import { CaretRight, CheckCircle, Tray, WarningDiamond } from "@phosphor-icons/react/dist/ssr";
import type { ForemanJobRow, HomeForeman, OutboxState } from "@/data/contracts";
import { formatDate } from "@/lib/format";
import { cx } from "@/lib/cx";
import { TapeBar } from "@/components/tape-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { daysSinceText, outboxStatus, stageLine } from "./home-text";

/** Same width rule as the manager Home: rows stay within ~600 px on a wide phone or tablet (i6-F2). */
const GROUP_WIDTH = "max-w-150 lg:max-w-none";
const GROUP = "divide-y divide-line rounded-group border-group bg-surface";
const FOCUS =
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-3 focus-visible:outline-chalk-link";

const whole = (bp: number) => Math.round(bp / 100);

const STATUS_ICON = {
  clear: { icon: CheckCircle, className: "text-ink-2" },
  waiting: { icon: Tray, className: "text-ink" },
  attention: { icon: WarningDiamond, className: "text-watch" },
} as const;

function OutboxStatusRow({ items }: { items: { state: OutboxState }[] }) {
  const status = outboxStatus(items);
  const { icon: Glyph, className } = STATUS_ICON[status.tone];
  return (
    <Link
      href="/outbox"
      prefetch={false}
      className={cx(
        "flex min-h-14 items-center gap-3 px-4 py-2 active:bg-galv first:rounded-t-group last:rounded-b-group",
        FOCUS,
      )}
    >
      <Glyph size={24} aria-hidden="true" className={cx("shrink-0", className)} />
      <span className="min-w-0 flex-1 text-body text-ink [overflow-wrap:anywhere]">{status.text}</span>
      <CaretRight size={24} aria-hidden="true" className="shrink-0 text-ink-2" />
    </Link>
  );
}

function JobRow({ job }: { job: ForemanJobRow }) {
  return (
    <Link
      href={job.href}
      prefetch={false}
      className={cx("block min-h-[64px] px-4 py-3 first:rounded-t-group last:rounded-b-group active:bg-galv lg:py-2", FOCUS)}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-body-strong text-ink [overflow-wrap:anywhere]">{job.name}</span>
          <span className="block text-meta text-ink [overflow-wrap:anywhere]">{job.siteAddress}</span>
          <span className="block text-meta text-ink [overflow-wrap:anywhere]">{stageLine(job.currentStages)}</span>
        </span>
        <CaretRight size={24} aria-hidden="true" className="mt-3 shrink-0 text-ink-2" />
      </span>
      <TapeBar className="mt-2" label={`${job.name} progress`} percent={whole(job.pctBp)} />
      <span className="mt-2 block text-meta text-ink">
        {job.loggedToday ? "Logged today" : daysSinceText(job.daysSinceLastLog)}
      </span>
    </Link>
  );
}

/**
 * Home for a foreman (flows.md screen 5): Log today, the outbox status and the assigned jobs. No dollars: the
 * data has none. `outbox` is the phone's own queue (device-local), passed in by the page.
 */
export function HomeForemanBody({ home, outbox }: { home: HomeForeman; outbox: { state: OutboxState }[] }) {
  return (
    <div data-screen="home" className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-title text-ink">Home</h1>
        <p className="text-meta text-ink">{formatDate(home.today, home.today)}</p>
      </header>

      <div className={cx("flex flex-col gap-4", GROUP_WIDTH)}>
        {home.jobs.length > 0 ? (
          <Button variant="primary" href={home.logToday.href}>
            Log today
          </Button>
        ) : null}
        <section className="flex flex-col gap-2">
          <h2 className="text-heading text-ink">On this phone</h2>
          <div className={GROUP}>
            <OutboxStatusRow items={outbox} />
          </div>
        </section>
      </div>

      <section className={cx("flex flex-col gap-2", GROUP_WIDTH)}>
        <h2 className="text-heading text-ink">Your jobs</h2>
        {home.jobs.length === 0 ? (
          <p className="text-body text-ink-2">No jobs yet. Ask your manager to add you to a job.</p>
        ) : (
          <div className={GROUP}>
            {home.jobs.map((job) => (
              <JobRow key={job.projectId} job={job} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Foreman Home while it loads (`?demo=loading`). */
export function HomeForemanSkeleton() {
  return (
    <div data-screen="home" aria-busy="true" className="flex flex-col gap-6">
      <h1 className="text-title text-ink">Home</h1>
      <Skeleton width={120} height={20} />
      <div className={cx("flex flex-col gap-4", GROUP_WIDTH)}>
        <Skeleton height={52} />
        <div className={cx(GROUP, "overflow-hidden")}>
          <div className="px-4 py-3">
            <Skeleton height={24} />
          </div>
        </div>
      </div>
      <div className={cx(GROUP, "overflow-hidden", GROUP_WIDTH)}>
        {[0, 1].map((i) => (
          <div key={i} className="px-4 py-3">
            <Skeleton height={100} />
          </div>
        ))}
      </div>
    </div>
  );
}
