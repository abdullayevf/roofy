import type { JobType, ProjectStatus, StageDraft, StageProposal } from "@/data/contracts";
import type { Cents } from "@/domain/types";
import { parseLocalDate } from "./field-input";

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

/** What the person still has to do before Create job (or Save changes) works, in form order. */
export function jobMissing(v: JobFormValues, stages: { needStages: boolean; stagesAccepted: boolean }): string[] {
  const missing: string[] = [];
  if (!v.clientId) missing.push("choose a client");
  if (!v.jobType) missing.push("choose a job type");
  if (!v.nickname.trim()) missing.push("name the job");
  if (!v.siteAddress.trim()) missing.push("add the site address");
  if (finishProblem(v.startDate, v.targetFinish)) missing.push("move the target finish to after the start");
  if (stages.needStages && !stages.stagesAccepted) missing.push("accept the stages");
  return missing;
}

/** "Choose a client, name the job and add the site address." One plain sentence naming only what is missing. */
export function missingSentence(items: string[]): string | undefined {
  if (items.length === 0) return undefined;
  const text = items.length === 1 ? items[0]! : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
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
