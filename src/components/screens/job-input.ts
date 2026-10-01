import type { BudgetAlertDto, JobOverDto, JobType, ProjectStatus, StageChip, StageDraft, StageProposal } from "@/data/contracts";
import { addDays } from "@/domain/dates";
import type { Cents } from "@/domain/types";
import { formatDate, formatMoney } from "@/lib/format";
import type { Status } from "@/components/ui/status-chip";
import { parseLocalDate } from "./field-input";
import { lastLogText, pauseReasonText, stageLine } from "./home-text";

export const JOB_TYPES: { value: JobType; label: string }[] = [
  { value: "metal_reroof", label: "Metal re-roof" },
  { value: "tile_reroof", label: "Tile re-roof" },
  { value: "restoration", label: "Restoration" },
  { value: "repair", label: "Repair" },
  { value: "new_build", label: "New build" },
];

export const jobTypeLabel = (type: JobType): string => JOB_TYPES.find((t) => t.value === type)!.label;

export const STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "quoted", label: "Quoted" },
  { value: "on_hold", label: "On hold" },
  { value: "complete", label: "Complete" },
  { value: "closed", label: "Closed" },
];

export type JobFilter = ProjectStatus | "all";

export const STATUS_FILTERS: { value: JobFilter; label: string }[] = [...STATUSES, { value: "all", label: "All" }];

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v) || undefined;

/** The Jobs list's status filter from the address: anything unknown is Active. */
export function parseStatusFilter(value: string | string[] | undefined): JobFilter {
  const raw = one(value);
  return STATUS_FILTERS.find((f) => f.value === raw)?.value ?? "active";
}

const EMPTY_BY_STATUS: Record<ProjectStatus, string> = {
  active: "No active jobs right now.",
  quoted: "No quoted jobs.",
  on_hold: "No jobs on hold.",
  complete: "No complete jobs.",
  closed: "No closed jobs.",
};

/** What the list says when the chosen filter has no jobs (the workspace has some). */
export const statusEmptyMessage = (status: ProjectStatus): string => EMPTY_BY_STATUS[status];

export type JobFormValues = {
  clientId: string;
  jobType: JobType | "";
  nickname: string;
  siteAddress: string;
  contractCents: Cents | null;
  status: ProjectStatus;
  /** `YYYY-MM-DD` or "". */
  startDate: string;
  targetFinish: string;
};

/** The target finish can't come before the start (the server says the same in the same words). */
export function finishProblem(start: string, finish: string): string | null {
  return start && finish && finish < start ? "The target finish can't be before the start." : null;
}

/** The job's name: the one typed, else its site address (the job name is optional). */
export const jobNameFor = (v: Pick<JobFormValues, "nickname" | "siteAddress">): string => v.nickname.trim() || v.siteAddress.trim();

/** What the person still has to do before Create job (or Save changes) works, in form order. */
export function jobMissing(v: JobFormValues, stages: { needStages: boolean; stagesAccepted: boolean; noClients?: boolean }): string[] {
  const missing: string[] = [];
  if (!v.clientId) missing.push(stages.noClients ? "add a client first" : "choose a client");
  if (!v.jobType) missing.push("choose a job type");
  if (!v.siteAddress.trim()) missing.push("add the site address");
  if (finishProblem(v.startDate, v.targetFinish)) missing.push("move the target finish to after the start");
  if (stages.needStages && !stages.stagesAccepted) missing.push("accept the stages");
  return missing;
}

/** "Choose a client and add the site address." One plain sentence naming only what is missing. */
export function missingSentence(items: string[]): string | undefined {
  if (items.length === 0) return undefined;
  const text = items.length === 1 ? items[0]! : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

/** The fields that show a server message beside them; any other refusal goes in the bar above Create job. */
const FIELDS_WITH_SLOT = ["clientId", "siteAddress", "nickname", "startDate", "targetFinish"];

/**
 * What the bar above Create job says about a refused save, or null when every refusal already shows beside its field.
 * A refusal with no slot (the contract value, a stage) is never hidden by a slotted one. A job name refusal, with the
 * name left blank, is about the address that stood in for it, so it goes in the bar rather than under the empty field.
 */
export function refusalBarMessage(issues: { field: string; message: string }[], message: string, nameBlank: boolean): string | null {
  if (issues.length === 0) return message;
  const loose = issues.find((i) => !FIELDS_WITH_SLOT.includes(i.field) || (i.field === "nickname" && nameBlank));
  if (!loose) return null;
  return loose.field === "nickname" ? "The site address is too long to name the job. Add a shorter job name." : loose.message;
}

/**
 * Whether the form is complete and changed enough to save, and the one sentence under the button when it is not (the
 * screen adds the signal). A new job is always changed; an edit needs a change from the job as it opened.
 */
export function jobSaveState(
  v: JobFormValues,
  initial: JobFormValues,
  o: { isNew: boolean; stagesAccepted: boolean; noClients?: boolean },
): { ready: boolean; hint: string | undefined } {
  const missing = jobMissing(v, { needStages: o.isNew, stagesAccepted: o.stagesAccepted, noClients: o.noClients });
  const dirty = o.isNew || (Object.keys(v) as (keyof JobFormValues)[]).some((k) => v[k] !== initial[k]);
  return {
    ready: missing.length === 0 && dirty,
    hint: missingSentence(missing.slice(0, 1)) ?? (dirty ? undefined : "Change something to save."),
  };
}

/** Where a proposed stage list came from, in a sentence. */
export function proposalSource(p: StageProposal): string {
  const type = jobTypeLabel(p.jobType).toLowerCase();
  return p.source.kind === "last_job" ? `From your last ${type} job, ${p.source.projectName}.` : `From the ${type} template.`;
}

/** Stages numbered 1, 2, 3… in the order given. */
export const renumber = (stages: StageDraft[]): StageDraft[] => stages.map((s, i) => ({ ...s, position: i + 1 }));

export type JobPrefill = JobFormValues & { accepted: boolean };

/**
 * A new job opened already filled in (design captures, and a later "add another like this"): `client`, `type`, `name`,
 * `address`, `contract` (cents), `status`, `start`, `finish`, `accepted=1`. Anything that isn't real is left blank.
 */
export function parseJobPrefill(params: Record<string, string | string[] | undefined>, clientIds: ReadonlySet<string>): JobPrefill {
  const client = one(params.client);
  const type = JOB_TYPES.find((t) => t.value === one(params.type))?.value ?? "";
  const contract = /^\d{1,10}$/.test(one(params.contract) ?? "") ? Number(one(params.contract)) : null;
  return {
    clientId: client && clientIds.has(client) ? client : "",
    jobType: type,
    nickname: one(params.name) ?? "",
    siteAddress: one(params.address) ?? "",
    contractCents: contract,
    status: STATUSES.find((s) => s.value === one(params.status))?.value ?? "active",
    startDate: parseLocalDate(one(params.start)) ?? "",
    targetFinish: parseLocalDate(one(params.finish)) ?? "",
    accepted: one(params.accepted) === "1",
  };
}

/**
 * A job's labour alert as one sentence that names its stage, because the amount is that stage's, not the job's:
 * "Sheet install is $100.00 over" (red) or "Sheet install is trending $775.00 over" (amber).
 */
export function jobAlertText(alert: Pick<BudgetAlertDto, "level" | "byCents">, stageName: string | null): string {
  const by = formatMoney(alert.byCents);
  const stage = stageName ?? "A stage";
  return alert.level === "over" ? `${stage} is ${by} over` : `${stage} is trending ${by} over`;
}

export type JobLine = {
  /** The one alert on the job, when it has one (it replaces everything else on the line). */
  alert?: { tone: "over" | "watch"; text: string };
  /** A status chip: Paused with its reason, or the job's own status when it isn't active. */
  chip?: { status: Status; reason?: string };
  text?: string;
};

const JOB_CHIP: Record<Exclude<ProjectStatus, "active">, Status> = {
  quoted: "quoted",
  on_hold: "on-hold",
  complete: "complete",
  closed: "closed",
};

/** The over-budget sentence, naming what is over: "Labour is $120.00 over budget" or "Sheet install is $100.00 over". */
export function jobOverText(over: JobOverDto): string {
  const by = formatMoney(over.byCents);
  return over.kind === "labour" ? `Labour is ${by} over budget` : `${over.stageName} is ${by} over`;
}

/**
 * What a job row's one status line says: over budget (any status), else on an active job the trending alert,
 * else a chip with the current stages. A job that isn't active keeps its chip beside the over-budget sentence.
 */
export function jobLine(row: {
  status: ProjectStatus;
  pctBp: number;
  currentStages: StageChip[];
  alert?: BudgetAlertDto | null;
  alertStageName?: string | null;
  over?: JobOverDto | null;
}): JobLine {
  const over: JobLine["alert"] | undefined = row.over ? { tone: "over", text: jobOverText(row.over) } : undefined;
  if (row.status === "active") {
    if (over) return { alert: over };
    if (row.alert) return { alert: { tone: "watch", text: jobAlertText(row.alert, row.alertStageName ?? null) } };
  }
  const paused = row.currentStages.find((s) => s.status === "paused" && s.pauseReason);
  if (row.status === "active" && paused?.pauseReason) {
    return { chip: { status: "paused", reason: pauseReasonText(paused.pauseReason) }, text: paused.name };
  }
  if (row.status === "active") {
    return { text: row.currentStages.length === 0 && row.pctBp >= 10000 ? "All stages done" : stageLine(row.currentStages) };
  }
  const chip: NonNullable<JobLine["chip"]> = { status: JOB_CHIP[row.status] };
  if (row.status === "on_hold" && paused?.pauseReason) chip.reason = pauseReasonText(paused.pauseReason);
  if (over) return { chip, alert: over };
  if (row.status === "complete" || (row.status === "closed" && row.pctBp >= 10000)) return { chip, text: "All stages done" };
  const names = row.status === "on_hold" ? row.currentStages.map((s) => s.name) : null;
  return { chip, text: names && names.length > 0 ? names.join(", ") : stageLine(row.currentStages) };
}

/** A job's last log: "3 days ago" within a week, then the date ("Mon 7 Sep"). */
export function lastLogOn(days: number | null, today: string): string {
  return days !== null && days > 7 ? formatDate(addDays(today, -days), today) : lastLogText(days);
}

/** How many of these jobs are over budget by the same rule as each row's line (the lead line on the Jobs list). */
export const overBudgetJobs = (rows: { over: JobOverDto | null }[]): number => rows.filter((r) => r.over !== null).length;
