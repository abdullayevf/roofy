CREATE TYPE "public"."audit_action" AS ENUM('insert', 'update', 'delete');--> statement-breakpoint
CREATE TYPE "public"."file_entity_type" AS ENUM('project', 'expense', 'progress_entry', 'stage');--> statement-breakpoint
CREATE TYPE "public"."mutation_type" AS ENUM('crew_day', 'progress', 'no_work', 'stage_pause', 'stage_resume', 'expense');--> statement-breakpoint
CREATE TYPE "public"."ledger_kind" AS ENUM('payrun_credit', 'advance', 'payment');--> statement-breakpoint
CREATE TYPE "public"."paid_by" AS ENUM('company_card', 'cash', 'crew');--> statement-breakpoint
CREATE TYPE "public"."pay_run_line_kind" AS ENUM('log', 'reimbursement', 'gst');--> statement-breakpoint
CREATE TYPE "public"."pay_run_status" AS ENUM('draft', 'approved', 'exported');--> statement-breakpoint
CREATE TYPE "public"."payout_method" AS ENUM('bank_transfer', 'cash', 'other');--> statement-breakpoint
CREATE TYPE "public"."log_source" AS ENUM('grid', 'progress', 'lump_sum', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."no_work_reason" AS ENUM('rain', 'leave', 'sick', 'other');--> statement-breakpoint
CREATE TYPE "public"."work_basis" AS ENUM('hourly', 'daily', 'per_unit', 'lump_sum', 'time_only');--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"table_name" text NOT NULL,
	"row_id" uuid NOT NULL,
	"action" "audit_action" NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"actor_user_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_event_workspace_id_id_key" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "client_mutation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "mutation_type" NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"result" jsonb,
	CONSTRAINT "client_mutation_workspace_id_id_key" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "file" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"storage_key" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" bigint NOT NULL,
	"sha256" text NOT NULL,
	"entity_type" "file_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	CONSTRAINT "file_storage_key_key" UNIQUE("storage_key"),
	CONSTRAINT "file_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "file_bytes_range" CHECK ("file"."bytes" between 0 and 9007199254740991),
	CONSTRAINT "file_sha256_hex" CHECK ("file"."sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "expense" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"project_id" uuid NOT NULL,
	"stage_id" uuid,
	"category_id" uuid NOT NULL,
	"supplier" text NOT NULL,
	"date" date NOT NULL,
	"amount_ex_gst_cents" bigint NOT NULL,
	"gst_cents" bigint NOT NULL,
	"paid_by" "paid_by" NOT NULL,
	"crew_member_id" uuid,
	"receipt_file_id" uuid,
	"reimbursed_in_pay_run_id" uuid,
	"entered_by" uuid NOT NULL,
	"mutation_id" uuid,
	CONSTRAINT "expense_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "expense_amount_ex_gst_cents_range" CHECK ("expense"."amount_ex_gst_cents" between 0 and 9007199254740991),
	CONSTRAINT "expense_gst_cents_range" CHECK ("expense"."gst_cents" between 0 and 9007199254740991),
	CONSTRAINT "expense_crew_paid" CHECK (("expense"."paid_by" = 'crew') = ("expense"."crew_member_id" is not null)),
	CONSTRAINT "expense_reimbursed_crew_paid" CHECK ("expense"."reimbursed_in_pay_run_id" is null or "expense"."paid_by" = 'crew')
);
--> statement-breakpoint
CREATE TABLE "expense_category" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "expense_category_workspace_id_id_key" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "ledger_entry" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"crew_member_id" uuid NOT NULL,
	"date" date NOT NULL,
	"kind" "ledger_kind" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"method" "payout_method",
	"note" text,
	"pay_run_id" uuid,
	CONSTRAINT "ledger_entry_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "ledger_entry_amount_cents_range" CHECK ("ledger_entry"."amount_cents" between -9007199254740991 and 9007199254740991),
	CONSTRAINT "ledger_entry_amount_sign" CHECK ("ledger_entry"."amount_cents" >= 0 or "ledger_entry"."kind" = 'payrun_credit')
);
--> statement-breakpoint
CREATE TABLE "pay_run" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" "pay_run_status" DEFAULT 'draft' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"exported_at" timestamp with time zone,
	CONSTRAINT "pay_run_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "pay_run_workspace_id_period_key" UNIQUE("workspace_id","period_start","period_end"),
	CONSTRAINT "pay_run_period_range" CHECK ("pay_run"."period_end" >= "pay_run"."period_start")
);
--> statement-breakpoint
CREATE TABLE "pay_run_line" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pay_run_id" uuid NOT NULL,
	"crew_member_id" uuid NOT NULL,
	"kind" "pay_run_line_kind" NOT NULL,
	"ref_id" uuid,
	"snapshot" jsonb NOT NULL,
	"amount_cents" bigint NOT NULL,
	CONSTRAINT "pay_run_line_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "pay_run_line_amount_cents_range" CHECK ("pay_run_line"."amount_cents" between -9007199254740991 and 9007199254740991),
	CONSTRAINT "pay_run_line_ref" CHECK (("pay_run_line"."kind" = 'gst') = ("pay_run_line"."ref_id" is null))
);
--> statement-breakpoint
CREATE TABLE "statement_link" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pay_run_id" uuid NOT NULL,
	"crew_member_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "statement_link_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "statement_link_workspace_id_id_key" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "no_work" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"crew_member_id" uuid NOT NULL,
	"date" date NOT NULL,
	"reason" "no_work_reason" NOT NULL,
	"note" text,
	"entered_by" uuid NOT NULL,
	"mutation_id" uuid,
	CONSTRAINT "no_work_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "no_work_workspace_id_crew_member_id_date_key" UNIQUE("workspace_id","crew_member_id","date")
);
--> statement-breakpoint
CREATE TABLE "progress_entry" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_id" uuid NOT NULL,
	"date" date NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"entered_by" uuid NOT NULL,
	"photo_file_id" uuid,
	"mutation_id" uuid,
	CONSTRAINT "progress_entry_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "progress_entry_quantity_range" CHECK ("progress_entry"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "progress_share" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"progress_entry_id" uuid NOT NULL,
	"crew_member_id" uuid NOT NULL,
	"share_bp" integer NOT NULL,
	CONSTRAINT "progress_share_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "progress_share_entry_crew_key" UNIQUE("workspace_id","progress_entry_id","crew_member_id"),
	CONSTRAINT "progress_share_share_bp_range" CHECK ("progress_share"."share_bp" between 0 and 10000)
);
--> statement-breakpoint
CREATE TABLE "work_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"date" date NOT NULL,
	"crew_member_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"basis" "work_basis" NOT NULL,
	"unit" "unit",
	"quantity" numeric(12, 2) NOT NULL,
	"hours" numeric(12, 2) NOT NULL,
	"multiplier" numeric(12, 2),
	"rate_cents" bigint,
	"amount_cents" bigint NOT NULL,
	"source" "log_source" NOT NULL,
	"entry_id" uuid NOT NULL,
	"adjusts_log_id" uuid,
	"progress_entry_id" uuid,
	"pay_run_id" uuid,
	"entered_by" uuid NOT NULL,
	"mutation_id" uuid,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "work_log_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "work_log_amount_cents_range" CHECK ("work_log"."amount_cents" between -9007199254740991 and 9007199254740991),
	CONSTRAINT "work_log_rate_cents_range" CHECK ("work_log"."rate_cents" between 0 and 9007199254740991),
	CONSTRAINT "work_log_non_negative" CHECK ("work_log"."source" = 'adjustment' or ("work_log"."quantity" >= 0 and "work_log"."hours" >= 0 and "work_log"."amount_cents" >= 0)),
	CONSTRAINT "work_log_multiplier_range" CHECK ("work_log"."multiplier" is null or "work_log"."multiplier" > 0),
	CONSTRAINT "work_log_per_unit_has_unit" CHECK ("work_log"."basis" <> 'per_unit' or "work_log"."unit" is not null),
	CONSTRAINT "work_log_adjusts_only_adjustment" CHECK ("work_log"."adjusts_log_id" is null or "work_log"."source" = 'adjustment')
);
--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_mutation" ADD CONSTRAINT "client_mutation_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_mutation" ADD CONSTRAINT "client_mutation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_entered_by_user_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."project"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_stage_fk" FOREIGN KEY ("workspace_id","stage_id") REFERENCES "public"."stage"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_category_fk" FOREIGN KEY ("workspace_id","category_id") REFERENCES "public"."expense_category"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_crew_member_fk" FOREIGN KEY ("workspace_id","crew_member_id") REFERENCES "public"."crew_member"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_receipt_file_fk" FOREIGN KEY ("workspace_id","receipt_file_id") REFERENCES "public"."file"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_reimbursed_in_pay_run_fk" FOREIGN KEY ("workspace_id","reimbursed_in_pay_run_id") REFERENCES "public"."pay_run"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_category" ADD CONSTRAINT "expense_category_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_crew_member_fk" FOREIGN KEY ("workspace_id","crew_member_id") REFERENCES "public"."crew_member"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_pay_run_fk" FOREIGN KEY ("workspace_id","pay_run_id") REFERENCES "public"."pay_run"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_run" ADD CONSTRAINT "pay_run_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_run" ADD CONSTRAINT "pay_run_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_run_line" ADD CONSTRAINT "pay_run_line_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_run_line" ADD CONSTRAINT "pay_run_line_pay_run_fk" FOREIGN KEY ("workspace_id","pay_run_id") REFERENCES "public"."pay_run"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_run_line" ADD CONSTRAINT "pay_run_line_crew_member_fk" FOREIGN KEY ("workspace_id","crew_member_id") REFERENCES "public"."crew_member"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_link" ADD CONSTRAINT "statement_link_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_link" ADD CONSTRAINT "statement_link_pay_run_fk" FOREIGN KEY ("workspace_id","pay_run_id") REFERENCES "public"."pay_run"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_link" ADD CONSTRAINT "statement_link_crew_member_fk" FOREIGN KEY ("workspace_id","crew_member_id") REFERENCES "public"."crew_member"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "no_work" ADD CONSTRAINT "no_work_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "no_work" ADD CONSTRAINT "no_work_entered_by_user_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "no_work" ADD CONSTRAINT "no_work_crew_member_fk" FOREIGN KEY ("workspace_id","crew_member_id") REFERENCES "public"."crew_member"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_entry" ADD CONSTRAINT "progress_entry_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_entry" ADD CONSTRAINT "progress_entry_entered_by_user_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_entry" ADD CONSTRAINT "progress_entry_stage_fk" FOREIGN KEY ("workspace_id","stage_id") REFERENCES "public"."stage"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_entry" ADD CONSTRAINT "progress_entry_photo_file_fk" FOREIGN KEY ("workspace_id","photo_file_id") REFERENCES "public"."file"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_share" ADD CONSTRAINT "progress_share_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_share" ADD CONSTRAINT "progress_share_progress_entry_fk" FOREIGN KEY ("workspace_id","progress_entry_id") REFERENCES "public"."progress_entry"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_share" ADD CONSTRAINT "progress_share_crew_member_fk" FOREIGN KEY ("workspace_id","crew_member_id") REFERENCES "public"."crew_member"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_log" ADD CONSTRAINT "work_log_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_log" ADD CONSTRAINT "work_log_entered_by_user_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_log" ADD CONSTRAINT "work_log_crew_member_fk" FOREIGN KEY ("workspace_id","crew_member_id") REFERENCES "public"."crew_member"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_log" ADD CONSTRAINT "work_log_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."project"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_log" ADD CONSTRAINT "work_log_stage_fk" FOREIGN KEY ("workspace_id","stage_id") REFERENCES "public"."stage"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_log" ADD CONSTRAINT "work_log_adjusts_log_fk" FOREIGN KEY ("workspace_id","adjusts_log_id") REFERENCES "public"."work_log"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_log" ADD CONSTRAINT "work_log_progress_entry_fk" FOREIGN KEY ("workspace_id","progress_entry_id") REFERENCES "public"."progress_entry"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_log" ADD CONSTRAINT "work_log_pay_run_fk" FOREIGN KEY ("workspace_id","pay_run_id") REFERENCES "public"."pay_run"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_event_workspace_id_table_row_idx" ON "audit_event" USING btree ("workspace_id","table_name","row_id");--> statement-breakpoint
CREATE INDEX "audit_event_workspace_id_at_idx" ON "audit_event" USING btree ("workspace_id","at");--> statement-breakpoint
CREATE INDEX "client_mutation_user_id_idx" ON "client_mutation" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "client_mutation_workspace_id_received_at_idx" ON "client_mutation" USING btree ("workspace_id","received_at");--> statement-breakpoint
CREATE INDEX "file_workspace_id_entity_idx" ON "file" USING btree ("workspace_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "expense_workspace_id_date_idx" ON "expense" USING btree ("workspace_id","date");--> statement-breakpoint
CREATE INDEX "expense_workspace_id_stage_id_idx" ON "expense" USING btree ("workspace_id","stage_id");--> statement-breakpoint
CREATE INDEX "expense_workspace_id_project_id_idx" ON "expense" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "expense_workspace_id_category_id_idx" ON "expense" USING btree ("workspace_id","category_id");--> statement-breakpoint
CREATE INDEX "expense_workspace_id_crew_member_id_idx" ON "expense" USING btree ("workspace_id","crew_member_id");--> statement-breakpoint
CREATE INDEX "expense_workspace_id_receipt_file_id_idx" ON "expense" USING btree ("workspace_id","receipt_file_id");--> statement-breakpoint
CREATE INDEX "expense_workspace_id_reimbursed_in_pay_run_id_idx" ON "expense" USING btree ("workspace_id","reimbursed_in_pay_run_id");--> statement-breakpoint
CREATE INDEX "expense_entered_by_idx" ON "expense" USING btree ("entered_by");--> statement-breakpoint
CREATE INDEX "ledger_entry_workspace_id_crew_member_id_date_idx" ON "ledger_entry" USING btree ("workspace_id","crew_member_id","date");--> statement-breakpoint
CREATE INDEX "ledger_entry_workspace_id_pay_run_id_idx" ON "ledger_entry" USING btree ("workspace_id","pay_run_id");--> statement-breakpoint
CREATE INDEX "pay_run_approved_by_idx" ON "pay_run" USING btree ("approved_by");--> statement-breakpoint
CREATE INDEX "pay_run_line_workspace_id_pay_run_id_idx" ON "pay_run_line" USING btree ("workspace_id","pay_run_id");--> statement-breakpoint
CREATE INDEX "pay_run_line_workspace_id_crew_member_id_idx" ON "pay_run_line" USING btree ("workspace_id","crew_member_id");--> statement-breakpoint
CREATE INDEX "statement_link_workspace_id_pay_run_id_idx" ON "statement_link" USING btree ("workspace_id","pay_run_id");--> statement-breakpoint
CREATE INDEX "statement_link_workspace_id_crew_member_id_idx" ON "statement_link" USING btree ("workspace_id","crew_member_id");--> statement-breakpoint
CREATE INDEX "no_work_workspace_id_date_idx" ON "no_work" USING btree ("workspace_id","date");--> statement-breakpoint
CREATE INDEX "no_work_entered_by_idx" ON "no_work" USING btree ("entered_by");--> statement-breakpoint
CREATE INDEX "progress_entry_workspace_id_date_idx" ON "progress_entry" USING btree ("workspace_id","date");--> statement-breakpoint
CREATE INDEX "progress_entry_workspace_id_stage_id_idx" ON "progress_entry" USING btree ("workspace_id","stage_id");--> statement-breakpoint
CREATE INDEX "progress_entry_workspace_id_photo_file_id_idx" ON "progress_entry" USING btree ("workspace_id","photo_file_id");--> statement-breakpoint
CREATE INDEX "progress_entry_entered_by_idx" ON "progress_entry" USING btree ("entered_by");--> statement-breakpoint
CREATE INDEX "progress_share_workspace_id_crew_member_id_idx" ON "progress_share" USING btree ("workspace_id","crew_member_id");--> statement-breakpoint
CREATE INDEX "work_log_workspace_id_date_idx" ON "work_log" USING btree ("workspace_id","date");--> statement-breakpoint
CREATE INDEX "work_log_workspace_id_stage_id_idx" ON "work_log" USING btree ("workspace_id","stage_id");--> statement-breakpoint
CREATE INDEX "work_log_workspace_id_crew_member_id_date_idx" ON "work_log" USING btree ("workspace_id","crew_member_id","date");--> statement-breakpoint
CREATE INDEX "work_log_workspace_id_pay_run_id_idx" ON "work_log" USING btree ("workspace_id","pay_run_id");--> statement-breakpoint
CREATE INDEX "work_log_workspace_id_project_id_idx" ON "work_log" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "work_log_workspace_id_adjusts_log_id_idx" ON "work_log" USING btree ("workspace_id","adjusts_log_id");--> statement-breakpoint
CREATE INDEX "work_log_workspace_id_progress_entry_id_idx" ON "work_log" USING btree ("workspace_id","progress_entry_id");--> statement-breakpoint
CREATE INDEX "work_log_entered_by_idx" ON "work_log" USING btree ("entered_by");