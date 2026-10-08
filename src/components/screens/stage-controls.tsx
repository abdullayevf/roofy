"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import type { SegmentDto, StageActions, StageDetail } from "@/data/contracts";
import type { PauseReason } from "@/domain/segments";
import { reopenStage, startStage } from "@/app/actions/stages";
import { submit } from "@/offline/submit";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { List } from "@/components/ui/list";
import { Sheet } from "@/components/ui/sheet";
import { StatusChip } from "@/components/ui/status-chip";
import { PinnedAction, usePinnedBar } from "./field-entry";
import {
  NOT_STARTED_TIMELINE,
  PAUSE_CHOICES,
  segmentsShown,
  timelineRows,
  stageActionsNow,
  stageButtons,
  stageChipFor,
  type ActionsNow,
  type KeptState,
} from "./stage-detail-text";
import { NEEDS_CONNECTION, useOnline } from "./use-online";

export type StageLiveProps = {
  stageId: string;
  jobId: string;
  view: StageDetail["view"];
  status: StageDetail["status"];
  /** The reason the stage is paused for now, from its open pause. */
  pauseReason: PauseReason | null;
  /** Working days it has been paused, when that is long enough to say so. */
  longPauseDays: number | null;
  actions: StageActions;
  today: string;
  demoOffline?: boolean;
  className: string;
  children: React.ReactNode;
};

type Live = {
  props: Omit<StageLiveProps, "children" | "className">;
  kept: KeptState | null;
  setKept: (k: KeptState | null) => void;
  waiting: boolean;
  setWaiting: (w: boolean) => void;
  now: ActionsNow;
  barProps: ReturnType<typeof usePinnedBar>["barProps"];
};

const LiveContext = createContext<Live | null>(null);
const useLive = (): Live => useContext(LiveContext)!;

const hasButtons = (now: ActionsNow) => Object.values(now).some(Boolean);

/**
 * Stage detail's screen: holds a pause or restart kept on this phone so the chip, the timeline and the pinned bar all
 * show it at once, before it sends. What the phone kept only stands until the server shows a new status.
 */
export function StageLive({ className, children, ...props }: StageLiveProps) {
  const [kept, setKept] = useState<KeptState | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [seen, setSeen] = useState(props.status);
  if (seen !== props.status) {
    setSeen(props.status);
    setKept(null);
    setWaiting(false);
  }
  const now = stageActionsNow(props.actions, props.status, kept?.status ?? null);
  const bar = hasButtons(now);
  const { style, barProps } = usePinnedBar(bar);
  return (
    <LiveContext.Provider value={{ props, kept, setKept, waiting, setWaiting, now, barProps }}>
      <div
        data-screen="stage-detail"
        data-view={props.view}
        style={bar ? style : undefined}
        className={cx(className, bar && "pin-pad")}
      >
        {children}
      </div>
    </LiveContext.Provider>
  );
}

/** The status chip, how long it has been paused, and whether a pause or restart is waiting to send. */
export function StageStatusLine() {
  const { props, kept, waiting } = useLive();
  const shown = kept?.status ?? props.status;
  const chip = stageChipFor(shown, kept ? kept.reason : props.pauseReason);
  return (
    <div data-stage-controls="" data-status={shown} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusChip status={chip.status} {...(chip.reason ? { reason: chip.reason } : {})} />
        {shown === "paused" && props.longPauseDays !== null && !kept ? (
          <p className="text-meta text-ink-2">Paused {props.longPauseDays} working days.</p>
        ) : null}
      </div>
      <div role="status" className="empty:hidden">
        {waiting ? (
          <div className="flex flex-col items-start gap-1">
            <StatusChip plain status="waiting" />
            <p className="text-meta text-ink-2">Saved on this device. It will send when you have signal.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** The stage's stretches, as this phone knows them; before any, one sentence. A done stage's last stretch reads Done. */
export function StageTimeline({ segments }: { segments: SegmentDto[] }) {
  const { props, kept } = useLive();
  const shown = segmentsShown(segments, kept, props.today);
  if (shown.length === 0) return <p className="text-body text-ink">{NOT_STARTED_TIMELINE}</p>;
  const done = props.status === "done" && !kept;
  return <List rows={timelineRows(shown, props.today, done).map((t, i) => ({ key: `seg-${i}`, primary: t.title, meta: t.detail }))} />;
}


const WIDE = "w-full sm:w-auto sm:min-w-52";

/**
 * What can be done to the stage now, in the pinned bottom bar: the one primary last. Pause and Resume are field
 * entries kept on this phone and shown at once; Start, Mark done and Reopen need a connection.
 */
export function StageActionBar() {
  const { props, setKept, setWaiting, now, barProps } = useLive();
  const { stageId, jobId, today } = props;
  const router = useRouter();
  const online = useOnline(props.demoOffline);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function field(kind: "pause" | "resume", reason?: PauseReason, pauseNote?: string) {
    setError(null);
    setWaiting(false);
    setKept({ status: kind === "pause" ? "paused" : "active", reason: reason ?? null });
    try {
      const result =
        kind === "pause" && reason
          ? await submit("stage_pause", { stageId, date: today, reason, note: pauseNote?.trim() || null })
          : await submit("stage_resume", { stageId, date: today });
      if (result.status === "rejected") {
        setKept(null);
        setError(result.message);
        return;
      }
      if (result.status === "applied") router.refresh();
      else setWaiting(true);
    } catch {
      setKept(null);
      setError(
        kind === "pause"
          ? "Couldn't pause this stage. Try again."
          : "Couldn't restart this stage. Try again.",
      );
    }
  }

  function pause(reason: PauseReason) {
    setOpen(false);
    void field("pause", reason, note);
    setNote("");
  }

  async function admin(run: () => Promise<{ ok: true } | { ok: false; message: string }>, failed: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await run();
      if (!result.ok) setError(result.message);
      else router.refresh();
    } catch {
      setError(failed);
    } finally {
      setBusy(false);
    }
  }

  if (!hasButtons(now)) return null;
  const buttons = stageButtons(now);
  const needsSignal = !online && (now.start || now.done || now.reopen);
  const hint = needsSignal
    ? NEEDS_CONNECTION
    : now.reopen
      ? "Reopening takes back any lump-sum pay that is not approved yet."
      : undefined;

  const render = (kind: keyof ActionsNow, variant: "primary" | "secondary") => {
    switch (kind) {
      case "start":
        return (
          <Button
            key={kind}
            variant={variant}
            loading={busy}
            loadingLabel="Starting stage"
            disabled={!online}
            className={WIDE}
            onClick={() => admin(() => startStage(stageId, today), "Couldn't start this stage. Try again.")}
          >
            Start stage
          </Button>
        );
      case "resume":
        return (
          <Button key={kind} variant={variant} className={WIDE} onClick={() => void field("resume")}>
            Resume stage
          </Button>
        );
      case "done":
        return (
          <Button
            key={kind}
            variant={variant}
            href={`/jobs/${jobId}/stages/${stageId}/done`}
            disabled={!online}
            className={WIDE}
          >
            Mark stage done
          </Button>
        );
      case "pause":
        return (
          <Button key={kind} variant={variant} className={WIDE} onClick={() => setOpen(true)}>
            Pause stage
          </Button>
        );
      case "reopen":
        return (
          <Button
            key={kind}
            variant={variant}
            loading={busy}
            loadingLabel="Reopening stage"
            disabled={!online}
            className={WIDE}
            onClick={() => admin(() => reopenStage(stageId), "Couldn't reopen this stage. Try again.")}
          >
            Reopen stage
          </Button>
        );
    }
  };

  return (
    <>
      {/* On a phone on its side the sentence keeps its place left of the Log circle only when one button shares the
          row; with two, the secondary button takes that place (and an offline banner already says why). */}
      <PinnedAction
        barProps={barProps}
        error={error}
        {...(hint ? { hint } : {})}
        hintOnSide={buttons.length === 1}
      >
        {buttons.map((b) => render(b.kind, b.variant))}
      </PinnedAction>
      <Sheet open={open} onOpenChange={setOpen} title="Pause stage">
        <div className="flex flex-col gap-4">
          <Field
            label="Add a note first (optional)"
            inputMode="text"
            autoComplete="off"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex flex-col gap-2" role="group" aria-label="Why is it paused">
            {PAUSE_CHOICES.map((c) => (
              <Button
                key={c.reason}
                variant="secondary"
                className="w-full justify-start"
                onClick={() => pause(c.reason)}
              >
                {c.label}
              </Button>
            ))}
          </div>
        </div>
      </Sheet>
    </>
  );
}
