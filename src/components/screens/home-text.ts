import type { ActiveJobRow, AttentionItem, OutboxState, StageChip } from "@/data/contracts";
import type { PauseReason } from "@/domain/segments";
import { formatDate, formatMoney } from "@/lib/format";

const REASON: Record<PauseReason, string> = {
  weather: "weather",
  materials: "materials",
  client: "client",
  other_job: "another job",
  other: "other",
};

export const pauseReasonText = (reason: PauseReason): string => REASON[reason];

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** One plain sentence for a Needs attention row (product spec §5.9). */
export function attentionSentence(item: AttentionItem, today: string): string {
  switch (item.kind) {
    case "over_budget":
      return `${item.projectName} is ${formatMoney(item.byCents)} over on ${lower(item.stageName)}.`;
    case "trending_over":
      return `${item.projectName} is trending ${formatMoney(item.byCents)} over on ${lower(item.stageName)}.`;
    case "paused_too_long":
      return `${item.stageName} on ${item.projectName} has been paused ${item.workingDays} working days (${pauseReasonText(item.reason)}).`;
    case "logging_gaps": {
      const [first, ...rest] = item.gaps;
      if (!first) return "Some days last week have no log.";
      if (rest.length === 0) {
        const n = first.dates.length;
        return `${first.name} has ${n} ${n === 1 ? "day" : "days"} with no log last week.`;
      }
      return `${first.name} and ${rest.length} ${rest.length === 1 ? "other have" : "others have"} days with no log last week.`;
    }
    case "unpaid_too_long":
      return `${item.name} has been owed ${formatMoney(item.balanceCents)} since ${formatDate(item.since, today)}.`;
    case "below_floor":
      return `${item.name} is ${formatMoney(item.shortfallCents)} under the award minimum in this pay run.`;
    case "outbox_attention":
      return item.count === 1
        ? "1 entry on this phone needs attention."
        : `${item.count} entries on this phone need attention.`;
  }
}

export function daysSinceText(days: number | null): string {
  if (days === null) return "Nothing logged yet";
  if (days === 0) return "Logged today";
  if (days === 1) return "Last logged yesterday";
  return `Last logged ${days} days ago`;
}

export function jobAlertText(alert: ActiveJobRow["alert"]): { tone: "over" | "watch"; text: string } | null {
  if (alert === null) return null;
  return alert.level === "over"
    ? { tone: "over", text: `${formatMoney(alert.byCents)} over budget` }
    : { tone: "watch", text: `Trending ${formatMoney(alert.byCents)} over budget` };
}

/** "Sheet install, Flashings (paused: weather)" for a job's current stages. */
export function stageLine(stages: StageChip[]): string {
  if (stages.length === 0) return "No stage started";
  return stages
    .map((s) => (s.status === "paused" && s.pauseReason ? `${s.name} (paused: ${pauseReasonText(s.pauseReason)})` : s.name))
    .join(", ");
}

export type OutboxStatus = { tone: "clear" | "waiting" | "attention"; text: string };

/** The foreman Home's one-line outbox status. Entries that need attention come first; sent ones don't count. */
export function outboxStatus(items: { state: OutboxState }[]): OutboxStatus {
  const attention = items.filter((i) => i.state === "needs_attention").length;
  if (attention > 0) {
    return { tone: "attention", text: attention === 1 ? "1 entry needs attention." : `${attention} entries need attention.` };
  }
  const waiting = items.filter((i) => i.state === "waiting" || i.state === "sending").length;
  if (waiting > 0) {
    return { tone: "waiting", text: waiting === 1 ? "1 entry is waiting to send." : `${waiting} entries are waiting to send.` };
  }
  return { tone: "clear", text: "Everything on this phone has been sent." };
}
