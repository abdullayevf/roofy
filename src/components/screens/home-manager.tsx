import type { ActiveJobRow, HomeManager } from "@/data/contracts";
import type { Unit } from "@/domain/types";
import { WarningCircle, WarningDiamond } from "@phosphor-icons/react/dist/ssr";
import { formatDate, formatMoney, formatRoundedQuantity } from "@/lib/format";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/button";
import { List, type ListRow } from "@/components/ui/list";
import { MoneyCell } from "@/components/ui/money-cell";
import { Skeleton } from "@/components/ui/skeleton";
import { attentionSentence, figuresFromText, jobAlertText, overBudgetFigure, payFlagsText, showMoreText, stageLine } from "./home-text";
import { AttentionList } from "./attention-list";
import {
  AttentionRowSkeleton,
  CARD_BLOCK,
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
  ListRowSkeleton,
  Section,
  whole,
} from "./home-parts";

const figure = (text: string) => <span className="whitespace-nowrap text-figure num text-ink">{text}</span>;

const UNIT_ORDER: { unit: Unit; label: string }[] = [
  { unit: "m2", label: "Area installed" },
  { unit: "lm", label: "Length installed" },
  { unit: "each", label: "Items installed" },
];

/** "4 days ago" for the card's Last log line. */
function lastLog(days: number | null): string {
  return days === null ? "None yet" : days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

function JobRow({ job }: { job: ActiveJobRow }) {
  const alert = jobAlertText(job.alert, job.alertStageName, job.alertStageForecastCents, job.alertStageBudgetCents);
  // The bar is the whole job, so its marker is the whole job's forecast: shown only when that forecast lands over budget
  // (past the end cap). A stage that is over on its own is the sentence and the stage line, never the marker.
  const wholeJobOver = job.forecastBp !== null && job.forecastBp > 10_000;
  const forecast = wholeJobOver ? whole(job.forecastBp!) : undefined;
  return (
    <JobCard
      href={job.href}
      name={job.name}
      lines={[stageLine(job.currentStages)]}
      tape={{
        label: `${job.name} progress`,
        percent: whole(job.pctBp),
        tone: alert?.tone,
        markerTone: job.labourActualCents > job.labourBudgetCents ? "over" : "watch",
        note: alert?.text,
        forecastPercent: forecast,
        forecastLabel: forecast === undefined ? undefined : "Forecast",
      }}
    >
      <dl className={`mt-2 grid ${CARD_BLOCK} grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1`}>
        <dt className="whitespace-nowrap text-meta text-ink">Labour so far</dt>
        <dd className="text-right text-figure num text-ink [overflow-wrap:anywhere]">
          {formatMoney(job.labourActualCents)} of {formatMoney(job.labourBudgetCents)}
        </dd>
        <dt className="whitespace-nowrap text-meta text-ink">Forecast margin</dt>
        <dd className="text-right text-figure num text-ink [overflow-wrap:anywhere]">{formatMoney(job.forecastMarginCents)}</dd>
        <dt className="whitespace-nowrap text-meta text-ink">Last log</dt>
        <dd className="text-right text-figure num text-ink [overflow-wrap:anywhere]">{lastLog(job.daysSinceLastLog)}</dd>
      </dl>
    </JobCard>
  );
}

function lastWeekRows(home: HomeManager): ListRow[] {
  const w = home.lastWeek;
  const installed = UNIT_ORDER.map((u) => ({ ...u, quantity: w.installed.find((i) => i.unit === u.unit)?.quantity ?? 0 })).filter(
    (u) => u.quantity !== 0,
  );
  return [
    { key: "labour", primary: "Labour", figure: <MoneyCell cents={w.labourCostCents} /> },
    { key: "hours", primary: "Hours", figure: figure(formatRoundedQuantity(w.hours, "h")) },
    { key: "days", primary: "Crew-days", figure: figure(String(w.crewDays)) },
    // One row per unit, so each figure stays on one line.
    ...(installed.length === 0
      ? [{ key: "installed", primary: "Installed", figure: figure("None") }]
      : installed.map((u) => ({
          key: `installed-${u.unit}`,
          primary: u.label,
          figure: figure(formatRoundedQuantity(u.quantity, u.unit)),
        }))),
    { key: "expenses", primary: "Expenses", figure: <MoneyCell cents={w.expensesCents} />, href: "/expenses" },
    {
      key: "utilisation",
      primary: "Crew utilisation",
      figure: figure(w.utilisationBp === null ? "None" : `${whole(w.utilisationBp)}%`),
    },
    ...(w.gaps > 0
      ? [{ key: "gaps", primary: "Days with no log", figure: figure(String(w.gaps)), href: "/history" }]
      : []),
  ];
}

function payRows(home: HomeManager): ListRow[] {
  const p = home.payPeriod;
  if (!p) return [];
  return [
    { key: "total", primary: "Draft total", figure: <MoneyCell cents={p.draftTotalCents} />, href: p.href },
    { key: "employees", primary: "Employees", figure: <MoneyCell cents={p.employeesCents} />, href: p.href },
    { key: "contractors", primary: "Contractors", figure: <MoneyCell cents={p.contractorsCents} />, href: p.href },
    { key: "owed", primary: "Balances still owed", figure: <MoneyCell cents={p.outstandingBalancesCents} />, href: "/crew" },
  ];
}

/** A workspace with nothing in it yet: no jobs, nothing to attend to, nothing logged, no pay run. */
const isNewWorkspace = (home: HomeManager) =>
  home.activeJobs.length === 0 &&
  home.needsAttention.length === 0 &&
  home.lastWeek.crewDays === 0 &&
  home.payPeriod === null;

export type HomeManagerProps = {
  home: HomeManager;
  role: "owner" | "manager" | "accountant";
  /** Entries waiting to send / failed on this device (device-local, passed in by the page). */
  outbox: { waiting: number; attention: number };
  /** The phone has no signal: the figures are the last ones it loaded. */
  offline: boolean;
};

/** Home for an owner, manager or accountant (flows.md screen 4). Props only; the page fetches. */
export function HomeManagerBody({ home, role, outbox, offline }: HomeManagerProps) {
  if (isNewWorkspace(home)) {
    return (
      <div data-screen="home" className={COLUMN}>
        <HomeTitle {...outbox} />
        <HomeEmpty message="No jobs yet." actionLabel="Add your first job" href="/jobs/new" />
      </div>
    );
  }
  const flagged = home.activeJobs.filter((j) => j.alert !== null).length;
  const trending = home.activeJobs.filter((j) => j.alert?.level === "trending").length;
  const week = home.lastWeek;
  const pay = home.payPeriod;
  const rowOf = (item: HomeManager["needsAttention"][number]) => ({
    id: item.id,
    severity: item.severity,
    sentence: attentionSentence(item, home.today),
    href: item.href,
  });
  return (
    <div data-screen="home" className={cx(COLUMN, "lg:max-w-5xl")}>
      <header className="flex flex-col gap-1">
        <HomeTitle {...outbox} />
        {offline ? (
          <p className="text-meta text-ink">{figuresFromText(home.asOf, home.timeZone, home.today)}</p>
        ) : null}
        {flagged > 0 ? (
          <a href="#needs-attention" className={cx("mt-2 block max-w-fit rounded-control", FOCUS)}>
            <KeyFigure>{overBudgetFigure(flagged)}</KeyFigure>
            {trending > 0 ? <span className="block text-body text-ink">Includes jobs trending over their labour budget.</span> : null}
          </a>
        ) : null}
      </header>

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10">
        <div className="flex flex-col gap-8 lg:gap-10">
          <Section title="Needs attention" id="needs-attention">
            {home.needsAttention.length === 0 ? (
              <p className="text-body text-ink">Nothing needs your attention today.</p>
            ) : (
              <div className={GROUP}>
                <AttentionList
                  rows={home.needsAttention.map(rowOf)}
                  more={home.moreAttention.map(rowOf)}
                  showMoreLabel={showMoreText(home.moreAttention.length)}
                />
              </div>
            )}
          </Section>

          <Section title="Active jobs">
            {home.activeJobs.length === 0 ? (
              <HomeEmpty message="No jobs yet." actionLabel="Add your first job" href="/jobs/new" />
            ) : (
              <div className={GROUP}>
                {home.activeJobs.map((job) => (
                  <JobRow key={job.projectId} job={job} />
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-8 lg:gap-10">
          <Section title="Last week">
            <p className="text-meta text-ink">
              {formatDate(week.period.start, home.today)} to {formatDate(week.period.end, home.today)}
            </p>
            <List rows={lastWeekRows(home)} reserveChevron />
          </Section>
          {pay ? (
            <Section title="This pay period">
              <List rows={payRows(home)} />
              {pay.flagCount > 0 ? (
                <p className={cx("flex items-start gap-2 text-body-strong", pay.blocking ? "text-over" : "text-watch")}>
                  {pay.blocking ? (
                    <WarningCircle size={24} aria-hidden="true" className="shrink-0" />
                  ) : (
                    <WarningDiamond size={24} aria-hidden="true" className="shrink-0" />
                  )}
                  <span>{payFlagsText(pay.flagCount, pay.blockers, role)}</span>
                </p>
              ) : null}
              <Button variant="secondary" href={pay.href} className={HOME_BUTTON}>
                {role === "accountant" ? "Open pay run" : "Review pay run"}
              </Button>
              {offline && role !== "accountant" ? <p className="text-meta text-ink">Needs signal to approve.</p> : null}
            </Section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SkeletonGroup({ rows, row: Row }: { rows: number; row: () => React.ReactElement }) {
  return (
    <div className={cx(GROUP, "overflow-hidden")}>
      {Array.from({ length: rows }, (_, i) => (
        <Row key={i} />
      ))}
    </div>
  );
}

/**
 * Home while it loads (`?demo=loading`): the title and headings are real, only the fetched figures are blocks,
 * shaped like what replaces them (the real number of attention rows, job cards with a tape slot, list rows with
 * a label, a figure and the chevron's slot) so nothing jumps.
 */
export function HomeSkeleton() {
  return (
    <div data-screen="home" aria-busy="true" className={cx(COLUMN, "lg:max-w-5xl")}>
      <header className="flex flex-col gap-1">
        <HomeTitle waiting={0} attention={0} />
        <div className="mt-2">
          <KeyFigureSkeleton width={140} />
          <div className="flex h-5 items-center">
            <Skeleton width={260} height={14} />
          </div>
        </div>
      </header>
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10">
        <div className="flex flex-col gap-8 lg:gap-10">
          <Section title="Needs attention">
            <SkeletonGroup rows={7} row={AttentionRowSkeleton} />
          </Section>
          <Section title="Active jobs">
            <div className={cx(GROUP, "overflow-hidden")}>
              {[0, 1, 2, 3, 4].map((i) => (
                <JobCardSkeleton key={i} lines={1} figures={3} />
              ))}
            </div>
          </Section>
        </div>
        <div className="flex flex-col gap-8 lg:gap-10">
          <Section title="Last week">
            <div className="flex h-5 items-center">
              <Skeleton width={160} height={14} />
            </div>
            <SkeletonGroup rows={8} row={ListRowSkeleton} />
          </Section>
          <Section title="This pay period">
            <SkeletonGroup rows={4} row={ListRowSkeleton} />
          </Section>
        </div>
      </div>
    </div>
  );
}
