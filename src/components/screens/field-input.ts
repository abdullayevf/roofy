import type { NoWorkReason, OutboxEntry, OutboxItem, OutboxState } from "@/data/contracts";
import { splitByShares } from "@/domain/split";
import type { BasisPoints, Hundredths, LocalDate, Unit } from "@/domain/types";
import { formatQuantity } from "@/lib/format";

/** A typed number with at most two decimals ("120", "12.5") as hundredths; null when it isn't one. */
export function parseHundredths(text: string): Hundredths | null {
  const m = /^(\d{0,7})(?:\.(\d{0,2}))?$/.exec(text.trim());
  if (!m || (m[1] === "" && (m[2] ?? "") === "")) return null;
  return Number(m[1] || "0") * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

/** Hundredths as a person would type them: 12000 -> "120", 3334 -> "33.34". */
export function hundredthsText(value: Hundredths): string {
  const whole = Math.floor(value / 100);
  const frac = value % 100;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}`;
}

/** 100% split equally among `count` people, in basis points; the extra point goes to the first person. */
export function equalShares(count: number): BasisPoints[] {
  return splitByShares(10000, count, { mode: "equal" });
}

/** Typed percentages as basis points, and their total (an empty or invalid box counts as 0%). */
export function sharesFromText(texts: string[]): { bp: BasisPoints[]; total: number } {
  const bp = texts.map((t) => parseHundredths(t) ?? 0);
  return { bp, total: bp.reduce((a, b) => a + b, 0) };
}

/** The message under the share fields, or null when they add up to 100%. */
export function shareTotalError(total: number): string | null {
  return total === 10000 ? null : `Shares must add up to 100%. Currently ${hundredthsText(total)}%.`;
}

/** The stage after this entry: the total done, and how far along it is (null without a budgeted quantity). */
export function progressAfter(
  stage: { done: Hundredths; planned: Hundredths | null },
  added: Hundredths,
): { done: Hundredths; percent: number | null } {
  const done = stage.done + added;
  const percent = stage.planned && stage.planned > 0 ? Math.min(100, Math.round((done * 100) / stage.planned)) : null;
  return { done, percent };
}

/** "120 of 400 m²" (quantities only, fine for a foreman), or "120 m² so far" without a budgeted quantity. */
export function progressLine(done: Hundredths, planned: Hundredths | null, unit: Unit): string {
  if (planned === null || planned <= 0) return `${formatQuantity(done, unit)} so far`;
  const suffix = formatQuantity(0, unit).slice(1);
  return `${formatQuantity(done, unit).slice(0, -suffix.length)} of ${formatQuantity(planned, unit)}`;
}

/** "240 of 400 m² after this": the stage once what is typed is added (quantities only, fine for a foreman). */
export function progressPreview(done: Hundredths, entered: Hundredths, planned: Hundredths | null, unit: Unit): string {
  const line = progressLine(done + entered, planned, unit);
  return `${planned === null || planned <= 0 ? line.replace(/ so far$/, "") : line} after this`;
}

/** The sentence under a disabled Save: only what is still missing, or undefined when nothing is. */
export function progressHint(s: { stage: boolean; quantity: boolean; people: boolean; totalError: string | null }): string | undefined {
  if (s.totalError) return s.totalError;
  const missing = [!s.stage && "choose a stage", !s.quantity && "type how much was done", !s.people && "tick at least one person"].filter(
    (m): m is string => m !== false,
  );
  return sentence(missing);
}

/** The sentence under a disabled Save no work. */
export function noWorkHint(s: { people: boolean; reason: boolean }): string | undefined {
  return sentence([!s.people && "tick at least one person", !s.reason && "choose why"].filter((m): m is string => m !== false));
}

/** "Choose a stage, type it and tick someone." from lower-case parts; undefined for none. */
function sentence(parts: string[]): string | undefined {
  if (parts.length === 0) return undefined;
  const text = parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${text[0]!.toUpperCase()}${text.slice(1)}.`;
}

/** People in the order set for their job (ids first, as listed); anyone not listed follows in their own order. */
export function orderByJob<T extends { id: string }>(people: T[], order: string[] | undefined): T[] {
  if (!order) return people;
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...people].sort((a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length));
}

// ─── Outbox ─────────────────────────────────────────────────────────────────

const GROUPS: { state: OutboxState; title: string }[] = [
  { state: "needs_attention", title: "Needs attention" },
  { state: "sending", title: "Sending" },
  { state: "waiting", title: "Waiting" },
  { state: "sent", title: "Sent" },
];

/** Non-empty groups in the order a person acts on them. */
export function groupOutbox(items: OutboxItem[]): { state: OutboxState; title: string; items: OutboxItem[] }[] {
  return GROUPS.map((g) => ({ ...g, items: items.filter((i) => i.state === g.state) })).filter((g) => g.items.length > 0);
}

/**
 * Why an entry needs attention, worded for the reader: a manager gets the server's message with its next step,
 * a foreman the "Ask your manager" wording.
 */
export function outboxReason(rejection: OutboxItem["rejection"], foreman: boolean): string {
  if (!rejection) return "This entry couldn't be sent.";
  return foreman ? rejection.message : (rejection.managerMessage ?? rejection.message);
}

const REASON: Record<NoWorkReason, string> = { rain: "Rain", leave: "Leave", sick: "Sick", other: "Other" };
export const reasonLabel = (r: NoWorkReason): string => REASON[r];

const KIND: Record<OutboxEntry["type"], string> = {
  crew_day: "Crew day",
  progress: "Progress",
  no_work: "No work",
  stage_pause: "Pause stage",
  stage_resume: "Resume stage",
  expense: "Expense",
};

/** What kind of entry it is, and one plain line of who and where. */
export function outboxLine(item: OutboxItem): { kind: string; detail: string } {
  const kind = KIND[item.entry.type];
  const who = item.crewNames.join(", ");
  if (item.entry.type === "no_work") return { kind, detail: `${reasonLabel(item.entry.input.reason)}: ${who}` };
  const quantity = item.entry.type === "progress" && item.unit ? formatQuantity(item.entry.input.quantity, item.unit) : null;
  const where = [item.projectName, item.stageName, quantity].filter(Boolean).join(", ");
  return { kind, detail: [where, who].filter(Boolean).join(": ") };
}

/** A `YYYY-MM-DD` date that exists on the calendar, or null (an address can say anything). */
export function parseLocalDate(text: string | undefined): LocalDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text ?? "");
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const at = new Date(Date.UTC(y, mo - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === mo - 1 && at.getUTCDate() === d ? (text as LocalDate) : null;
}

const OVERTIME: readonly Hundredths[] = [150, 200];

/**
 * Each person's days (daily) or hours (everyone else) and overtime, as the edit address carries them:
 * `id:value` or `id:value:multiplier`, comma separated. Anything else is ignored.
 */
export function parseEntryPicks(text: string | undefined): { values: Record<string, Hundredths>; multipliers: Record<string, Hundredths> } {
  const values: Record<string, Hundredths> = {};
  const multipliers: Record<string, Hundredths> = {};
  for (const part of (text ?? "").split(",")) {
    const [id, value, multiplier] = part.split(":");
    if (!id || !value || !/^\d+$/.test(value) || Number(value) <= 0) continue;
    values[id] = Number(value);
    if (multiplier && /^\d+$/.test(multiplier) && OVERTIME.includes(Number(multiplier))) multipliers[id] = Number(multiplier);
  }
  return { values, multipliers };
}

/** The original entry screen, filled in from everything that was entered ("Edit and resend"). */
export function editHref(entry: OutboxEntry): string {
  const q = new URLSearchParams();
  switch (entry.type) {
    case "crew_day":
      q.set("date", entry.input.date);
      q.set("project", entry.input.projectId);
      q.set("stage", entry.input.stageId);
      q.set("crew", entry.input.entries.map((e) => e.crewMemberId).join(","));
      q.set(
        "ex",
        entry.input.entries
          .map((e) => {
            const value = e.basis === "daily" ? e.days : e.hours;
            const overtime = e.multiplier !== null && e.multiplier !== 100 ? `:${e.multiplier}` : "";
            return `${e.crewMemberId}:${value ?? 0}${overtime}`;
          })
          .join(","),
      );
      return `/log?${q}`;
    case "progress":
      q.set("date", entry.input.date);
      q.set("stage", entry.input.stageId);
      q.set("qty", String(entry.input.quantity));
      q.set("crew", entry.input.crewMemberIds.join(","));
      if (entry.input.shares.mode === "custom") q.set("shares", entry.input.shares.bp.join(","));
      return `/log/progress?${q}`;
    case "no_work":
      q.set("date", entry.input.date);
      q.set("crew", entry.input.crewMemberIds.join(","));
      q.set("reason", entry.input.reason);
      if (entry.input.note) q.set("note", entry.input.note);
      return `/log/no-work?${q}`;
    default:
      return "/outbox";
  }
}

/** Less than this and the visual viewport is only losing browser chrome, not to a keyboard. */
const KEYBOARD_MIN_PX = 120;

/** How much of the bottom of the window the on-screen keyboard covers, from the visual viewport (0 when it is not up). */
export function keyboardInset(windowHeight: number, viewport: { height: number; offsetTop: number }): number {
  const covered = Math.round(windowHeight - viewport.height - viewport.offsetTop);
  return covered >= KEYBOARD_MIN_PX ? covered : 0;
}
