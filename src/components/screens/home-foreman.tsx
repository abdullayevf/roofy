import Link from "next/link";
import { CaretRight, CheckCircle, Tray, WarningDiamond } from "@phosphor-icons/react/dist/ssr";
import type { ForemanJobRow, HomeForeman, OutboxState } from "@/data/contracts";
import { formatDate } from "@/lib/format";
import { cx } from "@/lib/cx";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { daysSinceText, logStatusText, outboxStatus, stageLine } from "./home-text";
import { COLUMN, FOCUS, GROUP, HomeTitle, JobCard, KeyFigure, ROW, Section, whole } from "./home-parts";

const STATUS_ICON = {
  clear: { icon: CheckCircle, className: "text-ink-2" },
  waiting: { icon: Tray, className: "text-ink" },
  attention: { icon: WarningDiamond, className: "text-over" },
} as const;

function OutboxStatusRow({ items }: { items: { state: OutboxState }[] }) {
  const status = outboxStatus(items);
  const { icon: Glyph, className } = STATUS_ICON[status.tone];
  return (
    <Link href="/outbox" prefetch={false} className={cx(ROW, FOCUS)}>
      <Glyph size={24} aria-hidden="true" className={cx("shrink-0", className)} />
      <span className="min-w-0 flex-1 text-body text-ink [overflow-wrap:anywhere]">{status.text}</span>
      <CaretRight size={24} aria-hidden="true" className="shrink-0 text-ink-2" />
    </Link>
  );
}

function JobRow({ job }: { job: ForemanJobRow }) {
  return (
    <JobCard
      href={job.href}
      name={job.name}
      lines={[job.siteAddress, stageLine(job.currentStages)]}
      tape={{ label: `${job.name} progress`, percent: whole(job.pctBp) }}
    >
      <span className="mt-2 block text-meta text-ink">
        {job.loggedToday ? "Logged today" : daysSinceText(job.daysSinceLastLog)}
      </span>
    </JobCard>
  );
}

/** Log today, pinned above the tab bar like Log's Save day (in the form column from 1024 px). */
function LogTodayBar({ href }: { href: string }) {
  return (
    <div data-slot="primary-action" className="pin-action">
      <Button variant="primary" href={href} className="w-full">
        Log today
      </Button>
    </div>
  );
}

// The page pads its bottom so the pinned Log today bar never hides the last job.
const WITH_BAR = "pb-28 lg:pb-0";

export type HomeForemanProps = {
  home: HomeForeman;
  /** This device's own queue (device-local), passed in by the page. */
  outbox: { state: OutboxState }[];
};

/**
 * Home for a foreman (flows.md screen 5): today's log status as the lead figure, the outbox status, the assigned
 * jobs and a pinned Log today. No dollars: the data has none.
 */
export function HomeForemanBody({ home, outbox }: HomeForemanProps) {
  const waiting = outbox.filter((i) => i.state === "waiting" || i.state === "sending").length;
  const attention = outbox.filter((i) => i.state === "needs_attention").length;
  if (home.jobs.length === 0) {
    return (
      <div data-screen="home" className={COLUMN}>
        <HomeTitle waiting={waiting} attention={attention} />
        <EmptyState message="No jobs yet. Ask your manager to add you to a job." />
      </div>
    );
  }
  return (
    <div data-screen="home" className={cx(COLUMN, WITH_BAR)}>
      <header className="flex flex-col gap-1">
        <HomeTitle waiting={waiting} attention={attention} />
        <p className="text-meta text-ink">{formatDate(home.today, home.today)}</p>
        <KeyFigure>{logStatusText(home.loggedToday)}</KeyFigure>
      </header>

      <Section title="On this device">
        <div className={GROUP}>
          <OutboxStatusRow items={outbox} />
        </div>
      </Section>

      <Section title="Your jobs">
        <div className={GROUP}>
          {home.jobs.map((job) => (
            <JobRow key={job.projectId} job={job} />
          ))}
        </div>
      </Section>

      <LogTodayBar href={home.logToday.href} />
    </div>
  );
}

/** Foreman Home while it loads (`?demo=loading`): the title, date, headings and Log today are real; only the jobs are blocks. */
export function HomeForemanSkeleton({ today }: { today: string }) {
  return (
    <div data-screen="home" aria-busy="true" className={cx(COLUMN, WITH_BAR)}>
      <header className="flex flex-col gap-2">
        <h1 className="text-title text-ink">Home</h1>
        <p className="text-meta text-ink">{formatDate(today, today)}</p>
        <Skeleton width={240} height={44} />
      </header>
      <Section title="On this device">
        <div className={cx(GROUP, "overflow-hidden")}>
          <div className="flex min-h-14 items-center px-4">
            <Skeleton height={24} />
          </div>
        </div>
      </Section>
      <Section title="Your jobs">
        <div className={cx(GROUP, "overflow-hidden")}>
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center px-4" style={{ minHeight: 152 }}>
              <Skeleton height={104} />
            </div>
          ))}
        </div>
      </Section>
      <LogTodayBar href="/log" />
    </div>
  );
}
