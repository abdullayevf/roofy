// Clients, projects, stage templates, stages and their active/paused segments, and foreman scope.
import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgEnum, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import type { JobType, ProjectStatus } from "@/data/contracts";
import type { StageStatus } from "@/domain/progress";
import type { PauseReason } from "@/domain/segments";
import type { Unit } from "@/domain/types";
import { allOf, bpInRange, cents, centsInRange, hundredths, localDate } from "./columns";
import { member, tenantColumns, tenantKey } from "./workspace";

export const jobTypeEnum = pgEnum(
  "job_type",
  allOf<JobType>()(["metal_reroof", "tile_reroof", "restoration", "repair", "new_build"]),
);
export const projectStatusEnum = pgEnum(
  "project_status",
  allOf<ProjectStatus>()(["quoted", "active", "on_hold", "complete", "closed"]),
);
export const stageStatusEnum = pgEnum(
  "stage_status",
  allOf<StageStatus>()(["not_started", "active", "paused", "done"]),
);
export const unitEnum = pgEnum("unit", allOf<Unit>()(["m2", "lm", "each"]));
export const pauseReasonEnum = pgEnum(
  "pause_reason",
  allOf<PauseReason>()(["weather", "materials", "client", "other_job", "other"]),
);

export const client = pgTable(
  "client",
  {
    ...tenantColumns(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
  },
  (t) => [tenantKey("client", t)],
);

export const project = pgTable(
  "project",
  {
    ...tenantColumns(),
    clientId: uuid("client_id"),
    siteAddress: text("site_address").notNull(),
    nickname: text("nickname"),
    jobType: jobTypeEnum("job_type").notNull(),
    contractValueCents: cents("contract_value_cents"),
    status: projectStatusEnum("status").notNull().default("quoted"),
    startDate: localDate("start_date"),
    targetFinish: localDate("target_finish"),
  },
  (t) => [
    tenantKey("project", t),
    foreignKey({
      name: "project_client_fk",
      columns: [t.workspaceId, t.clientId],
      foreignColumns: [client.workspaceId, client.id],
    }),
    centsInRange("project_contract_value_cents_range", t.contractValueCents),
    index("project_workspace_id_status_idx").on(t.workspaceId, t.status),
    index("project_workspace_id_client_id_idx").on(t.workspaceId, t.clientId),
  ],
);

export const projectAssignment = pgTable(
  "project_assignment",
  {
    ...tenantColumns(),
    memberId: uuid("member_id").notNull(),
    projectId: uuid("project_id").notNull(),
  },
  (t) => [
    tenantKey("project_assignment", t),
    unique("project_assignment_member_project_key").on(t.workspaceId, t.memberId, t.projectId),
    foreignKey({
      name: "project_assignment_member_fk",
      columns: [t.workspaceId, t.memberId],
      foreignColumns: [member.workspaceId, member.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "project_assignment_project_fk",
      columns: [t.workspaceId, t.projectId],
      foreignColumns: [project.workspaceId, project.id],
    }).onDelete("cascade"),
    index("project_assignment_workspace_id_project_id_idx").on(t.workspaceId, t.projectId),
  ],
);

export const stageTemplate = pgTable(
  "stage_template",
  {
    ...tenantColumns(),
    jobType: jobTypeEnum("job_type").notNull(),
    name: text("name").notNull(),
  },
  (t) => [tenantKey("stage_template", t)],
);

export const stageTemplateItem = pgTable(
  "stage_template_item",
  {
    ...tenantColumns(),
    templateId: uuid("template_id").notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    defaultUnit: unitEnum("default_unit"),
    labourShareBp: integer("labour_share_bp").notNull().default(0),
    materialsShareBp: integer("materials_share_bp").notNull().default(0),
  },
  (t) => [
    tenantKey("stage_template_item", t),
    foreignKey({
      name: "stage_template_item_template_fk",
      columns: [t.workspaceId, t.templateId],
      foreignColumns: [stageTemplate.workspaceId, stageTemplate.id],
    }).onDelete("cascade"),
    bpInRange("stage_template_item_labour_share_bp_range", t.labourShareBp),
    bpInRange("stage_template_item_materials_share_bp_range", t.materialsShareBp),
    index("stage_template_item_workspace_id_template_id_idx").on(t.workspaceId, t.templateId),
  ],
);

export const stage = pgTable(
  "stage",
  {
    ...tenantColumns(),
    projectId: uuid("project_id").notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    status: stageStatusEnum("status").notNull().default("not_started"),
    unit: unitEnum("unit"),
    budgetQty: hundredths("budget_qty"),
    labourBudgetCents: cents("labour_budget_cents"),
    materialsBudgetCents: cents("materials_budget_cents"),
    lumpSumCents: cents("lump_sum_cents"),
    manualPctBp: integer("manual_pct_bp"),
    completedOn: localDate("completed_on"),
  },
  (t) => [
    tenantKey("stage", t),
    foreignKey({
      name: "stage_project_fk",
      columns: [t.workspaceId, t.projectId],
      foreignColumns: [project.workspaceId, project.id],
    }).onDelete("cascade"),
    centsInRange("stage_labour_budget_cents_range", t.labourBudgetCents),
    centsInRange("stage_materials_budget_cents_range", t.materialsBudgetCents),
    centsInRange("stage_lump_sum_cents_range", t.lumpSumCents),
    /** ManualPctBp: the 25% steps. */
    check("stage_manual_pct_bp_step", sql`${t.manualPctBp} in (0, 2500, 5000, 7500, 10000)`),
    check("stage_budget_qty_range", sql`${t.budgetQty} >= 0`),
    index("stage_workspace_id_project_id_idx").on(t.workspaceId, t.projectId),
  ],
);

/** Half-open active ranges: a null end date is still open. */
export const stageSegment = pgTable(
  "stage_segment",
  {
    ...tenantColumns(),
    stageId: uuid("stage_id").notNull(),
    startDate: localDate("start_date").notNull(),
    endDate: localDate("end_date"),
    pauseReason: pauseReasonEnum("pause_reason"),
    pauseNote: text("pause_note"),
  },
  (t) => [
    tenantKey("stage_segment", t),
    foreignKey({
      name: "stage_segment_stage_fk",
      columns: [t.workspaceId, t.stageId],
      foreignColumns: [stage.workspaceId, stage.id],
    }).onDelete("cascade"),
    check("stage_segment_end_after_start", sql`${t.endDate} is null or ${t.endDate} >= ${t.startDate}`),
    index("stage_segment_workspace_id_stage_id_idx").on(t.workspaceId, t.stageId),
  ],
);
