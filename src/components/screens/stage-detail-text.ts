import type { SegmentDto, StageActions, StageDetail } from "@/data/contracts";
import type { PauseReason } from "@/domain/segments";
import { addDays } from "@/domain/dates";
import type { Status } from "@/components/ui/status-chip";
import { formatDate, formatMoney, formatQuantity } from "@/lib/format";
import { hundredthsText } from "./field-input";

type StageStatus = StageDetail["status"];

/** The pause reasons as the sheet's buttons name them, in the order flows.md gives. */
export const PAUSE_CHOICES: { reason: PauseReason; label: string }[] = [
  { reason: "weather", label: "Weather" },
  { reason: "materials", label: "Waiting on materials" },
  { reason: "client", label: "Waiting on client/builder" },
  { reason: "other_job", label: "Crew on another job" },
  { reason: "other", label: "Other" },
];

export const pauseReasonLabel = (reason: PauseReason): string => PAUSE_CHOICES.find((c) => c.reason === reason)!.label;

/** The chip for a stage: its status, and the pause reason in words when it is paused. */
export function stageChipFor(status: StageStatus, reason: PauseReason | null): { status: Status; reason?: string } {
  if (status === "not_started") return { status: "not-started" };
  if (status === "paused" && reason) return { status: "paused", reason: pauseReasonLabel(reason) };
  return { status };
}

export interface ActionsNow {
  start: boolean;
  pause: boolean;
  resume: boolean;
  done: boolean;
  reopen: boolean;
}

/**
 * What the stage offers right now. `local` is a pause or restart kept on this phone that the server has not
 * confirmed yet: the stage shows it at once, so Pause and Resume swap. Done never offers Pause.
 */
export function stageActionsNow(actions: StageActions, status: StageStatus, local: "paused" | "active" | null): ActionsNow {
  const canFlip = actions.canPause || actions.canResume;
  const shown = local ?? status;
  return {
    start: actions.canStart,
    pause: canFlip && shown === "active",
    resume: canFlip && shown === "paused",
    done: actions.canMarkDone,
    reopen: actions.canReopen,
  };
}

/** One stretch of the stage's history. `end` is the first day after it, so the last day worked is the day before. */
export function segmentText(segment: SegmentDto, today: string): { title: string; detail: string } {
  const first = formatDate(segment.start, today);
  const last = segment.end ? addDays(segment.end, -1) : null;
  const title = last === null ? `From ${first}` : last === segment.start ? first : `${first} to ${formatDate(last, today)}`;
  if (!segment.pauseReason) return { title, detail: "Working" };
  const note = segment.pauseNote ? `. ${segment.pauseNote}` : "";
  return { title, detail: `Paused: ${pauseReasonLabel(segment.pauseReason)}${note}` };
}

/** Working days lost to each reason, only the reasons that cost any. */
export function lostDaysRows(lost: Record<PauseReason, number>): { label: string; text: string }[] {
  return PAUSE_CHOICES.filter((c) => lost[c.reason] > 0).map((c) => ({
    label: c.label,
    text: `${lost[c.reason]} ${lost[c.reason] === 1 ? "day" : "days"}`,
  }));
}

/** The forecast's working in words, from the figures the server worked out ("$1,432.50 spent at 30% done, so about $4,775.00 for the whole stage."). Shows them; does no sums. */
export function forecastWorkingText(w: { actualCents: number; pctBp: number; forecastCents: number | null }): string {
  const spent = `${formatMoney(w.actualCents)} spent at ${hundredthsText(w.pctBp)}% done`;
  return w.forecastCents === null ? `${spent}. No forecast until some work is done.` : `${spent}, so about ${formatMoney(w.forecastCents)} for the whole stage.`;
}

/** A progress entry as a row: its date, the quantity with its unit, and who entered it. */
export function progressRowText(p: { date: string; quantity: number; unit: "m2" | "lm" | "each"; enteredByName: string }, today: string): { primary: string; quantity: string; meta: string } {
  return { primary: formatDate(p.date, today), quantity: formatQuantity(p.quantity, p.unit), meta: `Entered by ${p.enteredByName}` };
}
