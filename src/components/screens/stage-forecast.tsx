import type { StageDetailManager } from "@/data/contracts";
import { KeepTogether } from "@/components/keep-together";
import { Button } from "@/components/ui/button";
import { List, type ListRow } from "@/components/ui/list";
import { MoneyCell } from "@/components/ui/money-cell";
import { Skeleton } from "@/components/ui/skeleton";
import { COLUMN, Section } from "./home-parts";
import { LoadError } from "./field-entry";
import { stageAlertNote } from "./job-detail-text";
import { forecastStateText, labourLineText, triggerMetaText } from "./stage-detail-text";

const stageHref = (s: { projectId: string; id: string }) => `/jobs/${s.projectId}/stages/${s.id}`;

function BackToStage({ href }: { href: string }) {
  return (
    <Button variant="link" href={href} className="self-start">
      Back to stage
    </Button>
  );
}

const AMOUNT = /([−-]?\$[\d,]+\.\d{2})/;

/** A sentence of plain body text whose money values use the figure style (lessons.md: money is never bold body text). */
function FigureText({ text }: { text: string }) {
  return text.split(AMOUNT).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="whitespace-nowrap text-figure num">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/**
 * The lines behind a stage's labour and how they make its forecast (flows "Find the job losing money", tap 2):
 * each costed log line, the labour so far, then labour ÷ % done = forecast against the budget and the warning point.
 * Owner, Manager and Accountant only; the page blocks the foreman before this renders.
 */
export function StageForecastBody({ stage, today }: { stage: StageDetailManager; today: string }) {
  // Time-only lines carry no pay of their own (the stage's per-unit or lump-sum lines do), so they are counted, not listed.
  const lines = stage.logs.filter((l) => l.basis !== "time_only");
  const timeOnly = stage.logs.length - lines.length;
  const rows: ListRow[] = lines.map((l) => {
    const t = labourLineText(l, today);
    return {
      key: l.id,
      primary: t.primary,
      meta: t.meta,
      figure: (
        <span data-line-cents={l.labourCostCents}>
          <MoneyCell cents={l.labourCostCents} />
        </span>
      ),
    };
  });
  rows.push({
    key: "total",
    primary: "Labour so far",
    ...(timeOnly > 0
      ? { meta: `${timeOnly} time-only ${timeOnly === 1 ? "line costs" : "lines cost"} nothing on their own` }
      : {}),
    figure: <MoneyCell cents={stage.labourActualCents} />,
  });
  const open = stage.status !== "done";
  const alert = stage.alert;
  const working: ListRow[] = [
    ...(stage.forecastLabourCents !== null && open
      ? [
          {
            key: "forecast",
            primary: "Forecast labour",
            meta: "If the rest goes at this pace",
            figure: <MoneyCell cents={stage.forecastLabourCents} />,
            ...(alert
              ? {
                  status: {
                    tone: alert.level === "over" ? ("over" as const) : ("watch" as const),
                    text: stageAlertNote(alert),
                  },
                }
              : {}),
          },
        ]
      : []),
    stage.labourBudgetCents > 0
      ? { key: "budget", primary: "Labour budget", figure: <MoneyCell cents={stage.labourBudgetCents} /> }
      : { key: "budget", primary: "Labour budget", meta: "No budget set" },
    ...(open && stage.labourBudgetCents > 0
      ? [
          {
            key: "trigger",
            primary: "Warning from",
            meta: triggerMetaText(stage.labourTriggerCents),
            figure: <MoneyCell cents={stage.labourTriggerCents} />,
          },
        ]
      : []),
  ];
  return (
    <div data-screen="stage-forecast" className={COLUMN}>
      <div className="flex flex-col gap-2">
        <BackToStage href={stageHref(stage)} />
        <h1 className="text-title text-ink [overflow-wrap:anywhere]">Forecast labour</h1>
        <p className="text-body text-ink-2 [overflow-wrap:anywhere]">
          <KeepTogether text={`${stage.name}, ${stage.projectName}`} />
        </p>
      </div>
      <Section title="Labour lines">
        {lines.length === 0 && timeOnly === 0 ? (
          <p className="text-body text-ink-2">No labour logged on this stage yet.</p>
        ) : null}
        <div data-forecast-lines="">
          <List rows={rows} reserveChevron={false} />
        </div>
      </Section>
      <Section title="How the forecast is worked out">
        <p data-forecast-working="" className="text-body text-ink [overflow-wrap:anywhere]">
          <FigureText
            text={forecastStateText({
              status: stage.status,
              actualCents: stage.labourActualCents,
              pctBp: stage.pctBp,
              forecastCents: stage.forecastLabourCents,
            })}
          />
        </p>
        <List rows={working} />
      </Section>
    </div>
  );
}

export function StageForecastError({ jobId, stageId }: { jobId: string; stageId: string }) {
  return (
    <div data-screen="stage-forecast" className={COLUMN}>
      <BackToStage href={stageHref({ projectId: jobId, id: stageId })} />
      <LoadError primary />
    </div>
  );
}

export function StageForecastSkeleton({ jobId, stageId }: { jobId: string; stageId: string }) {
  return (
    <div data-screen="stage-forecast" aria-busy="true" className={COLUMN}>
      <div className="flex flex-col gap-2">
        <BackToStage href={stageHref({ projectId: jobId, id: stageId })} />
        <Skeleton width={240} height={32} />
        <Skeleton width={180} height={20} />
      </div>
      <Skeleton width={240} height={160} />
      <Skeleton width={240} height={120} />
    </div>
  );
}
