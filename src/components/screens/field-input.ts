import type { NoWorkReason, OutboxEntry, OutboxItem, OutboxState } from "@/data/contracts";
import { splitByShares } from "@/domain/split";
import type { BasisPoints, Hundredths } from "@/domain/types";

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
  const where = [item.projectName, item.stageName].filter(Boolean).join(", ");
  return { kind, detail: [where, who].filter(Boolean).join(": ") };
}

/** The original entry screen, filled in from what was entered ("Edit and resend"). */
export function editHref(entry: OutboxEntry): string {
  const q = new URLSearchParams();
  switch (entry.type) {
    case "crew_day":
      q.set("project", entry.input.projectId);
      q.set("stage", entry.input.stageId);
      q.set("crew", entry.input.entries.map((e) => e.crewMemberId).join(","));
      return `/log?${q}`;
    case "progress":
      q.set("stage", entry.input.stageId);
      q.set("qty", String(entry.input.quantity));
      q.set("crew", entry.input.crewMemberIds.join(","));
      if (entry.input.shares.mode === "custom") q.set("shares", entry.input.shares.bp.join(","));
      return `/log/progress?${q}`;
    case "no_work":
      q.set("crew", entry.input.crewMemberIds.join(","));
      q.set("reason", entry.input.reason);
      return `/log/no-work?${q}`;
    default:
      return "/outbox";
  }
}
