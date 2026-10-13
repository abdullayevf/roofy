// Which tables are tenant-scoped and which belong to Better Auth alone.
// Task 4 enables and forces RLS on every TENANT_TABLES entry; tenancy.test.ts keeps both lists in
// sync with the Drizzle schema.

/** Better Auth tables: no workspace_id, no RLS, reachable only by roofy_auth. */
export const AUTH_TABLES: readonly string[] = [
  "user",
  "session",
  "account",
  "verification",
  "two_factor",
  "rate_limit",
];

/** Every table under RLS. `workspace` matches on its own id; the rest carry workspace_id. */
export const TENANT_TABLES: readonly string[] = [
  "workspace",
  "member",
  "invitation",
  "client",
  "project",
  "project_assignment",
  "stage_template",
  "stage_template_item",
  "stage",
  "stage_segment",
  "crew_level",
  "crew_member",
  "rate",
  "stage_completion_share",
  "progress_entry",
  "progress_share",
  "work_log",
  "no_work",
  "expense_category",
  "expense",
  "pay_run",
  "pay_run_line",
  "ledger_entry",
  "statement_link",
  "file",
  "client_mutation",
  "audit_event",
];
