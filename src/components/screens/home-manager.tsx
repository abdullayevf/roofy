import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { ActiveJobRow, HomeManager } from "@/data/contracts";
import { formatDate, formatHours, formatMoney, formatQuantity } from "@/lib/format";
import { cx } from "@/lib/cx";
import { EmptyState } from "@/components/empty-state";
import { NeedsAttentionItem } from "@/components/needs-attention-item";
import { TapeBar } from "@/components/tape-bar";
import { Button } from "@/components/ui/button";
import { List, type ListRow } from "@/components/ui/list";
import { MoneyCell } from "@/components/ui/money-cell";
import { Skeleton } from "@/components/ui/skeleton";
import { attentionSentence, daysSinceText, jobAlertText, stageLine } from "./home-text";

/** Grouped rows and money rows stay within ~600 px on a wide phone or tablet so a label and its amount stay together (i6-F2). */
const GROUP_WIDTH = "max-w-150 lg:max-w-none";
const GROUP = "divide-y divide-line rounded-group border-group bg-surface";
const FOCUS =
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-3 focus-visible:outline-chalk-link";

const whole = (bp: number) => Math.round(bp / 100);

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("flex flex-col gap-2", GROUP_WIDTH, className)}>
      <h2 className="text-heading text-ink">{title}</h2>
      {children}
    </section>
  );
}

const figure = (text: string) => <span className="whitespace-nowrap text-figure num text-ink">{text}</span>;

function JobRow({ job }: { job: ActiveJobRow }) {
  const alert = jobAlertText(job.alert);
  return (
    <Link
      href={job.href}
      prefetch={false}
      className={cx("block min-h-[64px] px-4 py-3 first:rounded-t-group last:rounded-b-group active:bg-galv lg:py-2", FOCUS)}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-body-strong text-ink [overflow-wrap:anywhere]">{job.name}</span>
          <span className="block text-meta text-ink [overflow-wrap:anywhere]">{stageLine(job.currentStages)}</span>
        </span>
        <CaretRight size={24} aria-hidden="true" className="mt-3 shrink-0 text-ink-2" />
      </span>
      <TapeBar
        className="mt-2"
        label={`${job.name} progress`}
        percent={whole(job.pctBp)}
        tone={alert?.tone}
        note={alert?.text}
      />
      <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-meta">
        <dt className="text-ink">Labour so far</dt>
        <dd className="text-right text-ink num">
          {formatMoney(job.labourActualCents)} of {formatMoney(job.labourBudgetCents)}
        </dd>
        <dt className="text-ink">Forecast margin</dt>
        <dd className="text-right text-ink num">{formatMoney(job.forecastMarginCents)}</dd>
        <dt className="text-ink">Days since last log</dt>
        <dd className="text-right text-ink">{daysSinceText(job.daysSinceLastLog)}</dd>
      </dl>
    </Link>
  );
}

function lastWeekRows(home: HomeManager): ListRow[] {
  const w = home.lastWeek;
  return [
    { key: "hours", primary: "Hours", figure: figure(formatHours(w.hours)) },
    { key: "days", primary: "Crew-days", figure: figure(String(w.crewDays)) },
    {
      key: "installed",
      primary: "Installed",
      // One line per unit, so a long total wraps between units rather than running off a zoomed screen.
      figure:
        w.installed.length === 0 ? (
          figure("None")
        ) : (
          <span className="flex flex-col items-end">
            {w.installed.map((i) => (
              <span key={i.unit}>{figure(formatQuantity(i.quantity, i.unit))}</span>
            ))}
          </span>
        ),
    },
    { key: "expenses", primary: "Expenses", figure: <MoneyCell cents={w.expensesCents} /> },
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
    { key: "employees", primary: "Employees", figure: <MoneyCell cents={p.employeesCents} /> },
    { key: "contractors", primary: "Contractors", figure: <MoneyCell cents={p.contractorsCents} /> },
    { key: "owed", primary: "Balances still owed", figure: <MoneyCell cents={p.outstandingBalancesCents} /> },
  ];
}

/** Home for an owner, manager or accountant (flows.md screen 4). Props only; the page fetches. */
export function HomeManagerBody({ home }: { home: HomeManager }) {
  const week = home.lastWeek;
  const pay = home.payPeriod;
  return (
    <div data-screen="home" className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-title text-ink">Home</h1>
        <p className="text-meta text-ink">
          Labour last week, {formatDate(week.period.start, home.today)} to {formatDate(week.period.end, home.today)}
        </p>
        {/* Same size as figure-xl, but never wider than the screen: at 200% text zoom the size gives way to the width. */}
        <p className="text-figure-xl num text-ink" style={{ fontSize: "min(2.5rem, 10.5vw)" }}>
          {formatMoney(week.labourCostCents)}
        </p>
      </header>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-6">
          <Section title="Needs attention">
            {home.needsAttention.length === 0 ? (
              <p className="text-body text-ink-2">Nothing needs your attention today.</p>
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

        <div className="flex flex-col gap-6">
          <Section title="Last week">
            <List rows={lastWeekRows(home)} />
          </Section>
          {pay ? (
            <Section title="This pay period">
              <List rows={payRows(home)} />
              {pay.flagCount > 0 ? (
                <p className={cx("text-meta", pay.blocking ? "text-over" : "text-watch")}>
                  {pay.flagCount === 1 ? "1 thing to check" : `${pay.flagCount} things to check`} before you approve
                  {pay.blocking ? ". One of them stops approval." : "."}
                </p>
              ) : null}
              <Button variant="secondary" href={pay.href}>
                Review pay run
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
    <div className={cx(GROUP, "overflow-hidden", GROUP_WIDTH)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="px-4 py-3">
          <Skeleton height={height} />
        </div>
      ))}
    </div>
  );
}

/** Home while it loads (`?demo=loading`): `line` blocks sized like the content. */
export function HomeSkeleton() {
  return (
    <div data-screen="home" aria-busy="true" className="flex flex-col gap-6">
      <h1 className="text-title text-ink">Home</h1>
      <div className="flex flex-col gap-2">
        <Skeleton width={200} height={20} />
        <Skeleton width={180} height={44} />
      </div>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-6">
          <SkeletonGroup rows={3} height={24} />
          <SkeletonGroup rows={2} height={120} />
        </div>
        <SkeletonGroup rows={5} height={24} />
      </div>
    </div>
  );
}
