CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'rejected', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."onboarding_step" AS ENUM('business', 'trade', 'defaults', 'crew', 'install', 'done');--> statement-breakpoint
CREATE TYPE "public"."pay_frequency" AS ENUM('weekly', 'fortnightly');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'manager', 'foreman', 'accountant');--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('metal_reroof', 'tile_reroof', 'restoration', 'repair', 'new_build');--> statement-breakpoint
CREATE TYPE "public"."pause_reason" AS ENUM('weather', 'materials', 'client', 'other_job', 'other');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('quoted', 'active', 'on_hold', 'complete', 'closed');--> statement-breakpoint
CREATE TYPE "public"."stage_status" AS ENUM('not_started', 'active', 'paused', 'done');--> statement-breakpoint
CREATE TYPE "public"."unit" AS ENUM('m2', 'lm', 'each');--> statement-breakpoint
CREATE TYPE "public"."rate_basis" AS ENUM('hourly', 'daily', 'per_unit');--> statement-breakpoint
CREATE TYPE "public"."worker_type" AS ENUM('employee', 'contractor');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"active_workspace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" uuid PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" uuid NOT NULL,
	"verified" boolean DEFAULT true NOT NULL,
	"failed_verification_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"role" "member_role" NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"inviter_id" uuid NOT NULL,
	CONSTRAINT "invitation_workspace_id_id_key" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	CONSTRAINT "member_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "member_workspace_id_user_id_key" UNIQUE("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"logo" text,
	"metadata" text,
	"abn" text,
	"gst_registered" boolean DEFAULT false NOT NULL,
	"timezone" text DEFAULT 'Australia/Sydney' NOT NULL,
	"pay_period" "pay_frequency" DEFAULT 'weekly' NOT NULL,
	"pay_week_start" smallint DEFAULT 1 NOT NULL,
	"pay_anchor" date,
	"working_days" smallint[] DEFAULT '{1,2,3,4,5}'::smallint[] NOT NULL,
	"standard_day_hours" numeric(12, 2) DEFAULT '8.00' NOT NULL,
	"on_cost_bp" integer DEFAULT 0 NOT NULL,
	"trade" text,
	"onboarding_step" "onboarding_step" DEFAULT 'business' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_slug_unique" UNIQUE("slug"),
	CONSTRAINT "workspace_pay_week_start_range" CHECK ("workspace"."pay_week_start" between 0 and 6),
	CONSTRAINT "workspace_working_days_range" CHECK ("workspace"."working_days" <@ '{0,1,2,3,4,5,6}'::smallint[]),
	CONSTRAINT "workspace_on_cost_bp_range" CHECK ("workspace"."on_cost_bp" >= 0),
	CONSTRAINT "workspace_standard_day_hours_range" CHECK ("workspace"."standard_day_hours" > 0 and "workspace"."standard_day_hours" <= 24),
	CONSTRAINT "workspace_trade_known" CHECK ("workspace"."trade" is null or "workspace"."trade" = 'roofing')
);
--> statement-breakpoint
CREATE TABLE "client" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	CONSTRAINT "client_workspace_id_id_key" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_id" uuid,
	"site_address" text NOT NULL,
	"nickname" text,
	"job_type" "job_type" NOT NULL,
	"contract_value_cents" bigint,
	"status" "project_status" DEFAULT 'quoted' NOT NULL,
	"start_date" date,
	"target_finish" date,
	CONSTRAINT "project_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "project_contract_value_cents_range" CHECK ("project"."contract_value_cents" between 0 and 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "project_assignment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"member_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	CONSTRAINT "project_assignment_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "project_assignment_member_project_key" UNIQUE("workspace_id","member_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "stage" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"status" "stage_status" DEFAULT 'not_started' NOT NULL,
	"unit" "unit",
	"budget_qty" numeric(12, 2),
	"labour_budget_cents" bigint,
	"materials_budget_cents" bigint,
	"lump_sum_cents" bigint,
	"manual_pct_bp" integer,
	"completed_on" date,
	CONSTRAINT "stage_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "stage_labour_budget_cents_range" CHECK ("stage"."labour_budget_cents" between 0 and 9007199254740991),
	CONSTRAINT "stage_materials_budget_cents_range" CHECK ("stage"."materials_budget_cents" between 0 and 9007199254740991),
	CONSTRAINT "stage_lump_sum_cents_range" CHECK ("stage"."lump_sum_cents" between 0 and 9007199254740991),
	CONSTRAINT "stage_manual_pct_bp_range" CHECK ("stage"."manual_pct_bp" between 0 and 10000),
	CONSTRAINT "stage_budget_qty_range" CHECK ("stage"."budget_qty" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stage_segment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"pause_reason" "pause_reason",
	"pause_note" text,
	CONSTRAINT "stage_segment_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "stage_segment_end_after_start" CHECK ("stage_segment"."end_date" is null or "stage_segment"."end_date" >= "stage_segment"."start_date")
);
--> statement-breakpoint
CREATE TABLE "stage_template" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"job_type" "job_type" NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "stage_template_workspace_id_id_key" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "stage_template_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"template_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"default_unit" "unit",
	"labour_share_bp" integer DEFAULT 0 NOT NULL,
	"materials_share_bp" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "stage_template_item_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "stage_template_item_labour_share_bp_range" CHECK ("stage_template_item"."labour_share_bp" between 0 and 10000),
	CONSTRAINT "stage_template_item_materials_share_bp_range" CHECK ("stage_template_item"."materials_share_bp" between 0 and 10000)
);
--> statement-breakpoint
CREATE TABLE "crew_level" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"floor_rate_cents" bigint NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "crew_level_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "crew_level_floor_rate_cents_range" CHECK ("crew_level"."floor_rate_cents" between 0 and 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "crew_member" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"type" "worker_type" NOT NULL,
	"level_id" uuid,
	"abn" text,
	"gst_registered" boolean DEFAULT false NOT NULL,
	"active_from" date NOT NULL,
	"active_to" date,
	"default_basis" "rate_basis" DEFAULT 'hourly' NOT NULL,
	"default_unit" "unit",
	CONSTRAINT "crew_member_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "crew_member_active_range" CHECK ("crew_member"."active_to" is null or "crew_member"."active_to" >= "crew_member"."active_from")
);
--> statement-breakpoint
CREATE TABLE "rate" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"crew_member_id" uuid NOT NULL,
	"basis" "rate_basis" NOT NULL,
	"unit" "unit",
	"amount_cents" bigint NOT NULL,
	"effective_from" date NOT NULL,
	"project_id" uuid,
	CONSTRAINT "rate_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "rate_crew_basis_unit_project_from_key" UNIQUE NULLS NOT DISTINCT("workspace_id","crew_member_id","basis","unit","project_id","effective_from"),
	CONSTRAINT "rate_amount_cents_range" CHECK ("rate"."amount_cents" between 0 and 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "stage_completion_share" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_id" uuid NOT NULL,
	"crew_member_id" uuid NOT NULL,
	"share_bp" integer NOT NULL,
	CONSTRAINT "stage_completion_share_workspace_id_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "stage_completion_share_stage_crew_key" UNIQUE("workspace_id","stage_id","crew_member_id"),
	CONSTRAINT "stage_completion_share_share_bp_range" CHECK ("stage_completion_share"."share_bp" between 0 and 10000)
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_client_fk" FOREIGN KEY ("workspace_id","client_id") REFERENCES "public"."client"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignment" ADD CONSTRAINT "project_assignment_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignment" ADD CONSTRAINT "project_assignment_member_fk" FOREIGN KEY ("workspace_id","member_id") REFERENCES "public"."member"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignment" ADD CONSTRAINT "project_assignment_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."project"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage" ADD CONSTRAINT "stage_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage" ADD CONSTRAINT "stage_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."project"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_segment" ADD CONSTRAINT "stage_segment_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_segment" ADD CONSTRAINT "stage_segment_stage_fk" FOREIGN KEY ("workspace_id","stage_id") REFERENCES "public"."stage"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_template" ADD CONSTRAINT "stage_template_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_template_item" ADD CONSTRAINT "stage_template_item_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_template_item" ADD CONSTRAINT "stage_template_item_template_fk" FOREIGN KEY ("workspace_id","template_id") REFERENCES "public"."stage_template"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_level" ADD CONSTRAINT "crew_level_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_member" ADD CONSTRAINT "crew_member_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_member" ADD CONSTRAINT "crew_member_level_fk" FOREIGN KEY ("workspace_id","level_id") REFERENCES "public"."crew_level"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate" ADD CONSTRAINT "rate_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate" ADD CONSTRAINT "rate_crew_member_fk" FOREIGN KEY ("workspace_id","crew_member_id") REFERENCES "public"."crew_member"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate" ADD CONSTRAINT "rate_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."project"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_completion_share" ADD CONSTRAINT "stage_completion_share_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_completion_share" ADD CONSTRAINT "stage_completion_share_stage_fk" FOREIGN KEY ("workspace_id","stage_id") REFERENCES "public"."stage"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_completion_share" ADD CONSTRAINT "stage_completion_share_crew_member_fk" FOREIGN KEY ("workspace_id","crew_member_id") REFERENCES "public"."crew_member"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "two_factor_user_id_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_user_id_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_workspace_id_status_idx" ON "project" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "stage_workspace_id_project_id_idx" ON "stage" USING btree ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "stage_segment_workspace_id_stage_id_idx" ON "stage_segment" USING btree ("workspace_id","stage_id");