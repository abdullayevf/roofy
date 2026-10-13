// Field records: progress entries and their crew shares, work logs and no-work days.
import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgEnum, pgTable, text, integer, unique, uuid } from "drizzle-orm/pg-core";
import type { NoWorkReason } from "@/domain/attendance";
import type { Basis, LogSource } from "@/domain/types";
import { user } from "./auth";
import {
  allOf,
  bpInRange,
  cents,
  centsInRange,
  hundredths,
  localDate,
  signedCentsInRange,
  timestamptz,
} from "./columns";
import { crewMember } from "./crew";
import { project, stage, unitEnum } from "./jobs";
import { payRun } from "./money";
import { file } from "./system";
import { tenantColumns, tenantKey } from "./workspace";

export const workBasisEnum = pgEnum(
  "work_basis",
  allOf<Basis>()(["hourly", "daily", "per_unit", "lump_sum", "time_only"]),
);
export const logSourceEnum = pgEnum(
  "log_source",
  allOf<LogSource>()(["grid", "progress", "lump_sum", "adjustment"]),
);
export const noWorkReasonEnum = pgEnum(
  "no_work_reason",
  allOf<NoWorkReason>()(["rain", "leave", "sick", "other"]),
);

/** Units done on a stage on a day. The crew split lives in `progress_share`. */
export const progressEntry = pgTable(
  "progress_entry",
  {
    ...tenantColumns(),
    stageId: uuid("stage_id").notNull(),
    date: localDate("date").notNull(),
    quantity: hundredths("quantity").notNull(),
    enteredBy: uuid("entered_by")
      .notNull()
      .references(() => user.id),
    photoFileId: uuid("photo_file_id"),
    mutationId: uuid("mutation_id"),
  },
  (t) => [
    tenantKey("progress_entry", t),
    foreignKey({
      name: "progress_entry_stage_fk",
      columns: [t.workspaceId, t.stageId],
      foreignColumns: [stage.workspaceId, stage.id],
    }),
    foreignKey({
      name: "progress_entry_photo_file_fk",
      columns: [t.workspaceId, t.photoFileId],
      foreignColumns: [file.workspaceId, file.id],
    }),
    check("progress_entry_quantity_range", sql`${t.quantity} >= 0`),
    index("progress_entry_workspace_id_date_idx").on(t.workspaceId, t.date),
    index("progress_entry_workspace_id_stage_id_idx").on(t.workspaceId, t.stageId),
    index("progress_entry_workspace_id_photo_file_id_idx").on(t.workspaceId, t.photoFileId),
    index("progress_entry_entered_by_idx").on(t.enteredBy),
  ],
);

/** One crew member's share of a progress entry. Shares sum to 10000 (checked by the service). */
export const progressShare = pgTable(
  "progress_share",
  {
    ...tenantColumns(),
    progressEntryId: uuid("progress_entry_id").notNull(),
    crewMemberId: uuid("crew_member_id").notNull(),
    shareBp: integer("share_bp").notNull(),
  },
  (t) => [
    tenantKey("progress_share", t),
    unique("progress_share_entry_crew_key").on(t.workspaceId, t.progressEntryId, t.crewMemberId),
    foreignKey({
      name: "progress_share_progress_entry_fk",
      columns: [t.workspaceId, t.progressEntryId],
      foreignColumns: [progressEntry.workspaceId, progressEntry.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "progress_share_crew_member_fk",
      columns: [t.workspaceId, t.crewMemberId],
      foreignColumns: [crewMember.workspaceId, crewMember.id],
    }),
    bpInRange("progress_share_share_bp_range", t.shareBp),
    index("progress_share_workspace_id_crew_member_id_idx").on(t.workspaceId, t.crewMemberId),
  ],
);

/**
 * One pay line. `pay_run_id` set = locked (the trigger is Task 6). Only an adjustment may carry
 * negative quantity, hours or amount. `entry_id` groups the logs of one grid submission or progress
 * entry (domain `FlagLog.entryId`).
 */
export const workLog = pgTable(
  "work_log",
  {
    ...tenantColumns(),
    date: localDate("date").notNull(),
    crewMemberId: uuid("crew_member_id").notNull(),
    projectId: uuid("project_id").notNull(),
    stageId: uuid("stage_id").notNull(),
    basis: workBasisEnum("basis").notNull(),
    unit: unitEnum("unit"),
    quantity: hundredths("quantity").notNull(),
    hours: hundredths("hours").notNull(),
    multiplier: hundredths("multiplier"),
    rateCents: cents("rate_cents"),
    amountCents: cents("amount_cents").notNull(),
    source: logSourceEnum("source").notNull(),
    entryId: uuid("entry_id").notNull(),
    adjustsLogId: uuid("adjusts_log_id"),
    progressEntryId: uuid("progress_entry_id"),
    payRunId: uuid("pay_run_id"),
    enteredBy: uuid("entered_by")
      .notNull()
      .references(() => user.id),
    mutationId: uuid("mutation_id"),
    deletedAt: timestamptz("deleted_at"),
  },
  (t) => [
    tenantKey("work_log", t),
    foreignKey({
      name: "work_log_crew_member_fk",
      columns: [t.workspaceId, t.crewMemberId],
      foreignColumns: [crewMember.workspaceId, crewMember.id],
    }),
    foreignKey({
      name: "work_log_project_fk",
      columns: [t.workspaceId, t.projectId],
      foreignColumns: [project.workspaceId, project.id],
    }),
    foreignKey({
      name: "work_log_stage_fk",
      columns: [t.workspaceId, t.stageId],
      foreignColumns: [stage.workspaceId, stage.id],
    }),
    foreignKey({
      name: "work_log_adjusts_log_fk",
      columns: [t.workspaceId, t.adjustsLogId],
      foreignColumns: [t.workspaceId, t.id],
    }),
    foreignKey({
      name: "work_log_progress_entry_fk",
      columns: [t.workspaceId, t.progressEntryId],
      foreignColumns: [progressEntry.workspaceId, progressEntry.id],
    }),
    foreignKey({
      name: "work_log_pay_run_fk",
      columns: [t.workspaceId, t.payRunId],
      foreignColumns: [payRun.workspaceId, payRun.id],
    }),
    signedCentsInRange("work_log_amount_cents_range", t.amountCents),
    centsInRange("work_log_rate_cents_range", t.rateCents),
    check(
      "work_log_non_negative",
      sql`${t.source} = 'adjustment' or (${t.quantity} >= 0 and ${t.hours} >= 0 and ${t.amountCents} >= 0)`,
    ),
    check("work_log_multiplier_range", sql`${t.multiplier} is null or ${t.multiplier} > 0`),
    check("work_log_per_unit_has_unit", sql`${t.basis} <> 'per_unit' or ${t.unit} is not null`),
    check("work_log_adjusts_only_adjustment", sql`${t.adjustsLogId} is null or ${t.source} = 'adjustment'`),
    index("work_log_workspace_id_date_idx").on(t.workspaceId, t.date),
    index("work_log_workspace_id_stage_id_idx").on(t.workspaceId, t.stageId),
    index("work_log_workspace_id_crew_member_id_date_idx").on(t.workspaceId, t.crewMemberId, t.date),
    index("work_log_workspace_id_pay_run_id_idx").on(t.workspaceId, t.payRunId),
    index("work_log_workspace_id_project_id_idx").on(t.workspaceId, t.projectId),
    index("work_log_workspace_id_adjusts_log_id_idx").on(t.workspaceId, t.adjustsLogId),
    index("work_log_workspace_id_progress_entry_id_idx").on(t.workspaceId, t.progressEntryId),
    index("work_log_entered_by_idx").on(t.enteredBy),
  ],
);

/** A day a crew member did not work. One per crew member per date. */
export const noWork = pgTable(
  "no_work",
  {
    ...tenantColumns(),
    crewMemberId: uuid("crew_member_id").notNull(),
    date: localDate("date").notNull(),
    reason: noWorkReasonEnum("reason").notNull(),
    note: text("note"),
    enteredBy: uuid("entered_by")
      .notNull()
      .references(() => user.id),
    mutationId: uuid("mutation_id"),
  },
  (t) => [
    tenantKey("no_work", t),
    unique("no_work_workspace_id_crew_member_id_date_key").on(t.workspaceId, t.crewMemberId, t.date),
    foreignKey({
      name: "no_work_crew_member_fk",
      columns: [t.workspaceId, t.crewMemberId],
      foreignColumns: [crewMember.workspaceId, crewMember.id],
    }),
    index("no_work_workspace_id_date_idx").on(t.workspaceId, t.date),
    index("no_work_entered_by_idx").on(t.enteredBy),
  ],
);
