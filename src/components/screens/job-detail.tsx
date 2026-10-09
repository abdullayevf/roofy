import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { ExpenseRowForeman, ExpenseRowManager, LogRowForeman, LogRowManager, ProjectDetail, ProjectDetailManager, StageRowForeman, StageRowManager } from "@/data/contracts";
import { cx } from "@/lib/cx";
import { formatDate, formatMoney } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { KeepTogether } from "@/components/keep-together";
import { NeedsAttentionItem } from "@/components/needs-attention-item";
import { TapeBar } from "@/components/tape-bar";
import { Button } from "@/components/ui/button";
import { List, type ListRow } from "@/components/ui/list";
import { MoneyCell } from "@/components/ui/money-cell";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip, type Status } from "@/components/ui/status-chip";
import { COLUMN, FOCUS, GROUP, KeyFigure, KeyFigureSkeleton, Section, whole } from "./home-parts";
import { LoadError } from "./field-entry";
import { crewWeekText, jobStageStatus, labourAlertSentence, logQuantityText, stageAlertNote, stageProgressText } from "./job-detail-text";
import { jobTypeLabel } from "./job-input";

/** How many recent logs and expenses show before the link to the full list. */
export const RECENT_SHOWN = 5;

const JOB_CHIP: Record<ProjectDetail["status"], Status> = {
  active: "active",
  quoted: "quoted",
  on_hold: "on-hold",
  complete: "complete",
  closed: "closed",
};

/** Where a figure's source lines are: the record history for the job (the lists it links to are built in later tasks). */
const historyHref = (id: string) => `/history?job=${id}`;

const isManagerLog = (l: LogRowForeman): l is LogRowManager => "amountCents" in l;
const isManagerExpense = (e: ExpenseRowForeman): e is ExpenseRowManager => "totalCents" in e;

/** The back row (a 48 px target), then the job's name, its status, who it is for and where. */
function Header({ job }: { job: ProjectDetail }) {
  const manager = job.view === "manager";
  const editable = manager && job.access.canEdit;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <Button variant="link" href="/jobs">
          Back to jobs
        </Button>
        {editable ? (
          <Button variant="link" href={`/jobs/${job.id}/edit`}>
            Edit job
          </Button>
        ) : null}
      </div>
      <h1 data-job-title="" className="text-title text-ink [overflow-wrap:anywhere]">
        <KeepTogether text={job.name} />
      </h1>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusChip status={JOB_CHIP[job.status]} />
        <p className="text-meta text-ink-2 [overflow-wrap:anywhere]">
          {jobTypeLabel(job.jobType)} for {job.client.name}
        </p>
      </div>
      <p className="text-meta text-ink-2 [overflow-wrap:anywhere]">{job.siteAddress}</p>
    </div>
  );
}

/** One stage: name, its status, how far along, the tape bar. The whole row opens the stage. */
function StageRow({ jobId, stage, today }: { jobId: string; stage: StageRowForeman | StageRowManager; today: string }) {
  const chip = jobStageStatus(stage);
  const progress = stageProgressText(stage, today);
  const money = "alert" in stage ? stage : null;
  const alert = money?.alert ?? null;
  return (
    <Link
      href={`/jobs/${jobId}/stages/${stage.id}`}
      prefetch={false}
      data-stage-row=""
      className={cx("relative block min-h-16 py-2 pl-4 pr-9 first:rounded-t-group last:rounded-b-group active:bg-galv", FOCUS)}
    >
      <span className="block text-body-strong text-ink [overflow-wrap:anywhere]">
        <KeepTogether text={stage.name} />
      </span>
      <span className="flex flex-wrap items-center gap-x-3 text-meta text-ink">
        <StatusChip plain status={chip.status} reason={chip.reason} />
        {progress ? <span className="[overflow-wrap:anywhere]">{progress}</span> : null}
      </span>
      <TapeBar
        label={`${stage.name} progress`}
        percent={whole(stage.pctBp)}
        {...(money && alert
          ? {
              tone: alert.level === "over" ? ("over" as const) : ("watch" as const),
              note: stageAlertNote(alert),
              ...(money.tape.overMarkerBp !== null ? { forecastPercent: whole(money.tape.overMarkerBp), forecastLabel: "Forecast" } : {}),
            }
          : {})}
      />
      <CaretRight size={24} aria-hidden="true" className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-2" />
    </Link>
  );
}

function Stages({ job, today }: { job: ProjectDetail; today: string }) {
  const stages: (StageRowForeman | StageRowManager)[] = job.stages;
  return (
    <Section title="Stages">
      {stages.length === 0 ? (
        <EmptyState message="This job has no stages yet." {...(job.view === "manager" && job.access.canEdit ? { actionLabel: "Add stage", href: `/jobs/${job.id}/edit` } : {})} />
      ) : (
        <div data-stage-list="" className={cx(GROUP, "divide-y")}>
          {stages.map((s) => (
            <StageRow key={s.id} jobId={job.id} stage={s} today={today} />
          ))}
        </div>
      )}
    </Section>
  );
}

/** Labour, materials and the forecast margin (manager only); each figure opens the lines behind it. */
function Money({ job }: { job: ProjectDetailManager }) {
  const labourTone = job.alert ? (job.alert.level === "over" ? ("over" as const) : ("watch" as const)) : null;
  const rows: ListRow[] = [
    {
      key: "labour",
      primary: "Labour",
      meta: job.labour.budgetCents === 0 ? "No budget set" : `Budget ${formatMoney(job.labour.budgetCents)}`,
      figure: <MoneyCell cents={job.labour.actualCents} />,
      href: historyHref(job.id),
      ...(job.alert && labourTone ? { status: { tone: labourTone, text: stageAlertNote(job.alert) } } : {}),
    },
    {
      key: "materials",
      primary: "Materials",
      meta: job.materials.budgetCents === 0 ? "No budget set" : `Budget ${formatMoney(job.materials.budgetCents)}`,
      figure: <MoneyCell cents={job.materials.actualCents} />,
      href: `/expenses?job=${job.id}`,
    },
    {
      key: "margin",
      primary: "Forecast margin",
      meta: job.contractCents === 0 ? "No contract value" : `Contract ${formatMoney(job.contractCents)}`,
      figure: <MoneyCell cents={job.margins.forecastMarginCents} />,
      href: historyHref(job.id),
    },
  ];
  return (
    <Section title="Money">
      <List rows={rows} />
    </Section>
  );
}

function CrewThisWeek({ job }: { job: ProjectDetail }) {
  if (job.crewThisWeek.length === 0) return null;
  const rows: ListRow[] = job.crewThisWeek.map((c) => ({
    key: c.crewMemberId,
    primary: c.name,
    meta: crewWeekText(c.days, c.hours),
    ...("labourCostCents" in c ? { figure: <MoneyCell cents={c.labourCostCents} />, href: historyHref(job.id) } : {}),
  }));
  return (
    <Section title="Crew this week">
      <List rows={rows} />
    </Section>
  );
}

/** A "See all" row under a short list, for a manager (a foreman has no history to open). */
export function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} prefetch={false} className={cx("flex min-h-12 items-center justify-between gap-3 px-4 text-body-strong text-ink active:bg-galv", FOCUS)}>
      {label}
      <CaretRight size={24} aria-hidden="true" className="shrink-0 text-ink-2" />
    </Link>
  );
}

function RecentLogs({ job, today }: { job: ProjectDetail; today: string }) {
  if (job.recentLogs.length === 0) return null;
  const shown = job.recentLogs.slice(0, RECENT_SHOWN);
  const rows: ListRow[] = shown.map((l) => ({
    key: l.id,
    primary: `${l.crewName}, ${l.stageName}`,
    meta: `${formatDate(l.date, today)}, ${logQuantityText(l)}${isManagerLog(l) && l.amountCents === 0 ? ", time only" : ""}`,
    ...(isManagerLog(l) ? { ...(l.amountCents === 0 ? {} : { figure: <MoneyCell cents={l.amountCents} /> }), href: historyHref(job.id) } : {}),
  }));
  return (
    <Section title="Recent logs">
      <List rows={rows} />
      {job.view === "manager" && job.recentLogs.length > RECENT_SHOWN ? (
        <div className={GROUP}>
          <SeeAll href={historyHref(job.id)} label="See all logs" />
        </div>
      ) : null}
    </Section>
  );
}

function Expenses({ job, today }: { job: ProjectDetail; today: string }) {
  if (job.expenses.length === 0) return null;
  const shown = job.expenses.slice(0, RECENT_SHOWN);
  const rows: ListRow[] = shown.map((e) => ({
    key: e.id,
    primary: e.supplier,
    meta: `${formatDate(e.date, today)}, ${e.category.name}`,
    ...(isManagerExpense(e) ? { figure: <MoneyCell cents={e.totalCents} />, href: `/expenses/${e.id}` } : {}),
  }));
  return (
    <Section title="Expenses">
      <List rows={rows} />
      {job.view === "manager" && job.expenses.length > RECENT_SHOWN ? (
        <div className={GROUP}>
          <SeeAll href={`/expenses?job=${job.id}`} label="See all expenses" />
        </div>
      ) : null}
    </Section>
  );
}

function Files({ job, today }: { job: ProjectDetail; today: string }) {
  if (job.files.length === 0) return null;
  const rows: ListRow[] = job.files.map((f) => ({
    key: f.id,
    primary: f.name,
    meta: `${f.kind === "photo" ? "Photo" : f.kind === "pdf" ? "PDF" : "File"}, added ${formatDate(f.uploadedOn, today)}`,
  }));
  return (
    <Section title="Files">
      <List rows={rows} />
    </Section>
  );
}

/**
 * Job detail (flows.md screen 11): the job, how far along it is, its stages, and (manager only) its money, then the
 * crew, logs, expenses and files behind it. Props only; the page fetches. A foreman's job carries no money at all.
 */
export function JobDetailBody({ job, today }: { job: ProjectDetail; today: string }) {
  return (
    <div data-screen="job-detail" data-view={job.view} className={COLUMN}>
      <Header job={job} />
      <div className="flex flex-col gap-2">
        <KeyFigure>{whole(job.pctBp)}% done</KeyFigure>
        <TapeBar label={`${job.name} progress`} percent={whole(job.pctBp)} scope="Whole job" />
      </div>
      {job.view === "manager" && job.alert ? (
        <div data-needs-attention="" className={GROUP}>
          <NeedsAttentionItem
            severity={job.alert.level === "over" ? "over" : "watch"}
            sentence={labourAlertSentence(job.alert)}
            href={historyHref(job.id)}
          />
        </div>
      ) : null}
      <Stages job={job} today={today} />
      {job.view === "manager" ? <Money job={job} /> : null}
      <CrewThisWeek job={job} />
      <RecentLogs job={job} today={today} />
      <Expenses job={job} today={today} />
      <Files job={job} today={today} />
    </div>
  );
}

/** A server failure: the back row stays, the body says so and offers Try again as the one primary button. */
export function JobDetailError() {
  return (
    <div data-screen="job-detail" className={COLUMN}>
      <Button variant="link" href="/jobs" className="self-start">
        Back to jobs
      </Button>
      <LoadError primary />
    </div>
  );
}

function StageRowSkeleton() {
  return (
    <div className="min-h-16 px-4 py-2.5">
      <div className="flex h-6 items-center">
        <Skeleton width={180} height={20} />
      </div>
      <div className="flex h-6 items-center">
        <Skeleton width={150} height={14} />
      </div>
      <div className="mt-1 grid grid-cols-[minmax(0,1fr)_min(8.5rem,45%)] items-center gap-x-[min(1.75rem,8vw)]">
        <Skeleton height={12} />
        <Skeleton width={110} height={24} />
      </div>
    </div>
  );
}

/** The page while it loads (`?demo=loading`): the same rows, as blocks. */
export function JobDetailSkeleton({ manager }: { manager: boolean }) {
  return (
    <div data-screen="job-detail" aria-busy="true" className={COLUMN}>
      <div className="flex flex-col gap-2">
        <Button variant="link" href="/jobs" className="self-start">
          Back to jobs
        </Button>
        <div className="flex h-9 items-center">
          <Skeleton width={260} height={28} />
        </div>
        <Skeleton width={220} height={24} />
        <Skeleton width={200} height={14} />
      </div>
      <div className="flex flex-col gap-2">
        <KeyFigureSkeleton width={180} />
        <Skeleton height={24} />
      </div>
      <section className="flex flex-col gap-2">
        <Skeleton width={96} height={24} />
        <div className={cx(GROUP, "overflow-hidden")}>
          {Array.from({ length: 4 }, (_, i) => (
            <StageRowSkeleton key={i} />
          ))}
        </div>
      </section>
      {manager ? (
        <section className="flex flex-col gap-2">
          <Skeleton width={96} height={24} />
          <div className={cx(GROUP, "overflow-hidden")}>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex min-h-16 items-center justify-between gap-4 px-4 py-2">
                <Skeleton width={150} height={20} />
                <Skeleton width={96} height={20} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
