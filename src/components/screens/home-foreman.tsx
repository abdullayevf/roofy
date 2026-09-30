import Link from "next/link";
import { CaretRight, CheckCircle, Tray, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { ForemanJobRow, HomeForeman, OutboxState } from "@/data/contracts";
import { formatDate } from "@/lib/format";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { daysSinceText, foremanLogStatus, loggedOnDevice, offlineDateLine, outboxStatus, stageLine } from "./home-text";
import { COLUMN, FOCUS, GROUP, HomeEmpty, HomeTitle, JobCard, JobCardSkeleton, KeyFigure, ROW, Section, whole } from "./home-parts";

const STATUS_ICON = {
  clear: { icon: CheckCircle, className: "text-ink-2" },
  waiting: { icon: Tray, className: "text-ink" },
  attention: { icon: WarningCircle, className: "text-over" },
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

function OnThisDevice({ outbox }: { outbox: { state: OutboxState }[] }) {
  return (
    <Section title="On this device">
      <div className={GROUP}>
        <OutboxStatusRow items={outbox} />
      </div>
    </Section>
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

export type HomeForemanProps = {
  home: HomeForeman;
  /** This device's own queue (device-local), passed in by the page. */
  outbox: { state: OutboxState; date: string; entry: { type: string } }[];
  /** No signal: the jobs are the last ones the phone loaded. */
  offline: boolean;
};

/**
 * Home for a foreman (flows.md screen 5): today's log status as the lead figure, the outbox status, the assigned
 * jobs and a Log today button under it. No dollars: the data has none.
 */
export function HomeForemanBody({ home, outbox, offline }: HomeForemanProps) {
  const waiting = outbox.filter((i) => i.state === "waiting" || i.state === "sending").length;
  const attention = outbox.filter((i) => i.state === "needs_attention").length;
  const onDevice = loggedOnDevice(outbox, home.today);
  if (home.jobs.length === 0) {
    return (
      <div data-screen="home" className={COLUMN}>
        <HomeTitle waiting={waiting} attention={attention} />
        <HomeEmpty message="No jobs yet. Ask your manager to add you to a job. The Log tab needs a job first." />
        <OnThisDevice outbox={outbox} />
      </div>
    );
  }
  return (
    <div data-screen="home" className={COLUMN}>
      <header className="flex flex-col gap-1">
        <HomeTitle waiting={waiting} attention={attention} />
        <p className="text-meta text-ink">
          {offline ? offlineDateLine(home.today, home.asOf, home.timeZone) : formatDate(home.today, home.today)}
        </p>
        {/* A crew-day waiting on this device counts as logged, so Log today is no longer the main action. */}
        <KeyFigure>{foremanLogStatus(home.loggedToday, onDevice)}</KeyFigure>
        <Button
          variant={onDevice ? "secondary" : "primary"}
          href={home.logToday.href}
          className="mt-3 w-full sm:w-auto sm:min-w-72 sm:self-start"
        >
          Log today
        </Button>
      </header>

      <OnThisDevice outbox={outbox} />

      <Section title="Your jobs">
        <div className={GROUP}>
          {home.jobs.map((job) => (
            <JobRow key={job.projectId} job={job} />
          ))}
        </div>
      </Section>

    </div>
  );
}

/** Foreman Home while it loads (`?demo=loading`): the title, date, headings and Log today are real; only the fetched parts are blocks. */
export function HomeForemanSkeleton({ today }: { today: string }) {
  return (
    <div data-screen="home" aria-busy="true" className={COLUMN}>
      <header className="flex flex-col gap-1">
        <HomeTitle waiting={0} attention={0} />
        <p className="text-meta text-ink">{formatDate(today, today)}</p>
        <Skeleton width={240} height={44} />
        <Button variant="primary" href="/log" className="mt-3 w-full sm:w-auto sm:min-w-72 sm:self-start">
          Log today
        </Button>
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
            <JobCardSkeleton key={i} lines={2} figures={1} />
          ))}
        </div>
      </Section>
    </div>
  );
}
