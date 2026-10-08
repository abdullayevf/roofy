import type { BudgetAlertDto, LogRowForeman, PauseInfo, StageRowForeman } from "@/data/contracts";
import type { Status } from "@/components/ui/status-chip";
import { formatDate, formatDays, formatHours, formatMoney, formatQuantity } from "@/lib/format";
import { pauseReasonText } from "./home-text";

/** "Mon 7 Sep" for a day, "Weather" for a pause reason: sentence case for a chip. */
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type StageProgress = Pick<StageRowForeman, "status" | "unit" | "quantityDone" | "plannedQuantity" | "completedOn">;

/** The line under a stage's name: "40 m² of 400 m²", "Done Tue 15 Sep", or nothing when there is nothing to say. */
export function stageProgressText(stage: StageProgress, today: string): string {
  if (stage.status === "done" && stage.completedOn) return `Done ${formatDate(stage.completedOn, today)}`;
  if (!stage.unit) return "";
  if (stage.plannedQuantity !== null) return `${formatQuantity(stage.quantityDone, stage.unit)} of ${formatQuantity(stage.plannedQuantity, stage.unit)}`;
  return `${formatQuantity(stage.quantityDone, stage.unit)} done`;
}

/** The chip for a stage: its status, and the pause reason in words when it is paused. */
export function jobStageStatus(stage: { status: StageRowForeman["status"]; pause: PauseInfo | null }): { status: Status; reason?: string } {
  if (stage.status === "not_started") return { status: "not-started" };
  if (stage.status === "paused" && stage.pause) return { status: "paused", reason: sentence(pauseReasonText(stage.pause.reason)) };
  return { status: stage.status };
}

/** "2 days, 16 h": what a crew member logged on the job this week. */
export const crewWeekText = (days: number, hours: number): string => `${formatDays(days * 100)}, ${formatHours(hours)}`;

/** A log line's quantity by how it is paid: days, hours or units; a lump sum or time-only line shows its hours. */
export function logQuantityText(log: Pick<LogRowForeman, "basis" | "unit" | "quantity" | "hours">): string {
  if (log.basis === "daily") return formatDays(log.quantity);
  if (log.basis === "per_unit" && log.unit) return formatQuantity(log.quantity, log.unit);
  if (log.basis === "hourly") return formatHours(log.quantity);
  return formatHours(log.hours);
}

/** A stage's alert in plain words, for the line under its tape bar. */
export function stageAlertNote(alert: BudgetAlertDto): string {
  const by = formatMoney(alert.byCents);
  return alert.level === "over" ? `${by} over budget` : `Trending ${by} over budget`;
}
