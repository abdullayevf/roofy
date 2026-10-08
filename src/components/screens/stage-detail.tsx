import type { StageDetail } from "@/data/contracts";
import { formatDate } from "@/lib/format";
import { KeepTogether } from "@/components/keep-together";
import { TapeBar } from "@/components/tape-bar";
import { Button } from "@/components/ui/button";
import { List } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { COLUMN, KeyFigure, Section, whole } from "./home-parts";
import { LoadError } from "./field-entry";
import { StageControls } from "./stage-controls";
import { lostDaysRows, segmentText } from "./stage-detail-text";

export function StageDetailBody({ stage, today, demoOffline }: { stage: StageDetail; today: string; demoOffline?: boolean }) {
  const back = `/jobs/${stage.projectId}`;
  const open = stage.pauses.find((p) => p.ongoing) ?? null;
  const lost = lostDaysRows(stage.lostDays);
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
        <TapeBar label={`${stage.name} progress`} percent={whole(stage.pctBp)} scope="This stage" />
      </div>
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
      <Skeleton height={48} />
      <Skeleton height={96} />
    </div>
  );
}
