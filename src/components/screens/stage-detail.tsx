import type { StageDetail, StageDetailManager } from "@/data/contracts";
import { formatDate, formatMoney } from "@/lib/format";
import { KeepTogether } from "@/components/keep-together";
import { TapeBar } from "@/components/tape-bar";
import { Button } from "@/components/ui/button";
import { List, type ListRow } from "@/components/ui/list";
import { MoneyCell } from "@/components/ui/money-cell";
import { Skeleton } from "@/components/ui/skeleton";
import { COLUMN, KeyFigure, Section, whole } from "./home-parts";
import { LoadError } from "./field-entry";
import { stageAlertNote, stageProgressText } from "./job-detail-text";
import { StageControls } from "./stage-controls";
import { lostDaysRows, segmentText } from "./stage-detail-text";

/** Where a figure's source lines are: the record history for the job (the lists it links to are built in later tasks). */
const historyHref = (jobId: string) => `/history?job=${jobId}`;

/** Labour and materials budget against what has been spent, the forecast and any lump sum (manager only); each figure opens the lines behind it. */
function Money({ stage }: { stage: StageDetailManager }) {
  const tone = stage.alert ? (stage.alert.level === "over" ? ("over" as const) : ("watch" as const)) : null;
  const rows: ListRow[] = [
    {
      key: "labour",
      primary: "Labour",
      meta: `Budget ${formatMoney(stage.labourBudgetCents)}`,
      figure: <MoneyCell cents={stage.labourActualCents} />,
      href: historyHref(stage.projectId),
      ...(stage.alert && tone ? { status: { tone, text: stageAlertNote(stage.alert) } } : {}),
    },
    ...(stage.forecastLabourCents !== null
      ? [{ key: "forecast", primary: "Forecast labour", meta: "At this pace", figure: <MoneyCell cents={stage.forecastLabourCents} />, href: historyHref(stage.projectId) }]
      : []),
    {
      key: "materials",
      primary: "Materials",
      meta: "Budget",
      figure: <MoneyCell cents={stage.materialsBudgetCents} />,
      href: `/expenses?job=${stage.projectId}`,
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
    <div data-screen="stage-detail" data-view={stage.view} className={COLUMN}>
      <div className="flex flex-col gap-2">
        <Button variant="link" href={back} className="self-start">
          Back to job
        </Button>
        <h1 data-stage-title="" className="text-title text-ink [overflow-wrap:anywhere]">
          <KeepTogether text={stage.name} />
        </h1>
        <p className="text-meta text-ink-2 [overflow-wrap:anywhere]">{stage.projectName}</p>
      </div>
      <StageControls
        stageId={stage.id}
        jobId={stage.projectId}
        status={stage.status}
        pauseReason={open?.reason ?? null}
        longPauseDays={stage.pausedTooLong && open ? open.workingDays : null}
        actions={stage.actions}
        today={today}
        {...(demoOffline ? { demoOffline } : {})}
      />
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
        <List rows={stage.segments.map((s, i) => { const t = segmentText(s, today); return { key: `seg-${i}`, primary: t.title, meta: t.detail }; })} />
      </Section>
      {lost.length > 0 ? (
        <Section title="Days lost">
          <List rows={lost.map((r) => ({ key: r.label, primary: r.label, meta: r.text }))} />
        </Section>
      ) : null}
      {stage.progress.length > 0 ? (
        <Section title="Progress">
          <List rows={stage.progress.map((p) => ({ key: p.id, primary: formatDate(p.date, today), meta: `Entered by ${p.enteredByName}` }))} />
        </Section>
      ) : null}
    </div>
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

export function StageDetailSkeleton({ jobId }: { jobId: string }) {
  return (
    <div data-screen="stage-detail" aria-busy="true" className={COLUMN}>
      <Button variant="link" href={`/jobs/${jobId}`} className="self-start">
        Back to job
      </Button>
      <Skeleton width={240} height={32} />
      <Skeleton width={120} height={32} />
      <Skeleton height={48} />
      <Skeleton width={160} height={48} />
      <Skeleton height={32} />
      <Skeleton height={144} />
      <Skeleton height={96} />
    </div>
  );
}
