import type { ActiveJobRow, HomeManager } from "@/data/contracts";
import type { Unit } from "@/domain/types";
import { formatDate, formatDateTime, formatHours, formatMoney, formatQuantity } from "@/lib/format";
import { cx } from "@/lib/cx";
import { EmptyState } from "@/components/empty-state";
import { NeedsAttentionItem } from "@/components/needs-attention-item";
import { Button } from "@/components/ui/button";
import { List, type ListRow } from "@/components/ui/list";
import { MoneyCell } from "@/components/ui/money-cell";
import { Skeleton } from "@/components/ui/skeleton";
import { attentionSentence, jobAlertText, moreAttentionText, payFlagsText, stageLine } from "./home-text";
import { COLUMN, GROUP, HomeTitle, JobCard, KeyFigure, Section, whole } from "./home-parts";

const figure = (text: string) => <span className="whitespace-nowrap text-figure num text-ink">{text}</span>;

const UNIT_ORDER: { unit: Unit; label: string }[] = [
  { unit: "m2", label: "m²" },
  { unit: "lm", label: "lm" },
  { unit: "each", label: "each" },
];

/** "4 days ago" for the card's Last log line. */
function lastLog(days: number | null): string {
  return days === null ? "None yet" : days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

function JobRow({ job }: { job: ActiveJobRow }) {
  const alert = jobAlertText(job.alert, job.alertStageName);
  const forecast = alert && job.forecastBp !== null ? whole(job.forecastBp) : undefined;
  return (
    <JobCard
      href={job.href}
      name={job.name}
      lines={[stageLine(job.currentStages), "Whole job"]}
      tape={{
        label: `${job.name} progress`,
        percent: whole(job.pctBp),
        tone: alert?.tone,
        note: alert?.text,
        forecastPercent: forecast,
        forecastLabel: forecast === undefined ? undefined : "Forecast",
      }}
    >
      <dl className="mt-2 grid max-w-md grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1">
        <dt className="text-meta text-ink">Labour so far</dt>
        <dd className="text-right text-figure num text-ink">
          {formatMoney(job.labourActualCents)} of {formatMoney(job.labourBudgetCents)}
        </dd>
        <dt className="text-meta text-ink">Forecast margin</dt>
        <dd className="text-right text-figure num text-ink">{formatMoney(job.forecastMarginCents)}</dd>
        <dt className="text-meta text-ink">Last log</dt>
        <dd className="text-right text-figure num text-ink">{lastLog(job.daysSinceLastLog)}</dd>
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
    { key: "hours", primary: "Hours", figure: figure(formatHours(w.hours)) },
    { key: "days", primary: "Crew-days", figure: figure(String(w.crewDays)) },
    // One row per unit, so each figure stays on one line.
    ...(installed.length === 0
      ? [{ key: "installed", primary: "Installed", figure: figure("None") }]
      : installed.map((u) => ({
          key: `installed-${u.unit}`,
          primary: `Installed (${u.label})`,
          figure: figure(formatQuantity(u.quantity, "each")),
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
        <EmptyState message="No jobs yet. Add your first job." actionLabel="Add a job" href="/jobs/new" />
      </div>
    );
  }
  const week = home.lastWeek;
  const pay = home.payPeriod;
  return (
    <div data-screen="home" className={cx(COLUMN, "lg:max-w-5xl")}>
      <header className="flex flex-col gap-1">
        <HomeTitle {...outbox} />
        {offline ? (
          <p className="text-body-strong text-ink">
            Figures from {formatDateTime(home.asOf, home.timeZone, home.today)}. They update when you&rsquo;re back online.
          </p>
        ) : null}
        <p className="text-meta text-ink">
          Labour last week, {formatDate(week.period.start, home.today)} to {formatDate(week.period.end, home.today)}
        </p>
        <KeyFigure>{formatMoney(week.labourCostCents)}</KeyFigure>
      </header>

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10">
        <div className="flex flex-col gap-8 lg:gap-10">
          <Section title="Needs attention">
            {home.needsAttention.length === 0 ? (
              <p className="text-body text-ink">Nothing needs your attention today.</p>
            ) : (
              <div className={GROUP}>
                {home.needsAttention.map((item) => (
                  <NeedsAttentionItem
                    key={item.id}
                    severity={item.severity}
                    sentence={attentionSentence(item, home.today)}
                    href={item.href}
                  />
                ))}
                {home.needsAttentionMore > 0 ? (
                  <p className="px-4 py-3 text-meta text-ink">{moreAttentionText(home.needsAttentionMore)}</p>
                ) : null}
              </div>
            )}
          </Section>

          <Section title="Active jobs">
            {home.activeJobs.length === 0 ? (
              <EmptyState message="No jobs yet. Add your first job." actionLabel="Add a job" href="/jobs/new" />
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
            <List rows={lastWeekRows(home)} />
          </Section>
          {pay ? (
            <Section title="This pay period">
              <List rows={payRows(home)} />
              {pay.flagCount > 0 ? (
                <p className={cx("text-body-strong", pay.blocking ? "text-over" : "text-watch")}>
                  {payFlagsText(pay.flagCount, pay.blocking, role)}
                </p>
              ) : null}
              <Button variant="secondary" href={pay.href}>
                {role === "accountant" ? "Open pay run" : "Review pay run"}
              </Button>
            </Section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SkeletonGroup({ rows, height }: { rows: number; height: number }) {
  return (
    <div className={cx(GROUP, "overflow-hidden")}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center px-4" style={{ minHeight: height }}>
          <Skeleton height={24} />
        </div>
      ))}
    </div>
  );
}

/**
 * Home while it loads (`?demo=loading`): the title and headings are real, only the fetched figures are blocks,
 * sized like what replaces them (56 px attention rows, 208 px job cards, 64 px list rows) so nothing jumps.
 */
export function HomeSkeleton() {
  return (
    <div data-screen="home" aria-busy="true" className={cx(COLUMN, "lg:max-w-5xl")}>
      <header className="flex flex-col gap-2">
        <h1 className="text-title text-ink">Home</h1>
        <Skeleton width={220} height={20} />
        <Skeleton width={180} height={44} />
      </header>
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10">
        <div className="flex flex-col gap-8 lg:gap-10">
          <Section title="Needs attention">
            <SkeletonGroup rows={3} height={56} />
          </Section>
          <Section title="Active jobs">
            <SkeletonGroup rows={2} height={208} />
          </Section>
        </div>
        <div className="flex flex-col gap-8 lg:gap-10">
          <Section title="Last week">
            <SkeletonGroup rows={5} height={64} />
          </Section>
          <Section title="This pay period">
            <SkeletonGroup rows={4} height={64} />
          </Section>
        </div>
      </div>
    </div>
  );
}
