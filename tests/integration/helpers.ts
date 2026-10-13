import type { Pool } from "pg";
import { v7 as uuidv7 } from "uuid";
import type { Actor } from "../../src/data/contracts";
import { closePools, pool, type DbRole } from "../../src/server/db/client";

export { closePools, pool, type DbRole };

/** Runs a query as the given role and returns the rows. */
export async function rows<T extends object = Record<string, unknown>>(
  role: DbRole,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await (pool(role) as Pool).query<T>(sql, params);
  return result.rows;
}

/**
 * Makes a workspace with one Owner (a user plus an owner member) through the owner pool, which
 * is a superuser and so is not held back by row-level security. Ids are app-made uuid v7.
 */
export async function makeWorkspace(
  name = "Test Roofing",
): Promise<{ workspaceId: string; ownerActor: Actor }> {
  const owner = pool("owner");
  const userId = uuidv7();
  const workspaceId = uuidv7();
  const ownerName = `${name} owner`;
  await owner.query(`insert into "user" (id, name, email) values ($1, $2, $3)`, [
    userId,
    ownerName,
    `owner-${userId}@example.test`,
  ]);
  await owner.query(`insert into workspace (id, name, timezone) values ($1, $2, 'Australia/Sydney')`, [
    workspaceId,
    name,
  ]);
  await owner.query(`insert into member (id, workspace_id, user_id, role) values ($1, $2, $3, 'owner')`, [
    uuidv7(),
    workspaceId,
    userId,
  ]);
  return { workspaceId, ownerActor: { userId, workspaceId, role: "owner", name: ownerName } };
}

// One row per tenant table per workspace, in an order that respects the composite FKs. The keys
// must equal TENANT_TABLES exactly; `workspace` and `member` come from makeWorkspace().
export type Ctx = { user: string; id: Record<string, string> };
export const FROM_MAKE_WORKSPACE = "makeWorkspace" as const;
export const SEED: Record<string, ((c: Ctx) => Record<string, unknown>) | typeof FROM_MAKE_WORKSPACE> = {
  workspace: FROM_MAKE_WORKSPACE,
  member: FROM_MAKE_WORKSPACE,
  invitation: (c) => ({
    email: `invite-${uuidv7()}@example.test`,
    role: "manager",
    expires_at: "2030-01-01T00:00:00Z",
    inviter_id: c.user,
  }),
  client: () => ({ name: "Client" }),
  project: () => ({ site_address: "1 Test St", job_type: "repair" }),
  project_assignment: (c) => ({ member_id: c.id.member, project_id: c.id.project }),
  stage_template: () => ({ job_type: "repair", name: "Template" }),
  stage_template_item: (c) => ({ template_id: c.id.stage_template, name: "Item", position: 1 }),
  stage: (c) => ({ project_id: c.id.project, name: "Stage", position: 1 }),
  stage_segment: (c) => ({ stage_id: c.id.stage, start_date: "2026-09-28" }),
  crew_level: () => ({ name: "Level", floor_rate_cents: 3000 }),
  crew_member: () => ({ name: "Crew", type: "employee", active_from: "2026-01-05" }),
  rate: (c) => ({
    crew_member_id: c.id.crew_member,
    basis: "hourly",
    amount_cents: 4500,
    effective_from: "2026-01-05",
  }),
  stage_completion_share: (c) => ({
    stage_id: c.id.stage,
    crew_member_id: c.id.crew_member,
    share_bp: 10000,
  }),
  progress_entry: (c) => ({
    stage_id: c.id.stage,
    date: "2026-09-28",
    quantity: "12.50",
    entered_by: c.user,
  }),
  progress_share: (c) => ({
    progress_entry_id: c.id.progress_entry,
    crew_member_id: c.id.crew_member,
    share_bp: 10000,
  }),
  work_log: (c) => ({
    date: "2026-09-28",
    crew_member_id: c.id.crew_member,
    project_id: c.id.project,
    stage_id: c.id.stage,
    basis: "hourly",
    quantity: "8.00",
    hours: "8.00",
    rate_cents: 4500,
    amount_cents: 36000,
    source: "grid",
    entry_id: uuidv7(),
    entered_by: c.user,
  }),
  no_work: (c) => ({
    crew_member_id: c.id.crew_member,
    date: "2026-09-29",
    reason: "rain",
    entered_by: c.user,
  }),
  expense_category: () => ({ name: "Category" }),
  expense: (c) => ({
    project_id: c.id.project,
    category_id: c.id.expense_category,
    supplier: "Bunnings",
    date: "2026-09-28",
    amount_ex_gst_cents: 10000,
    gst_cents: 1000,
    paid_by: "company_card",
    entered_by: c.user,
  }),
  pay_run: () => ({ period_start: "2026-09-28", period_end: "2026-10-04" }),
  pay_run_line: (c) => ({
    pay_run_id: c.id.pay_run,
    crew_member_id: c.id.crew_member,
    kind: "log",
    ref_id: c.id.work_log,
    snapshot: "{}",
    amount_cents: 36000,
  }),
  ledger_entry: (c) => ({
    crew_member_id: c.id.crew_member,
    date: "2026-09-28",
    kind: "advance",
    amount_cents: 100,
  }),
  statement_link: (c) => ({
    pay_run_id: c.id.pay_run,
    crew_member_id: c.id.crew_member,
    token_hash: uuidv7(),
    expires_at: "2030-01-01T00:00:00Z",
  }),
  file: (c) => ({
    storage_key: `${c.id.workspace}/${uuidv7()}`,
    name: "a.jpg",
    mime: "image/jpeg",
    bytes: 1024,
    sha256: "0".repeat(64),
    entity_type: "project",
    entity_id: c.id.project,
  }),
  client_mutation: (c) => ({ user_id: c.user, type: "crew_day" }),
  audit_event: (c) => ({ table_name: "project", row_id: c.id.project, action: "insert" }),
};

/**
 * A where-clause suffix that keeps only the seed's own row. audit_event also holds the rows the
 * Task 5 audit trigger writes for every seeded insert; those always carry before or after, so the
 * seeded audit_event row is the only one with neither.
 */
export const seedOnly = (table: string) =>
  table === "audit_event" ? " and before is null and after is null" : "";

/** Seeds one row in every tenant table for a new workspace, through the owner pool. */
export async function seedWorkspace(name: string): Promise<Actor> {
  const { workspaceId, ownerActor } = await makeWorkspace(name);
  const owner = pool("owner");
  const ctx: Ctx = { user: ownerActor.userId, id: { workspace: workspaceId } };
  const [member] = await rows<{ id: string }>("owner", "select id from member where workspace_id = $1", [
    workspaceId,
  ]);
  ctx.id.member = member!.id;
  for (const [table, seed] of Object.entries(SEED)) {
    if (seed === FROM_MAKE_WORKSPACE) continue;
    const row = { id: uuidv7(), workspace_id: workspaceId, ...seed(ctx) };
    const cols = Object.keys(row);
    await owner.query(
      `insert into "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
      Object.values(row),
    );
    ctx.id[table] = row.id;
  }
  return ownerActor;
}
