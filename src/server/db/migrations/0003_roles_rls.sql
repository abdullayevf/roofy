-- Task 4: database roles, grants and row-level security (hand-written; plan 04-db-auth Task 4).
-- roofy owns every table and runs migrations. roofy_app serves every service query and roofy_auth
-- serves only Better Auth; neither owns a table or bypasses RLS. pnpm db:roles sets LOGIN and the
-- passwords from .env. The table lists below match TENANT_TABLES and AUTH_TABLES in tenancy.ts;
-- tests/integration/rls.int.test.ts checks the catalogue against those lists exactly.
DO $$ BEGIN
  CREATE ROLE roofy_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL;
END $$;
DO $$ BEGIN
  CREATE ROLE roofy_auth NOLOGIN NOSUPERUSER NOBYPASSRLS;
EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL;
END $$;
GRANT USAGE ON SCHEMA public TO roofy_app, roofy_auth;

-- Better Auth tables: roofy_auth only. No workspace_id, so no RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON "user" TO roofy_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON "session" TO roofy_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON "account" TO roofy_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON "verification" TO roofy_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON "two_factor" TO roofy_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON "rate_limit" TO roofy_auth;

-- Tenant tables: roofy_app reads and writes them, except audit_event, which it may only read
-- (its rows come from the Task 5 audit trigger). RLS is enabled and forced on every one, and the
-- one roofy_app policy matches the transaction-local app.workspace_id that withActor sets; with
-- no actor set (a reused pooled connection) the setting is empty, nullif gives NULL and no row
-- matches. workspace is its own tenant key, so its policy matches on id.

GRANT SELECT, INSERT, UPDATE, DELETE ON "workspace" TO roofy_app;
ALTER TABLE "workspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace" FORCE ROW LEVEL SECURITY;
CREATE POLICY "workspace_workspace" ON "workspace" FOR ALL TO roofy_app USING ("id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "member" TO roofy_app;
ALTER TABLE "member" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member" FORCE ROW LEVEL SECURITY;
CREATE POLICY "member_workspace" ON "member" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "invitation" TO roofy_app;
ALTER TABLE "invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitation" FORCE ROW LEVEL SECURITY;
CREATE POLICY "invitation_workspace" ON "invitation" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "client" TO roofy_app;
ALTER TABLE "client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client" FORCE ROW LEVEL SECURITY;
CREATE POLICY "client_workspace" ON "client" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "project" TO roofy_app;
ALTER TABLE "project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project" FORCE ROW LEVEL SECURITY;
CREATE POLICY "project_workspace" ON "project" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "project_assignment" TO roofy_app;
ALTER TABLE "project_assignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_assignment" FORCE ROW LEVEL SECURITY;
CREATE POLICY "project_assignment_workspace" ON "project_assignment" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "stage_template" TO roofy_app;
ALTER TABLE "stage_template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stage_template" FORCE ROW LEVEL SECURITY;
CREATE POLICY "stage_template_workspace" ON "stage_template" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "stage_template_item" TO roofy_app;
ALTER TABLE "stage_template_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stage_template_item" FORCE ROW LEVEL SECURITY;
CREATE POLICY "stage_template_item_workspace" ON "stage_template_item" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "stage" TO roofy_app;
ALTER TABLE "stage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stage" FORCE ROW LEVEL SECURITY;
CREATE POLICY "stage_workspace" ON "stage" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "stage_segment" TO roofy_app;
ALTER TABLE "stage_segment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stage_segment" FORCE ROW LEVEL SECURITY;
CREATE POLICY "stage_segment_workspace" ON "stage_segment" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "crew_level" TO roofy_app;
ALTER TABLE "crew_level" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crew_level" FORCE ROW LEVEL SECURITY;
CREATE POLICY "crew_level_workspace" ON "crew_level" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "crew_member" TO roofy_app;
ALTER TABLE "crew_member" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crew_member" FORCE ROW LEVEL SECURITY;
CREATE POLICY "crew_member_workspace" ON "crew_member" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "rate" TO roofy_app;
ALTER TABLE "rate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rate" FORCE ROW LEVEL SECURITY;
CREATE POLICY "rate_workspace" ON "rate" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "stage_completion_share" TO roofy_app;
ALTER TABLE "stage_completion_share" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stage_completion_share" FORCE ROW LEVEL SECURITY;
CREATE POLICY "stage_completion_share_workspace" ON "stage_completion_share" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "progress_entry" TO roofy_app;
ALTER TABLE "progress_entry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "progress_entry" FORCE ROW LEVEL SECURITY;
CREATE POLICY "progress_entry_workspace" ON "progress_entry" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "progress_share" TO roofy_app;
ALTER TABLE "progress_share" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "progress_share" FORCE ROW LEVEL SECURITY;
CREATE POLICY "progress_share_workspace" ON "progress_share" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "work_log" TO roofy_app;
ALTER TABLE "work_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_log" FORCE ROW LEVEL SECURITY;
CREATE POLICY "work_log_workspace" ON "work_log" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "no_work" TO roofy_app;
ALTER TABLE "no_work" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "no_work" FORCE ROW LEVEL SECURITY;
CREATE POLICY "no_work_workspace" ON "no_work" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "expense_category" TO roofy_app;
ALTER TABLE "expense_category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expense_category" FORCE ROW LEVEL SECURITY;
CREATE POLICY "expense_category_workspace" ON "expense_category" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "expense" TO roofy_app;
ALTER TABLE "expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expense" FORCE ROW LEVEL SECURITY;
CREATE POLICY "expense_workspace" ON "expense" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "pay_run" TO roofy_app;
ALTER TABLE "pay_run" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pay_run" FORCE ROW LEVEL SECURITY;
CREATE POLICY "pay_run_workspace" ON "pay_run" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "pay_run_line" TO roofy_app;
ALTER TABLE "pay_run_line" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pay_run_line" FORCE ROW LEVEL SECURITY;
CREATE POLICY "pay_run_line_workspace" ON "pay_run_line" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "ledger_entry" TO roofy_app;
ALTER TABLE "ledger_entry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ledger_entry" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ledger_entry_workspace" ON "ledger_entry" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "statement_link" TO roofy_app;
ALTER TABLE "statement_link" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "statement_link" FORCE ROW LEVEL SECURITY;
CREATE POLICY "statement_link_workspace" ON "statement_link" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "file" TO roofy_app;
ALTER TABLE "file" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "file" FORCE ROW LEVEL SECURITY;
CREATE POLICY "file_workspace" ON "file" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "client_mutation" TO roofy_app;
ALTER TABLE "client_mutation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client_mutation" FORCE ROW LEVEL SECURITY;
CREATE POLICY "client_mutation_workspace" ON "client_mutation" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

GRANT SELECT ON "audit_event" TO roofy_app;
ALTER TABLE "audit_event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_event" FORCE ROW LEVEL SECURITY;
CREATE POLICY "audit_event_workspace" ON "audit_event" FOR ALL TO roofy_app USING ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid) WITH CHECK ("workspace_id" = nullif(current_setting('app.workspace_id', true), '')::uuid);

-- Better Auth (roofy_auth) also manages workspace, member and invitation through its organization
-- plugin. Its own queries carry no workspace (sign-up creates the workspace; listing a user's
-- workspaces and accepting an invitation span workspaces), so withActor cannot set one: these
-- three policies are USING (true) on purpose. roofy_auth has no grant on any other tenant table.
GRANT SELECT, INSERT, UPDATE, DELETE ON "workspace" TO roofy_auth;
CREATE POLICY "workspace_auth" ON "workspace" FOR ALL TO roofy_auth USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON "member" TO roofy_auth;
CREATE POLICY "member_auth" ON "member" FOR ALL TO roofy_auth USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON "invitation" TO roofy_auth;
CREATE POLICY "invitation_auth" ON "invitation" FOR ALL TO roofy_auth USING (true) WITH CHECK (true);
