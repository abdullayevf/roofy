import Link from "next/link";
import { CaretRight, CheckCircle, Tray, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { ForemanJobRow, HomeForeman, OutboxState } from "@/data/contracts";
import { formatDate } from "@/lib/format";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { daysSinceText, jobsFromText, foremanHeadline, loggedOnDevice, outboxStatus, stageLine, unsentJobIds } from "./home-text";
import {
  COLUMN,
  FOCUS,
  GROUP,
  HOME_BUTTON,
  HomeEmpty,
  HomeTitle,
  JobCard,
  JobCardSkeleton,
  KeyFigure,
  KeyFigureSkeleton,
  ROW,
  Section,
  whole,
} from "./home-parts";

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

/** The "On this device" section: what is still to send. Also under the error, since logging works without the server. */
export function OnThisDevice({ outbox }: { outbox: { state: OutboxState }[] }) {
  return (
    <Section title="On this device">
      <div className={GROUP}>
        <OutboxStatusRow items={outbox} />
      </div>
    </Section>
  );
}

function JobRow({ job, unsent }: { job: ForemanJobRow; unsent: boolean }) {
  return (
    <JobCard
      href={job.href}
      name={job.name}
      lines={[job.siteAddress, stageLine(job.currentStages)]}
      tape={{ label: `${job.name} progress`, percent: whole(job.pctBp) }}
    >
      <span className="mt-2 block text-meta text-ink">
        {unsent ? "Logged today, not sent yet" : job.loggedToday ? "Logged today" : daysSinceText(job.daysSinceLastLog)}
      </span>
    </JobCard>
  );
}

export type HomeForemanProps = {
  home: HomeForeman;
  /** This device's own queue (device-local), passed in by the page. */
  outbox: { state: OutboxState; date: string; entry: { type: string; input: object }; projectName?: string | null }[];
  /** No signal: the jobs are the last ones the phone loaded. */
  offline: boolean;
};

/**
 * Home for a foreman (flows.md screen 5): the headline (a failed entry, else a crew-day not sent yet, else today's
 * log status), its button, the outbox status and the assigned jobs. No dollars: the data has none.
 */
export function HomeForemanBody({ home, outbox, offline }: HomeForemanProps) {
  const waiting = outbox.filter((i) => i.state === "waiting" || i.state === "sending").length;
  const attention = outbox.filter((i) => i.state === "needs_attention").length;
  if (home.jobs.length === 0) {
    return (
      <div data-screen="home" className={COLUMN}>
        <HomeTitle waiting={waiting} attention={attention} />
        <HomeEmpty message="You can log once your manager adds you to a job." />
        <OnThisDevice outbox={outbox} />
      </div>
    );
  }
  const headline = foremanHeadline(
    home.loggedToday,
    outbox,
    home.today,
    Object.fromEntries(home.jobs.map((j) => [j.projectId, j.name])),
  );
  // Today is logged on this device already (or a failed entry needs fixing): Log today steps back.
  const stepBack = headline.fix || loggedOnDevice(outbox, home.today);
  const unsent = unsentJobIds(outbox, home.today);
  return (
    <div data-screen="home" className={COLUMN}>
      <header className="flex flex-col gap-1">
        <HomeTitle waiting={waiting} attention={attention} />
        <p className="text-meta text-ink">
          {offline ? jobsFromText(home.asOf, home.timeZone, home.today) : formatDate(home.today, home.today)}
        </p>
        <KeyFigure>{headline.text}</KeyFigure>
        <div className="mt-3 flex flex-col gap-3">
          {headline.fix ? (
            <Button variant="primary" href="/outbox" className={HOME_BUTTON}>
              Fix entry
            </Button>
          ) : null}
          <Button variant={stepBack ? "secondary" : "primary"} href={home.logToday.href} className={HOME_BUTTON}>
            Log today
          </Button>
        </div>
      </header>

      <OnThisDevice outbox={outbox} />

      <Section title="Your jobs">
        <div className={GROUP}>
          {home.jobs.map((job) => (
            <JobRow key={job.projectId} job={job} unsent={unsent.has(job.projectId)} />
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
        <KeyFigureSkeleton width={240} />
        <div className="mt-3 flex flex-col gap-3">
          <Button variant="primary" href="/log" className={HOME_BUTTON}>
            Log today
          </Button>
        </div>
      </header>
      <Section title="On this device">
        <div className={cx(GROUP, "overflow-hidden")}>
          <div className="flex min-h-14 items-center gap-3 px-4 py-2 lg:min-h-12">
            <Skeleton width={24} height={24} rounded="full" className="shrink-0" />
            <div className="flex-1">
              <Skeleton width={220} height={20} />
            </div>
            <Skeleton width={24} height={24} className="shrink-0" />
          </div>
        </div>
      </Section>
      <Section title="Your jobs">
        <div className={cx(GROUP, "overflow-hidden")}>
          {[0, 1].map((i) => (
            <JobCardSkeleton key={i} lines={2} figures={0} />
          ))}
        </div>
      </Section>
    </div>
  );
}
