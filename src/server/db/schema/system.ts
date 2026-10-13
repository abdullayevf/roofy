// Stored files, the phone's mutation ids (idempotency, architecture §7) and the audit trail.
import { sql } from "drizzle-orm";
import { bigint, check, index, jsonb, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import type { MutationType } from "@/data/contracts";
import { user } from "./auth";
import { allOf, timestamps, timestamptz } from "./columns";
import { tenantColumns, tenantKey, workspace } from "./workspace";

export const fileEntityTypeEnum = pgEnum("file_entity_type", [
  "project",
  "expense",
  "progress_entry",
  "stage",
]);
export const mutationTypeEnum = pgEnum(
  "mutation_type",
  allOf<MutationType>()(["crew_day", "progress", "no_work", "stage_pause", "stage_resume", "expense"]),
);
export const auditActionEnum = pgEnum("audit_action", ["insert", "update", "delete"]);

/** A stored upload. `entity_type` + `entity_id` say what it belongs to (no FK: it is polymorphic). */
export const file = pgTable(
  "file",
  {
    ...tenantColumns(),
    storageKey: text("storage_key").notNull().unique("file_storage_key_key"),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    bytes: bigint("bytes", { mode: "number" }).notNull(),
    sha256: text("sha256").notNull(),
    entityType: fileEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
  },
  (t) => [
    tenantKey("file", t),
    check("file_bytes_range", sql`${t.bytes} between 0 and ${sql.raw(String(Number.MAX_SAFE_INTEGER))}`),
    check("file_sha256_hex", sql`${t.sha256} ~ '^[0-9a-f]{64}$'`),
    index("file_workspace_id_entity_idx").on(t.workspaceId, t.entityType, t.entityId),
  ],
);

/** One row per mutation the phone sent. `id` is the phone's uuid, so a replay is a no-op. */
export const clientMutation = pgTable(
  "client_mutation",
  {
    id: uuid("id").primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    ...timestamps(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    type: mutationTypeEnum("type").notNull(),
    receivedAt: timestamptz("received_at").notNull().defaultNow(),
    result: jsonb("result"),
  },
  (t) => [
    tenantKey("client_mutation", t),
    index("client_mutation_user_id_idx").on(t.userId),
    index("client_mutation_workspace_id_received_at_idx").on(t.workspaceId, t.receivedAt),
  ],
);

/**
 * Written by the audit trigger (Task 6). `actor_user_id` has no FK so the trail outlives the user,
 * and `row_id` none because it names a row in any table.
 */
export const auditEvent = pgTable(
  "audit_event",
  {
    ...tenantColumns(),
    tableName: text("table_name").notNull(),
    rowId: uuid("row_id").notNull(),
    action: auditActionEnum("action").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    actorUserId: uuid("actor_user_id"),
    at: timestamptz("at").notNull().defaultNow(),
  },
  (t) => [
    tenantKey("audit_event", t),
    index("audit_event_workspace_id_table_row_idx").on(t.workspaceId, t.tableName, t.rowId),
    index("audit_event_workspace_id_at_idx").on(t.workspaceId, t.at),
  ],
);
