/**
 * What every fake service method works from: the store's tables and indexes, the figures for the
 * work date, the demo state — plus the role rules (product spec §3) and the row → DTO mappers.
 */
import { todayIn } from "@/domain/dates";
import type { LocalDate } from "@/domain/types";
import {
  DataError,
  type Access,
  type Actor,
  type DemoState,
  type ExpenseRowForeman,
  type ExpenseRowManager,
  type FieldAccess,
  type FileRef,
  type Id,
  type LogRowForeman,
  type LogRowManager,
  type Role,
} from "../../contracts";
import { Figures } from "../figures";
import type { StoreIndex } from "../indexes";
import type { ExpenseRow, FileRow, WorkLogRow } from "../rows";
import type { Seed } from "../seed";
import type { FakeStore } from "../store";

export const NO_ACCESS = "You don't have access to this. Ask your manager.";

export interface ServiceOptions {
  /** The instant "now" (fake clock); today = its date in the workspace timezone. */
  now: () => Date;
  demo: DemoState | null;
}

export class FakeContext {
  private cache: { version: number; today: LocalDate; figures: Figures } | null = null;

  constructor(
    readonly store: FakeStore,
    readonly options: ServiceOptions,
  ) {}

  get t(): Seed {
    return this.store.tables;
  }

  get ix(): StoreIndex {
    return this.store.indexes();
  }

  now(): Date {
    return this.options.now();
  }

  get today(): LocalDate {
    return todayIn(this.t.workspace.timezone, this.now());
  }

  /** The workspace setting, or off when `?demo=blocked`. */
  get ownerTwoFactor(): boolean {
    if (this.options.demo === "blocked") return false;
    return this.t.members.find((m) => m.role === "owner")?.twoFactorEnabled ?? false;
  }

  get fig(): Figures {
    const today = this.today;
    if (this.cache?.version !== this.store.version || this.cache.today !== today) {
      this.cache = {
        version: this.store.version,
        today,
        figures: new Figures(this.t, this.ix, today, this.ownerTwoFactor),
      };
    }
    return this.cache.figures;
  }

  // ─── Role rules (product spec §3) ─────────────────────────────────────────

  check(actor: Actor): void {
    if (actor.workspaceId !== this.t.workspace.id) throw forbidden();
  }

  /** Manager-view access: Owner/Manager full, Accountant read + export; Foreman → forbidden. */
  access(actor: Actor): Access {
    this.check(actor);
    return accessFor(actor.role);
  }

  isForeman(actor: Actor): boolean {
    this.check(actor);
    return actor.role === "foreman";
  }

  /** Projects the actor may see: null = all (non-foreman). */
  visibleProjects(actor: Actor): Set<Id> | null {
    if (!this.isForeman(actor)) return null;
    const member = this.t.members.find((m) => m.userId === actor.userId);
    return new Set(member ? this.ix.assignedProjects(member.id) : []);
  }

  canSeeProject(actor: Actor, projectId: Id): boolean {
    const visible = this.visibleProjects(actor);
    return visible === null || visible.has(projectId);
  }

  /** Throws not_found for an unknown project, forbidden for a foreman's unassigned one. */
  requireProject(actor: Actor, projectId: Id) {
    const project = this.ix.projects.get(projectId);
    if (!project) throw notFound("job");
    if (!this.canSeeProject(actor, projectId)) throw forbidden();
    return project;
  }

  requireStage(actor: Actor, stageId: Id) {
    const stage = this.ix.stages.get(stageId);
    if (!stage) throw notFound("stage");
    this.requireProject(actor, stage.projectId);
    return stage;
  }

  // ─── Mappers ──────────────────────────────────────────────────────────────

  memberName(userId: Id): string {
    return this.ix.membersByUser.get(userId)?.name ?? "Someone";
  }

  logForeman(l: WorkLogRow): LogRowForeman {
    const stage = this.ix.stages.get(l.stageId)!;
    return {
      id: l.id,
      date: l.date,
      crewMemberId: l.crewMemberId,
      crewName: this.fig.crewOf(l.crewMemberId).name,
      projectId: l.projectId,
      projectName: this.ix.projects.get(l.projectId)!.nickname,
      stageId: l.stageId,
      stageName: stage.name,
      basis: l.basis,
      unit: l.unit,
      quantity: l.quantity,
      hours: l.hours,
      source: l.source,
      enteredByName: this.memberName(l.enteredBy),
    };
  }

/** Foreman log lists: adjustments are pay-run artefacts (pay rules §8), not field facts. */
  static fieldLogs<T extends { source: WorkLogRow["source"] }>(logs: readonly T[]): T[] {
    return logs.filter((l) => l.source !== "adjustment");
  }

    logManager(l: WorkLogRow): LogRowManager {
    return {
      ...this.logForeman(l),
      multiplier: l.multiplier,
      rateCents: l.rateCents,
      amountCents: l.amountCents,
      labourCostCents: this.fig.labourCostOf(l),
      missingRate: l.missingRate,
      payRunId: l.payRunId,
      adjustsLogId: l.adjustsLogId,
    };
  }

  expenseForeman(e: ExpenseRow): ExpenseRowForeman {
    const stage = e.stageId === null ? null : this.ix.stages.get(e.stageId)!;
    const category = this.ix.categories.get(e.categoryId)!;
    return {
      id: e.id,
      date: e.date,
      supplier: e.supplier,
      projectId: e.projectId,
      projectName: this.ix.projects.get(e.projectId)!.nickname,
      stageId: e.stageId,
      stageName: stage?.name ?? null,
      category: { id: category.id, name: category.name },
      paidBy: e.paidBy,
      crewMemberId: e.crewMemberId,
      crewName: e.crewMemberId === null ? null : this.fig.crewOf(e.crewMemberId).name,
      hasReceipt: e.receiptFileId !== null,
    };
  }

  expenseManager(e: ExpenseRow): ExpenseRowManager {
    return {
      ...this.expenseForeman(e),
      amountExGstCents: e.amountExGstCents,
      gstCents: e.gstCents,
      totalCents: this.fig.expenseTotalOf(e),
      costCents: this.fig.expenseCostOf(e),
      reimbursement: this.fig.reimbursementOf(e),
    };
  }

  fileRef(f: FileRow): FileRef {
    return {
      id: f.id,
      name: f.name,
      mime: f.mime,
      bytes: f.bytes,
      kind: f.mime.startsWith("image/") ? "photo" : f.mime === "application/pdf" ? "pdf" : "other",
      uploadedAt: f.createdAt,
    };
  }
}

export function accessFor(role: Role): Access {
  switch (role) {
    case "owner":
      return { role, canEdit: true, canApprove: true, canExport: true, canAdminister: true };
    case "manager":
      return { role, canEdit: true, canApprove: true, canExport: true, canAdminister: false };
    case "accountant":
      return { role, canEdit: false, canApprove: false, canExport: true, canAdminister: false };
    case "foreman":
      throw forbidden();
  }
}

/** Foreman: field entries on assigned projects only; never Done. */
export const FIELD_ACCESS: FieldAccess = {
  role: "foreman",
  canLog: true,
  canPause: true,
  canMarkDone: false,
};

export function forbidden(message = NO_ACCESS): DataError {
  return new DataError("forbidden", message);
}

export function notFound(what: string): DataError {
  return new DataError("not_found", `We couldn't find this ${what}. It may have been removed.`);
}

/** The signed-in person for a role in this workspace (prototype: one member per role). */
export function actorFor(tables: Seed, role: Role): Actor {
  const member = tables.members.find((m) => m.role === role);
  if (!member) throw new Error(`no ${role} in the fake workspace`);
  return { userId: member.userId, workspaceId: tables.workspace.id, role, name: member.name };
}

/** "Smith job — Ryde re-roof" → "Smith job". */
export const shortName = (nickname: string): string => nickname.split(" — ")[0]!;
