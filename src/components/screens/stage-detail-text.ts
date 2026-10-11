import type { LogRowManager, SegmentDto, StageActions, StageDetail } from "@/data/contracts";
import type { PauseReason } from "@/domain/segments";
import { addDays } from "@/domain/dates";
import type { Status } from "@/components/ui/status-chip";
import { formatDate, formatDays, formatHours, formatMoney, formatQuantity } from "@/lib/format";
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
/** `finished`: the last stretch of a done stage, which reads Done rather than Working. */
export function segmentText(segment: SegmentDto, today: string, finished = false): { title: string; detail: string } {
  const first = formatDate(segment.start, today);
  const last = segment.end ? addDays(segment.end, -1) : null;
  const title = last === null ? `From ${first}` : last === segment.start ? first : `${first} to ${formatDate(last, today)}`;
  if (!segment.pauseReason) return { title, detail: finished ? "Done" : "Working" };
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

/** The fields of a log line the forecast breakdown shows (a manager's log row). */
type LabourLine = Pick<LogRowManager, "crewName" | "date" | "basis" | "unit" | "quantity" | "rateCents" | "amountCents" | "labourCostCents" | "adjustsLogId">;

/** How a line's pay was worked out, before on-cost: "60 m² at $9.50 = $570.00". */
function payWorking(l: LabourLine): string {
  if (l.adjustsLogId !== null) return `Pay adjustment, ${formatMoney(l.amountCents)}`;
  if (l.basis === "lump_sum") return `Share of the lump sum, ${formatMoney(l.amountCents)}`;
  const qty = l.basis === "per_unit" && l.unit ? formatQuantity(l.quantity, l.unit) : l.basis === "daily" ? formatDays(l.quantity) : formatHours(l.quantity);
  if (l.rateCents === null) return `${qty}, no rate set yet`;
  const per = l.basis === "daily" ? " a day" : l.basis === "hourly" ? " an hour" : "";
  return `${qty} at ${formatMoney(l.rateCents)}${per} = ${formatMoney(l.amountCents)}`;
}

/** A labour line behind a stage's forecast: who and the day, then how its pay was worked out; on-cost noted when the job pays more than the person gets. */
export function labourLineText(l: LabourLine, today: string): { primary: string; meta: string } {
  const onCost = l.labourCostCents > l.amountCents ? ", plus on-cost" : "";
  return { primary: `${l.crewName}, ${formatDate(l.date, today)}`, meta: `${payWorking(l)}${onCost}` };
}

/** The forecast in one line: the division while open, the cost once done, or why there is none yet (pay rules §12). */
export function forecastStateText(w: { status: StageStatus; actualCents: number; pctBp: number; forecastCents: number | null }): string {
  if (w.status === "done") return `Done, so the forecast is what it cost: ${formatMoney(w.actualCents)}`;
  if (w.forecastCents === null) return "No forecast yet. It starts once the stage is 10% done.";
  return `${formatMoney(w.actualCents)} ÷ ${hundredthsText(w.pctBp)}% done = ${formatMoney(w.forecastCents)}`;
}

/** A progress entry as a row: its date, the quantity with its unit, and who entered it. */
export function progressRowText(p: { date: string; quantity: number; unit: "m2" | "lm" | "each"; enteredByName: string }, today: string): { primary: string; quantity: string; meta: string } {
  return { primary: formatDate(p.date, today), quantity: formatQuantity(p.quantity, p.unit), meta: `Entered by ${p.enteredByName}` };
}

/** The timeline's one sentence before the stage has any stretch. */
export const NOT_STARTED_TIMELINE = "Not started yet. Starts when the first day is logged.";

/** The materials row's meta: the budget, or that none is set (never "$0.00"). */
export const materialsMeta = (budgetCents: number): string => (budgetCents > 0 ? `Budget ${formatMoney(budgetCents)}` : "No budget set");

/** A pause or restart kept on this phone that the server has not shown yet. */
export type KeptState = { status: "paused" | "active"; reason: PauseReason | null };

/**
 * The segments as this phone knows them, in the server's shape (a pause ends the open worked stretch at today with
 * its reason; a kept restart opens a new stretch from today), so the timeline agrees with the chip before the server
 * answers. Dates only; no sums.
 */
export function segmentsShown(segments: SegmentDto[], kept: KeptState | null, today: string): SegmentDto[] {
  const last = segments.at(-1);
  if (!kept || !last) return segments;
  if (kept.status === "paused") {
    return last.end === null ? [...segments.slice(0, -1), { ...last, end: today, pauseReason: kept.reason }] : segments;
  }
  return last.end !== null && last.pauseReason !== null ? [...segments, { start: today, end: null, pauseReason: null, pauseNote: null }] : segments;
}

/**
 * The timeline's lines from the server's segments: each row is a worked stretch [start, end); one ended by a pause
 * adds a Paused line from its end to the next stretch's start (open while still paused). An empty stretch (paused on
 * its start day) shows no Working line. A done stage's last stretch reads Done. Dates only; no sums.
 */
export function timelineRows(segments: SegmentDto[], today: string, done: boolean): { title: string; detail: string }[] {
  return segments.flatMap((s, i) => {
    const rows: { title: string; detail: string }[] = [];
    const isLast = i === segments.length - 1;
    if (s.end !== s.start) rows.push(segmentText({ ...s, pauseReason: null, pauseNote: null }, today, done && isLast && !s.pauseReason));
    if (s.pauseReason && s.end !== null) {
      rows.push(segmentText({ start: s.end, end: segments[i + 1]?.start ?? null, pauseReason: s.pauseReason, pauseNote: s.pauseNote }, today));
    }
    return rows;
  });
}

export type StageButtonKind = keyof ActionsNow;

/**
 * The stage's buttons in the pinned bar, secondaries first and the one primary last (nearest the thumb, rightmost on
 * a phone on its side). Start, else Resume, else Mark done is the primary; Pause and Reopen are always secondary, for
 * the foreman and the manager alike.
 */
export function stageButtons(now: ActionsNow): { kind: StageButtonKind; variant: "primary" | "secondary" }[] {
  const order: StageButtonKind[] = ["start", "resume", "done", "pause", "reopen"];
  const shown = order.filter((k) => now[k]);
  const primary = (["start", "resume", "done"] as const).find((k) => now[k]) ?? null;
  return [
    ...shown.filter((k) => k !== primary).map((kind) => ({ kind, variant: "secondary" as const })),
    ...(primary ? [{ kind: primary, variant: "primary" as const }] : []),
  ];
}
