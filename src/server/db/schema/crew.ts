// Crew levels, crew members, their rates, and lump-sum completion shares.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { RateBasis, WorkerType } from "@/domain/types";
import { allOf, bpInRange, cents, centsInRange, localDate } from "./columns";
import { project, stage, unitEnum } from "./jobs";
import { tenantColumns, tenantKey } from "./workspace";

export const workerTypeEnum = pgEnum("worker_type", allOf<WorkerType>()(["employee", "contractor"]));
export const rateBasisEnum = pgEnum("rate_basis", allOf<RateBasis>()(["hourly", "daily", "per_unit"]));

export const crewLevel = pgTable(
  "crew_level",
  {
    ...tenantColumns(),
    name: text("name").notNull(),
    floorRateCents: cents("floor_rate_cents").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [tenantKey("crew_level", t), centsInRange("crew_level_floor_rate_cents_range", t.floorRateCents)],
);

export const crewMember = pgTable(
  "crew_member",
  {
    ...tenantColumns(),
    name: text("name").notNull(),
    phone: text("phone"),
    type: workerTypeEnum("type").notNull(),
    levelId: uuid("level_id"),
    abn: text("abn"),
    gstRegistered: boolean("gst_registered").notNull().default(false),
    activeFrom: localDate("active_from").notNull(),
    activeTo: localDate("active_to"),
    defaultBasis: rateBasisEnum("default_basis").notNull().default("hourly"),
    defaultUnit: unitEnum("default_unit"),
  },
  (t) => [
    tenantKey("crew_member", t),
    foreignKey({
      name: "crew_member_level_fk",
      columns: [t.workspaceId, t.levelId],
      foreignColumns: [crewLevel.workspaceId, crewLevel.id],
    }),
    index("crew_member_workspace_id_level_id_idx").on(t.workspaceId, t.levelId),
    check("crew_member_active_range", sql`${t.activeTo} is null or ${t.activeTo} >= ${t.activeFrom}`),
  ],
);

/** A crew member's pay rate. A null project is the default rate; a set project overrides it. */
export const rate = pgTable(
  "rate",
  {
    ...tenantColumns(),
    crewMemberId: uuid("crew_member_id").notNull(),
    basis: rateBasisEnum("basis").notNull(),
    unit: unitEnum("unit"),
    amountCents: cents("amount_cents").notNull(),
    effectiveFrom: localDate("effective_from").notNull(),
    projectId: uuid("project_id"),
  },
  (t) => [
    tenantKey("rate", t),
    unique("rate_crew_basis_unit_project_from_key")
      .on(t.workspaceId, t.crewMemberId, t.basis, t.unit, t.projectId, t.effectiveFrom)
      .nullsNotDistinct(),
    foreignKey({
      name: "rate_crew_member_fk",
      columns: [t.workspaceId, t.crewMemberId],
      foreignColumns: [crewMember.workspaceId, crewMember.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "rate_project_fk",
      columns: [t.workspaceId, t.projectId],
      foreignColumns: [project.workspaceId, project.id],
    }).onDelete("cascade"),
    centsInRange("rate_amount_cents_range", t.amountCents),
    index("rate_workspace_id_project_id_idx").on(t.workspaceId, t.projectId),
  ],
);

/** The lump-sum split confirmed when a stage is marked done. */
export const stageCompletionShare = pgTable(
  "stage_completion_share",
  {
    ...tenantColumns(),
    stageId: uuid("stage_id").notNull(),
    crewMemberId: uuid("crew_member_id").notNull(),
    shareBp: integer("share_bp").notNull(),
  },
  (t) => [
    tenantKey("stage_completion_share", t),
    unique("stage_completion_share_stage_crew_key").on(t.workspaceId, t.stageId, t.crewMemberId),
    foreignKey({
      name: "stage_completion_share_stage_fk",
      columns: [t.workspaceId, t.stageId],
      foreignColumns: [stage.workspaceId, stage.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "stage_completion_share_crew_member_fk",
      columns: [t.workspaceId, t.crewMemberId],
      foreignColumns: [crewMember.workspaceId, crewMember.id],
    }),
    bpInRange("stage_completion_share_share_bp_range", t.shareBp),
    index("stage_completion_share_workspace_id_crew_member_id_idx").on(t.workspaceId, t.crewMemberId),
  ],
);
