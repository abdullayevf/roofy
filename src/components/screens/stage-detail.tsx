import type { StageDetail, StageDetailManager } from "@/data/contracts";
import { cx } from "@/lib/cx";
import { formatMoney } from "@/lib/format";
import { KeepTogether } from "@/components/keep-together";
import { TapeBar } from "@/components/tape-bar";
import { Button } from "@/components/ui/button";
import { List, type ListRow } from "@/components/ui/list";
import { MoneyCell } from "@/components/ui/money-cell";
import { Skeleton } from "@/components/ui/skeleton";
import { COLUMN, KeyFigure, Section, whole } from "./home-parts";
import { LoadError } from "./field-entry";
import { stageAlertNote, stageProgressText } from "./job-detail-text";
import { StageActionBar, StageLive, StageStatusLine, StageTimeline } from "./stage-controls";
import { forecastWorkingText, lostDaysRows, materialsMeta, progressRowText } from "./stage-detail-text";

/** Where a figure's source lines are: the record history for the job (the lists it links to are built in later tasks). */
const historyHref = (jobId: string) => `/history?job=${jobId}`;

/**
 * Labour and materials spent against budget, the forecast while the stage is open, and any lump sum (manager only);
 * each figure opens the lines behind it. The budget warning is said once, on the tape bar, not again here.
 */
function Money({ stage }: { stage: StageDetailManager }) {
  const rows: ListRow[] = [
    {
      key: "labour",
      primary: "Labour",
      meta: stage.labourBudgetCents > 0 ? `Budget ${formatMoney(stage.labourBudgetCents)}` : "No budget set",
      figure: <MoneyCell cents={stage.labourActualCents} />,
      href: historyHref(stage.projectId),
    },
    ...(stage.forecastLabourCents !== null && stage.status !== "done"
      ? [{ key: "forecast", primary: "Forecast labour", meta: stage.forecastWorking ? forecastWorkingText(stage.forecastWorking) : "At this pace", figure: <MoneyCell cents={stage.forecastLabourCents} />, href: `/jobs/${stage.projectId}/stages/${stage.id}/forecast` }]
      : []),
    {
      key: "materials",
      primary: "Materials",
      meta: materialsMeta(stage.materialsBudgetCents),
      // Nothing spent and no budget: the meta says so, with no "$0.00" beside it.
      ...(stage.materialsBudgetCents > 0 || stage.materialsActualCents > 0 ? { figure: <MoneyCell cents={stage.materialsActualCents} /> } : {}),
      href: `/expenses?job=${stage.projectId}&stage=${stage.id}`,
    },
    ...(stage.lumpSumCents !== null
      ? [{ key: "lump-sum", primary: "Lump sum", meta: "Split between the crew when the stage is done", figure: <MoneyCell cents={stage.lumpSumCents} />, href: historyHref(stage.projectId) }]
      : []),
  ];
  return (
    <Section title="Money">
      <List rows={rows} />
    </Section>
  );
}

export function StageDetailBody({ stage, today, demoOffline }: { stage: StageDetail; today: string; demoOffline?: boolean }) {
  const back = `/jobs/${stage.projectId}`;
  const open = stage.pauses.find((p) => p.ongoing) ?? null;
  const lost = lostDaysRows(stage.lostDays);
  const quantity = stageProgressText(stage, today);
  const money = stage.view === "manager" ? stage : null;
  const alert = money?.alert ?? null;
  return (
    <StageLive
      stageId={stage.id}
      jobId={stage.projectId}
      view={stage.view}
      status={stage.status}
      pauseReason={open?.reason ?? null}
      longPauseDays={stage.pausedTooLong && open ? open.workingDays : null}
      actions={stage.actions}
      today={today}
      className={COLUMN}
      {...(demoOffline ? { demoOffline } : {})}
    >
      <div className="flex flex-col gap-2">
        <Button variant="link" href={back} className="self-start">
          Back to job
        </Button>
        <h1 data-stage-title="" className="text-title text-ink [overflow-wrap:anywhere]">
          <KeepTogether text={stage.name} />
        </h1>
        <p className="text-meta text-ink-2 [overflow-wrap:anywhere]">{stage.projectName}</p>
        <StageStatusLine />
      </div>
      <div className="flex flex-col gap-2">
        <KeyFigure>{whole(stage.pctBp)}% done</KeyFigure>
        {quantity ? <p className="text-meta text-ink-2 [overflow-wrap:anywhere]">{quantity}</p> : null}
        <TapeBar
          label={`${stage.name} progress`}
          percent={whole(stage.pctBp)}
          scope="This stage"
          {...(money && alert
            ? {
                tone: alert.level === "over" ? ("over" as const) : ("watch" as const),
                note: stageAlertNote(alert),
                ...(money.tape.overMarkerBp !== null ? { forecastPercent: whole(money.tape.overMarkerBp), forecastLabel: "Forecast" } : {}),
              }
            : {})}
        />
      </div>
      {money ? <Money stage={money} /> : null}
      <Section title="Timeline">
        <StageTimeline segments={stage.segments} />
      </Section>
      {lost.length > 0 ? (
        <Section title="Days lost">
          <List rows={lost.map((r) => ({ key: r.label, primary: r.label, meta: r.text }))} />
        </Section>
      ) : null}
      {stage.progress.length > 0 ? (
        <Section title="Progress">
          <List
            rows={stage.progress.map((p) => {
              const t = progressRowText(p, today);
              return { key: p.id, primary: t.primary, meta: t.meta, figure: <span className="whitespace-nowrap text-figure num text-ink">{t.quantity}</span> };
            })}
          />
        </Section>
      ) : null}
      <StageActionBar />
    </StageLive>
  );
}

export function StageDetailError({ jobId }: { jobId: string }) {
  return (
    <div data-screen="stage-detail" className={COLUMN}>
      <Button variant="link" href={`/jobs/${jobId}`} className="self-start">
        Back to job
      </Button>
      <LoadError primary />
    </div>
  );
}

/** Rows like the Money and Timeline lists: a label and the line under it, and a figure on the right when there is one. */
function RowsSkeleton({ count, figure }: { count: number; figure: boolean }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-group border-group bg-surface">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex min-h-16 items-center justify-between gap-4 px-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Skeleton width={96} height={20} />
            <Skeleton width={144} height={16} />
          </div>
          {figure ? <Skeleton width={88} height={24} /> : null}
        </div>
      ))}
    </div>
  );
}

/** Shaped like the page: title, job and chip; the % done figure and tape; Money and Timeline rows; the pinned bar. */
export function StageDetailSkeleton({ jobId }: { jobId: string }) {
  return (
    <div data-screen="stage-detail" aria-busy="true" className={cx(COLUMN, "pin-pad")}>
      <div className="flex flex-col gap-2">
        <Button variant="link" href={`/jobs/${jobId}`} className="self-start">
          Back to job
        </Button>
        <Skeleton width={240} height={32} />
        <Skeleton width={140} height={20} />
        <Skeleton width={96} height={28} rounded="full" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton width={180} height={44} />
        <Skeleton width={200} height={20} />
        <Skeleton height={12} rounded="full" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton width={80} height={24} />
        <RowsSkeleton count={3} figure />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton width={96} height={24} />
        <RowsSkeleton count={2} figure={false} />
      </div>
      <div aria-hidden="true" className="pin-action flex flex-col gap-3">
        <Skeleton height={48} />
      </div>
    </div>
  );
}
