// The audit trail (plan 04-db-auth Task 5). Migration 0004_audit attaches one AFTER INSERT OR
// UPDATE OR DELETE trigger per AUDITED_TABLES entry; each writes one audit_event row with the
// row's before/after JSON and app.user_id. tests/integration/audit.int.test.ts checks the
// catalogue against both lists below exactly.

/** Tables whose every insert, update and delete writes an audit_event row. */
export const AUDITED_TABLES = [
  "workspace",
  "member",
  "crew_level",
  "crew_member",
  "rate",
  "project",
  "stage",
  "stage_completion_share",
  "progress_entry",
  "progress_share",
  "work_log",
  "no_work",
  "expense",
  "pay_run",
  "pay_run_line",
  "ledger_entry",
  "statement_link",
] as const;

export type AuditedTable = (typeof AUDITED_TABLES)[number];

/**
 * Secret columns left out of audit_event before/after. The migration passes each table's list as
 * its trigger's arguments, so the SQL holds no second copy; the catalogue test reads the trigger
 * arguments back and compares them to this map exactly.
 */
export const AUDIT_SECRET_COLUMNS: Partial<Record<AuditedTable, readonly string[]>> = {
  statement_link: ["token_hash"],
};
