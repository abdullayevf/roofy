// Expense categories and expenses, pay runs and their frozen lines, the crew ledger and
// statement links.
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { PaidBy, PayoutMethod, PayRunStatus } from "@/data/contracts";
import type { LedgerKind } from "@/domain/ledger";
import { user } from "./auth";
import { allOf, cents, centsInRange, localDate, signedCentsInRange, timestamptz } from "./columns";
import { crewMember } from "./crew";
import { project, stage } from "./jobs";
import { file } from "./system";
import { tenantColumns, tenantKey } from "./workspace";

export const paidByEnum = pgEnum("paid_by", allOf<PaidBy>()(["company_card", "cash", "crew"]));
export const payRunStatusEnum = pgEnum(
  "pay_run_status",
  allOf<PayRunStatus>()(["draft", "approved", "exported"]),
);
export const payRunLineKindEnum = pgEnum("pay_run_line_kind", ["log", "reimbursement", "gst"]);
export const ledgerKindEnum = pgEnum(
  "ledger_kind",
  allOf<LedgerKind>()(["payrun_credit", "advance", "payment"]),
);
export const payoutMethodEnum = pgEnum(
  "payout_method",
  allOf<PayoutMethod>()(["bank_transfer", "cash", "other"]),
);

export const expenseCategory = pgTable(
  "expense_category",
  {
    ...tenantColumns(),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [tenantKey("expense_category", t)],
);

export const payRun = pgTable(
  "pay_run",
  {
    ...tenantColumns(),
    periodStart: localDate("period_start").notNull(),
    periodEnd: localDate("period_end").notNull(),
    status: payRunStatusEnum("status").notNull().default("draft"),
    approvedBy: uuid("approved_by").references(() => user.id),
    approvedAt: timestamptz("approved_at"),
    exportedAt: timestamptz("exported_at"),
  },
  (t) => [
    tenantKey("pay_run", t),
    unique("pay_run_workspace_id_period_key").on(t.workspaceId, t.periodStart, t.periodEnd),
    check("pay_run_period_range", sql`${t.periodEnd} >= ${t.periodStart}`),
    index("pay_run_approved_by_idx").on(t.approvedBy),
  ],
);

/** `crew_member_id` is set exactly when the crew member paid (and is owed a reimbursement). */
export const expense = pgTable(
  "expense",
  {
    ...tenantColumns(),
    projectId: uuid("project_id").notNull(),
    stageId: uuid("stage_id"),
    categoryId: uuid("category_id").notNull(),
    supplier: text("supplier").notNull(),
    date: localDate("date").notNull(),
    amountExGstCents: cents("amount_ex_gst_cents").notNull(),
    gstCents: cents("gst_cents").notNull(),
    paidBy: paidByEnum("paid_by").notNull(),
    crewMemberId: uuid("crew_member_id"),
    receiptFileId: uuid("receipt_file_id"),
    reimbursedInPayRunId: uuid("reimbursed_in_pay_run_id"),
    enteredBy: uuid("entered_by")
      .notNull()
      .references(() => user.id),
    mutationId: uuid("mutation_id"),
  },
  (t) => [
    tenantKey("expense", t),
    foreignKey({
      name: "expense_project_fk",
      columns: [t.workspaceId, t.projectId],
      foreignColumns: [project.workspaceId, project.id],
    }),
    foreignKey({
      name: "expense_stage_fk",
      columns: [t.workspaceId, t.stageId],
      foreignColumns: [stage.workspaceId, stage.id],
    }),
    foreignKey({
      name: "expense_category_fk",
      columns: [t.workspaceId, t.categoryId],
      foreignColumns: [expenseCategory.workspaceId, expenseCategory.id],
    }),
    foreignKey({
      name: "expense_crew_member_fk",
      columns: [t.workspaceId, t.crewMemberId],
      foreignColumns: [crewMember.workspaceId, crewMember.id],
    }),
    foreignKey({
      name: "expense_receipt_file_fk",
      columns: [t.workspaceId, t.receiptFileId],
      foreignColumns: [file.workspaceId, file.id],
    }),
    foreignKey({
      name: "expense_reimbursed_in_pay_run_fk",
      columns: [t.workspaceId, t.reimbursedInPayRunId],
      foreignColumns: [payRun.workspaceId, payRun.id],
    }),
    centsInRange("expense_amount_ex_gst_cents_range", t.amountExGstCents),
    centsInRange("expense_gst_cents_range", t.gstCents),
    check("expense_crew_paid", sql`(${t.paidBy} = 'crew') = (${t.crewMemberId} is not null)`),
    check("expense_reimbursed_crew_paid", sql`${t.reimbursedInPayRunId} is null or ${t.paidBy} = 'crew'`),
    index("expense_workspace_id_date_idx").on(t.workspaceId, t.date),
    index("expense_workspace_id_stage_id_idx").on(t.workspaceId, t.stageId),
    index("expense_workspace_id_project_id_idx").on(t.workspaceId, t.projectId),
    index("expense_workspace_id_category_id_idx").on(t.workspaceId, t.categoryId),
    index("expense_workspace_id_crew_member_id_idx").on(t.workspaceId, t.crewMemberId),
    index("expense_workspace_id_receipt_file_id_idx").on(t.workspaceId, t.receiptFileId),
    index("expense_workspace_id_reimbursed_in_pay_run_id_idx").on(t.workspaceId, t.reimbursedInPayRunId),
    index("expense_entered_by_idx").on(t.enteredBy),
  ],
);

/** Frozen at approval. `ref_id` is the work log (log) or expense (reimbursement); null for gst. */
export const payRunLine = pgTable(
  "pay_run_line",
  {
    ...tenantColumns(),
    payRunId: uuid("pay_run_id").notNull(),
    crewMemberId: uuid("crew_member_id").notNull(),
    kind: payRunLineKindEnum("kind").notNull(),
    refId: uuid("ref_id"),
    snapshot: jsonb("snapshot").notNull(),
    amountCents: cents("amount_cents").notNull(),
  },
  (t) => [
    tenantKey("pay_run_line", t),
    foreignKey({
      name: "pay_run_line_pay_run_fk",
      columns: [t.workspaceId, t.payRunId],
      foreignColumns: [payRun.workspaceId, payRun.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "pay_run_line_crew_member_fk",
      columns: [t.workspaceId, t.crewMemberId],
      foreignColumns: [crewMember.workspaceId, crewMember.id],
    }),
    signedCentsInRange("pay_run_line_amount_cents_range", t.amountCents),
    check("pay_run_line_ref", sql`(${t.kind} = 'gst') = (${t.refId} is null)`),
    index("pay_run_line_workspace_id_pay_run_id_idx").on(t.workspaceId, t.payRunId),
    index("pay_run_line_workspace_id_crew_member_id_idx").on(t.workspaceId, t.crewMemberId),
  ],
);

/** The crew ledger. `kind` decides the sign; only a pay-run credit may be negative (reversals). */
export const ledgerEntry = pgTable(
  "ledger_entry",
  {
    ...tenantColumns(),
    crewMemberId: uuid("crew_member_id").notNull(),
    date: localDate("date").notNull(),
    kind: ledgerKindEnum("kind").notNull(),
    amountCents: cents("amount_cents").notNull(),
    method: payoutMethodEnum("method"),
    note: text("note"),
    payRunId: uuid("pay_run_id"),
  },
  (t) => [
    tenantKey("ledger_entry", t),
    foreignKey({
      name: "ledger_entry_crew_member_fk",
      columns: [t.workspaceId, t.crewMemberId],
      foreignColumns: [crewMember.workspaceId, crewMember.id],
    }),
    foreignKey({
      name: "ledger_entry_pay_run_fk",
      columns: [t.workspaceId, t.payRunId],
      foreignColumns: [payRun.workspaceId, payRun.id],
    }),
    signedCentsInRange("ledger_entry_amount_cents_range", t.amountCents),
    check("ledger_entry_amount_sign", sql`${t.amountCents} >= 0 or ${t.kind} = 'payrun_credit'`),
    index("ledger_entry_workspace_id_crew_member_id_date_idx").on(t.workspaceId, t.crewMemberId, t.date),
    index("ledger_entry_workspace_id_pay_run_id_idx").on(t.workspaceId, t.payRunId),
  ],
);

/** A public read-only statement page. Only the sha256 of the token is stored. */
export const statementLink = pgTable(
  "statement_link",
  {
    ...tenantColumns(),
    payRunId: uuid("pay_run_id").notNull(),
    crewMemberId: uuid("crew_member_id").notNull(),
    tokenHash: text("token_hash").notNull().unique("statement_link_token_hash_key"),
    expiresAt: timestamptz("expires_at").notNull(),
    revokedAt: timestamptz("revoked_at"),
  },
  (t) => [
    tenantKey("statement_link", t),
    foreignKey({
      name: "statement_link_pay_run_fk",
      columns: [t.workspaceId, t.payRunId],
      foreignColumns: [payRun.workspaceId, payRun.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "statement_link_crew_member_fk",
      columns: [t.workspaceId, t.crewMemberId],
      foreignColumns: [crewMember.workspaceId, crewMember.id],
    }),
    index("statement_link_workspace_id_pay_run_id_idx").on(t.workspaceId, t.payRunId),
    index("statement_link_workspace_id_crew_member_id_idx").on(t.workspaceId, t.crewMemberId),
  ],
);
