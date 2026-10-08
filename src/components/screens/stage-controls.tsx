"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StageActions, StageDetail } from "@/data/contracts";
import type { PauseReason } from "@/domain/segments";
import { reopenStage, startStage } from "@/app/actions/stages";
import { submit } from "@/offline/submit";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import { Field } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { StatusChip } from "@/components/ui/status-chip";
import { PAUSE_CHOICES, stageActionsNow, stageChipFor } from "./stage-detail-text";
import { NEEDS_CONNECTION, useOnline } from "./use-online";

type Local = { status: "paused" | "active"; reason: PauseReason | null };

export type StageControlsProps = {
  stageId: string;
  jobId: string;
  status: StageDetail["status"];
  /** The reason the stage is paused for now, from its open pause. */
  pauseReason: PauseReason | null;
  /** Working days it has been paused, when that is long enough to say so. */
  longPauseDays: number | null;
  actions: StageActions;
  today: string;
  demoOffline?: boolean;
};

/**
 * The stage's status chip and what can be done to it now. Pause and Resume are field entries: they are kept on this
 * phone and the stage shows the new state at once, even before they send. Start and Reopen need a connection.
 */
export function StageControls({ stageId, jobId, status, pauseReason, longPauseDays, actions, today, demoOffline }: StageControlsProps) {
  const router = useRouter();
  const online = useOnline(demoOffline);
  const [local, setLocal] = useState<Local | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  // What the phone kept only stands until the server shows a new status. Then the server's word wins and the note goes.
  const [seen, setSeen] = useState(status);
  if (seen !== status) {
    setSeen(status);
    setLocal(null);
    setWaiting(false);
  }
  const mine = local;
  const shownStatus = mine?.status ?? status;
  const shownReason = mine ? mine.reason : pauseReason;
  const now = stageActionsNow(actions, status, mine?.status ?? null);
  const chip = stageChipFor(shownStatus, shownReason);

  async function field(kind: "pause" | "resume", reason?: PauseReason) {
    setError(null);
    setWaiting(false);
    setLocal({ status: kind === "pause" ? "paused" : "active", reason: reason ?? null });
    try {
      const result =
        kind === "pause" && reason
          ? await submit("stage_pause", { stageId, date: today, reason, note: note.trim() || null })
          : await submit("stage_resume", { stageId, date: today });
      if (result.status === "rejected") {
        setLocal(null);
        setError(result.message);
        return;
      }
      if (result.status === "applied") {
        setWaiting(false);
        router.refresh();
      } else setWaiting(true);
    } catch {
      setLocal(null);
      setError(kind === "pause" ? "Couldn't pause this stage. Try again." : "Couldn't restart this stage. Try again.");
    }
  }

  function pause(reason: PauseReason) {
    setOpen(false);
    void field("pause", reason);
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

  const offlineReason = online ? undefined : NEEDS_CONNECTION;
  const doneIsMain = now.done;

  return (
    <div data-stage-controls="" data-status={shownStatus} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusChip status={chip.status} {...(chip.reason ? { reason: chip.reason } : {})} />
        {shownStatus === "paused" && longPauseDays !== null && !mine ? (
          <p className="text-meta text-ink-2">Paused {longPauseDays} working days.</p>
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
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {now.start ? (
          <Button loading={busy} loadingLabel="Starting stage" disabled={!online} reason={offlineReason} className="w-full sm:w-auto sm:min-w-52" onClick={() => admin(() => startStage(stageId, today), "Couldn't start this stage. Try again.")}>
            Start stage
          </Button>
        ) : null}
        {now.resume ? (
          <Button className="w-full sm:w-auto sm:min-w-52" onClick={() => void field("resume")}>
            Resume stage
          </Button>
        ) : null}
        {now.done ? (
          <Button href={`/jobs/${jobId}/stages/${stageId}/done`} className="w-full sm:w-auto sm:min-w-52">
            Mark stage done
          </Button>
        ) : null}
        {now.pause ? (
          <Button variant={doneIsMain ? "secondary" : "primary"} className="w-full sm:w-auto sm:min-w-52" onClick={() => setOpen(true)}>
            Pause stage
          </Button>
        ) : null}
        {now.reopen ? (
          <Button variant="secondary" loading={busy} loadingLabel="Reopening stage" disabled={!online} reason={offlineReason} className="w-full sm:w-auto sm:min-w-52" onClick={() => admin(() => reopenStage(stageId), "Couldn't reopen this stage. Try again.")}>
            Reopen stage
          </Button>
        ) : null}
      </div>
      {now.reopen && online ? <p className="text-meta text-ink-2">Reopening takes back any lump-sum pay that is not approved yet.</p> : null}

      <Sheet open={open} onOpenChange={setOpen} title="Pause stage">
        <div className="flex flex-col gap-4">
          <Field label="Add a note first (optional)" inputMode="text" autoComplete="off" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-col gap-2" role="group" aria-label="Why is it paused">
            {PAUSE_CHOICES.map((c) => (
              <Button key={c.reason} variant="secondary" className="w-full justify-start" onClick={() => pause(c.reason)}>
                {c.label}
              </Button>
            ))}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
