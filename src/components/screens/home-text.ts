import type { ActiveJobRow, AttentionItem, MutationType, OutboxState, PayPeriodFigures, StageChip } from "@/data/contracts";
import type { PauseReason } from "@/domain/segments";
import { formatDate, formatDateTime, formatMoney, formatTime } from "@/lib/format";

const REASON: Record<PauseReason, string> = {
  weather: "weather",
  materials: "materials",
  client: "client",
  other_job: "another job",
  other: "other",
};

export const pauseReasonText = (reason: PauseReason): string => REASON[reason];

const WAITING_ON: Record<PauseReason, string> = { ...REASON, client: "the client", other: "something else" };

const ENTRY_WORD: Record<MutationType, string> = {
  crew_day: "hours",
  progress: "progress",
  no_work: "no-work note",
  stage_pause: "pause",
  stage_resume: "restart",
  expense: "expense",
};

/** "Mick", "Mick and Josh", "Mick and 2 others". */
function joinNames(names: string[]): string {
  if (names.length <= 2) return names.join(" and ");
  const n = names.length - 1;
  return `${names[0]} and ${n} ${n === 1 ? "other" : "others"}`;
}

const possessive = (s: string) => (s.endsWith("s") ? `${s}'` : `${s}'s`);

/** "Kev's hours for Smith job didn't send. Tap to fix." (a count when several failed). */
function outboxAttentionSentence(count: number, entries: { type: MutationType; crewNames: string[]; jobName: string | null }[]): string {
  const [e] = entries;
  if (count !== 1 || !e) return `${count} entries on this device didn't send. Tap to fix.`;
  const what = ENTRY_WORD[e.type];
  const subject = e.crewNames.length > 0 ? `${possessive(joinNames(e.crewNames))} ${what}` : what.charAt(0).toUpperCase() + what.slice(1);
  return `${subject}${e.jobName ? ` for ${e.jobName}` : ""} didn't send. Tap to fix.`;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** One plain sentence for a Needs attention row (product spec §5.9). */
export function attentionSentence(item: AttentionItem, today: string): string {
  switch (item.kind) {
    case "over_budget":
      return `${item.projectName} is ${formatMoney(item.byCents)} over on ${lower(item.stageName)}.`;
    case "trending_over":
      return `${item.projectName} is trending ${formatMoney(item.byCents)} over on ${lower(item.stageName)}.`;
    case "paused_too_long":
      return `${item.stageName} on ${item.projectName}: paused ${item.workingDays} working days, waiting on ${WAITING_ON[item.reason]}.`;
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
      return outboxAttentionSentence(item.count, item.entries);
  }
}

export function daysSinceText(days: number | null): string {
  if (days === null) return "Nothing logged yet";
  if (days === 0) return "Logged today";
  if (days === 1) return "Last logged yesterday";
  return `Last logged ${days} days ago`;
}

/** The stage alert on a job card, worded with the stage it belongs to ("Sheet install is trending $775.00 over its labour budget."). */
export function jobAlertText(
  alert: ActiveJobRow["alert"],
  stageName: string | null,
): { tone: "over" | "watch"; text: string } | null {
  if (alert === null) return null;
  const who = stageName ? `${stageName} is ` : "";
  const over = `${formatMoney(alert.byCents)} over its labour budget.`;
  return alert.level === "over"
    ? { tone: "over", text: `${who}${over}` }
    : { tone: "watch", text: `${who}trending ${over}` };
}

/** The stage line under a flagged job's tape: "Clean-up: $4,100.00 forecast of $4,000.00 budget". */
export const stageForecastLine = (stageName: string, forecastCents: number, budgetCents: number): string =>
  `${stageName}: ${formatMoney(forecastCents)} forecast of ${formatMoney(budgetCents)} budget`;

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
  return { tone: "clear", text: "Everything on this device has been sent." };
}

/** The row that expands Needs attention past its 7: "Show 3 more". */
export const showMoreText = (n: number): string => `Show ${n} more`;

/** The foreman Home's lead line: whether today's crew is logged. */
export function logStatusText(logged: { jobs: string[]; crewCount: number }): string {
  if (logged.jobs.length === 0) return "Not logged yet today";
  const where = logged.jobs.length === 1 ? logged.jobs[0] : `${logged.jobs.length} jobs`;
  return `Logged: ${where}, ${logged.crewCount} crew`;
}

type DeviceItem = { state: OutboxState; date: string; entry: { type: string; input: object } };
const UNSENT: OutboxState[] = ["waiting", "sending", "needs_attention"];
const isUnsentCrewDay = (i: DeviceItem, today: string) => i.entry.type === "crew_day" && i.date === today && UNSENT.includes(i.state);

/** True when this device holds a crew-day for today that hasn't been sent yet (waiting, sending or needing attention). */
export const loggedOnDevice = (items: DeviceItem[], today: string): boolean => items.some((i) => isUnsentCrewDay(i, today));

/** The jobs with a crew-day for today still on this device: their card says "Logged today, not sent yet". */
export function unsentJobIds(items: DeviceItem[], today: string): Set<string> {
  return new Set(
    items.filter((i) => isUnsentCrewDay(i, today)).map((i) => (i.entry.input as { projectId?: string }).projectId ?? ""),
  );
}

/**
 * The foreman Home's headline and whether the main button is "Fix entry". A failed entry comes first, then a crew-day
 * waiting on this device, then what the server has for today.
 */
export function foremanHeadline(
  logged: { jobs: string[]; crewCount: number },
  items: DeviceItem[],
  today: string,
): { text: string; fix: boolean } {
  const failed = items.filter((i) => i.state === "needs_attention").length;
  if (failed > 0) return { text: failed === 1 ? "1 entry needs fixing" : `${failed} entries need fixing`, fix: true };
  if (logged.jobs.length === 0 && loggedOnDevice(items, today)) return { text: "Logged, not sent yet", fix: false };
  return { text: logStatusText(logged), fix: false };
}

/** "Figures from 6:20 am." (with the date when they are from another day). One wording on both Homes. */
export function figuresFromText(asOf: string, timeZone: string, today: string): string {
  const full = formatDateTime(asOf, timeZone, today);
  const todayPrefix = `${formatDate(today, today)}, `;
  return `Figures from ${full.startsWith(todayPrefix) ? formatTime(asOf, timeZone) : full}.`;
}

/** The line under This pay period's figures: what to check and what blocks approval, worded for who is reading. */
export function payFlagsText(count: number, blockers: PayPeriodFigures["blockers"], role: "owner" | "manager" | "accountant"): string {
  const things = count === 1 ? "1 thing to check" : `${count} things to check`;
  if (role === "accountant") return `${things} in this pay run.`;
  const [first, ...rest] = blockers;
  if (!first) return `${things} before you approve.`;
  const stops =
    first.kind === "missing_rate"
      ? `Missing rate${first.crewName ? ` for ${first.crewName}` : ""} stops approval.`
      : "Two-factor sign-in is off and stops approval.";
  const more = rest.length > 0 ? ` ${rest.length} more also ${rest.length === 1 ? "stops it" : "stop it"}.` : "";
  return `${things} before you approve. ${stops}${more}`;
}
