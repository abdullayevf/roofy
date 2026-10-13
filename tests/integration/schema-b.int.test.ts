// Schema part B: composite tenant FKs on the field, money and system tables, the no-work and
// pay-run uniques, the money/quantity CHECKs, the dashboard indexes and the tenancy lists.
import { drizzle } from "drizzle-orm/node-postgres";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePools, pool } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { AUTH_TABLES, TENANT_TABLES } from "@/server/db/tenancy";

const db = drizzle(pool("owner"), { schema });

/** The Postgres error code a promise rejects with (drizzle wraps the pg error in `cause`). */
async function pgCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    return e.code ?? e.cause?.code;
  }
  return undefined;
}

let wsA: string;
let wsB: string;

beforeAll(async () => {
  const made = await db
    .insert(schema.workspace)
    .values([
      { name: "Charlie Roofing", timezone: "Australia/Sydney" },
      { name: "Delta Roofing", timezone: "Australia/Perth" },
    ])
    .returning({ id: schema.workspace.id });
  [wsA, wsB] = made.map((w) => w.id) as [string, string];
});

afterAll(async () => {
  await closePools();
});

type Parents = Record<
  "user" | "project" | "stage" | "crew" | "file" | "entry" | "log" | "category" | "payRun",
  string
>;

let period = 0;
/** A distinct Monday-to-Sunday period per call, so pay runs never collide. */
function nextPeriod() {
  const start = new Date(Date.UTC(2020, 0, 6 + 7 * period++));
  const end = new Date(start.getTime() + 6 * 86_400_000);
  return { periodStart: start.toISOString().slice(0, 10), periodEnd: end.toISOString().slice(0, 10) };
}

const one = async <T extends { id: string }>(q: Promise<T[]>) => (await q)[0]!.id;

const logValues = (workspaceId: string, p: Parents) =>
  ({
    workspaceId,
    date: "2026-09-28",
    crewMemberId: p.crew,
    projectId: p.project,
    stageId: p.stage,
    basis: "hourly",
    quantity: "8.00",
    hours: "8.00",
    rateCents: 4500,
    amountCents: 36000,
    source: "grid",
    entryId: uuidv7(),
    enteredBy: p.user,
  }) as const;

const expenseValues = (workspaceId: string, p: Parents) =>
  ({
    workspaceId,
    projectId: p.project,
    categoryId: p.category,
    supplier: "Bunnings",
    date: "2026-09-28",
    amountExGstCents: 10000,
    gstCents: 1000,
    paidBy: "company_card",
    enteredBy: p.user,
  }) as const;

async function parents(workspaceId: string, tag: string): Promise<Parents> {
  const user = await one(
    db
      .insert(schema.user)
      .values({ name: tag, email: `${tag}-${workspaceId}@example.test` })
      .returning(),
  );
  const project = await one(
    db.insert(schema.project).values({ workspaceId, siteAddress: tag, jobType: "repair" }).returning(),
  );
  const stage = await one(
    db.insert(schema.stage).values({ workspaceId, projectId: project, name: tag, position: 1 }).returning(),
  );
  const crew = await one(
    db
      .insert(schema.crewMember)
      .values({ workspaceId, name: tag, type: "employee", activeFrom: "2026-01-05" })
      .returning(),
  );
  const file = await one(
    db
      .insert(schema.file)
      .values({
        workspaceId,
        storageKey: `${workspaceId}/${tag}`,
        name: `${tag}.jpg`,
        mime: "image/jpeg",
        bytes: 1024,
        sha256: "0".repeat(64),
        entityType: "project",
        entityId: project,
      })
      .returning(),
  );
  const entry = await one(
    db
      .insert(schema.progressEntry)
      .values({ workspaceId, stageId: stage, date: "2026-09-28", quantity: "12.50", enteredBy: user })
      .returning(),
  );
  const partial = { user, project, stage, crew, file, entry, log: "", category: "", payRun: "" };
  return {
    ...partial,
    log: await one(db.insert(schema.workLog).values(logValues(workspaceId, partial)).returning()),
    category: await one(db.insert(schema.expenseCategory).values({ workspaceId, name: tag }).returning()),
    payRun: await one(
      db
        .insert(schema.payRun)
        .values({ workspaceId, ...nextPeriod() })
        .returning(),
    ),
  };
}

// Every composite FK the tables in this task add: `own` is workspace A's parents, `fk` is the
// parents for the key under test (A's for the control, B's for the cross-tenant insert).
const crossTenant: [string, (own: Parents, fk: Parents) => Promise<unknown>][] = [
  [
    "progress_entry.stage_id",
    (own, fk) =>
      db.insert(schema.progressEntry).values({
        workspaceId: wsA,
        stageId: fk.stage,
        date: "2026-09-28",
        quantity: "1.00",
        enteredBy: own.user,
      }),
  ],
  [
    "progress_entry.photo_file_id",
    (own, fk) =>
      db.insert(schema.progressEntry).values({
        workspaceId: wsA,
        stageId: own.stage,
        date: "2026-09-28",
        quantity: "1.00",
        enteredBy: own.user,
        photoFileId: fk.file,
      }),
  ],
  [
    "progress_share.progress_entry_id",
    (own, fk) =>
      db
        .insert(schema.progressShare)
        .values({ workspaceId: wsA, progressEntryId: fk.entry, crewMemberId: own.crew, shareBp: 10000 }),
  ],
  [
    "progress_share.crew_member_id",
    (own, fk) =>
      db
        .insert(schema.progressShare)
        .values({ workspaceId: wsA, progressEntryId: own.entry, crewMemberId: fk.crew, shareBp: 10000 }),
  ],
  [
    "work_log.crew_member_id",
    (own, fk) => db.insert(schema.workLog).values({ ...logValues(wsA, own), crewMemberId: fk.crew }),
  ],
  [
    "work_log.project_id",
    (own, fk) => db.insert(schema.workLog).values({ ...logValues(wsA, own), projectId: fk.project }),
  ],
  [
    "work_log.stage_id",
    (own, fk) => db.insert(schema.workLog).values({ ...logValues(wsA, own), stageId: fk.stage }),
  ],
  [
    "work_log.adjusts_log_id",
    (own, fk) =>
      db.insert(schema.workLog).values({
        ...logValues(wsA, own),
        source: "adjustment",
        quantity: "-8.00",
        hours: "-8.00",
        amountCents: -36000,
        adjustsLogId: fk.log,
      }),
  ],
  [
    "work_log.progress_entry_id",
    (own, fk) =>
      db.insert(schema.workLog).values({
        ...logValues(wsA, own),
        basis: "per_unit",
        unit: "m2",
        source: "progress",
        progressEntryId: fk.entry,
      }),
  ],
  [
    "work_log.pay_run_id",
    (own, fk) => db.insert(schema.workLog).values({ ...logValues(wsA, own), payRunId: fk.payRun }),
  ],
  [
    "no_work.crew_member_id",
    (own, fk) =>
      db.insert(schema.noWork).values({
        workspaceId: wsA,
        crewMemberId: fk.crew,
        date: "2026-09-29",
        reason: "rain",
        enteredBy: own.user,
      }),
  ],
  [
    "expense.project_id",
    (own, fk) => db.insert(schema.expense).values({ ...expenseValues(wsA, own), projectId: fk.project }),
  ],
  [
    "expense.stage_id",
    (own, fk) => db.insert(schema.expense).values({ ...expenseValues(wsA, own), stageId: fk.stage }),
  ],
  [
    "expense.category_id",
    (own, fk) => db.insert(schema.expense).values({ ...expenseValues(wsA, own), categoryId: fk.category }),
  ],
  [
    "expense.crew_member_id",
    (own, fk) =>
      db.insert(schema.expense).values({ ...expenseValues(wsA, own), paidBy: "crew", crewMemberId: fk.crew }),
  ],
  [
    "expense.receipt_file_id",
    (own, fk) => db.insert(schema.expense).values({ ...expenseValues(wsA, own), receiptFileId: fk.file }),
  ],
  [
    "expense.reimbursed_in_pay_run_id",
    (own, fk) =>
      db.insert(schema.expense).values({
        ...expenseValues(wsA, own),
        paidBy: "crew",
        crewMemberId: own.crew,
        reimbursedInPayRunId: fk.payRun,
      }),
  ],
  ...(["pay_run_id", "crew_member_id"] as const).map(
    (col): [string, (own: Parents, fk: Parents) => Promise<unknown>] => [
      `pay_run_line.${col}`,
      (own, fk) =>
        db.insert(schema.payRunLine).values({
          workspaceId: wsA,
          payRunId: (col === "pay_run_id" ? fk : own).payRun,
          crewMemberId: (col === "crew_member_id" ? fk : own).crew,
          kind: "gst",
          snapshot: { kind: "gst", subtotalCents: 1000 },
          amountCents: 100,
        }),
    ],
  ),
  [
    "ledger_entry.crew_member_id",
    (_, fk) =>
      db.insert(schema.ledgerEntry).values({
        workspaceId: wsA,
        crewMemberId: fk.crew,
        date: "2026-09-28",
        kind: "advance",
        amountCents: 5000,
      }),
  ],
  [
    "ledger_entry.pay_run_id",
    (own, fk) =>
      db.insert(schema.ledgerEntry).values({
        workspaceId: wsA,
        crewMemberId: own.crew,
        date: "2026-09-28",
        kind: "payrun_credit",
        amountCents: 5000,
        payRunId: fk.payRun,
      }),
  ],
  ...(["pay_run_id", "crew_member_id"] as const).map(
    (col): [string, (own: Parents, fk: Parents) => Promise<unknown>] => [
      `statement_link.${col}`,
      (own, fk) =>
        db.insert(schema.statementLink).values({
          workspaceId: wsA,
          payRunId: (col === "pay_run_id" ? fk : own).payRun,
          crewMemberId: (col === "crew_member_id" ? fk : own).crew,
          tokenHash: uuidv7(),
          expiresAt: new Date("2027-01-01T00:00:00Z"),
        }),
    ],
  ),
];

describe("schema part B: composite tenant foreign keys", () => {
  let b: Parents;
  beforeAll(async () => {
    b = await parents(wsB, "fk-b");
  });

  it("covers every composite FK the field and money tables add", () => {
    expect(crossTenant).toHaveLength(23);
  });

  it.each(crossTenant)("(a) %s rejects a parent from another workspace", async (key, insert) => {
    const a = await parents(wsA, `fk-a-${key}`);
    expect(await pgCode(insert(a, b))).toBe("23503");
    expect(await pgCode(insert(a, a))).toBeUndefined();
  });
});

describe("schema part B: uniques and checks", () => {
  let a: Parents;
  beforeAll(async () => {
    a = await parents(wsA, "checks");
  });

  it("(b) rejects a second no-work day for the same crew member and date", async () => {
    const row = {
      workspaceId: wsA,
      crewMemberId: a.crew,
      date: "2026-10-01",
      reason: "rain",
      enteredBy: a.user,
    } as const;
    expect(await pgCode(db.insert(schema.noWork).values(row))).toBeUndefined();
    expect(await pgCode(db.insert(schema.noWork).values({ ...row, reason: "sick" }))).toBe("23505");
    expect(await pgCode(db.insert(schema.noWork).values({ ...row, date: "2026-10-02" }))).toBeUndefined();
  });

  it("(c) rejects a second pay run for the same period, and a period that ends before it starts", async () => {
    const p = nextPeriod();
    expect(await pgCode(db.insert(schema.payRun).values({ workspaceId: wsA, ...p }))).toBeUndefined();
    expect(await pgCode(db.insert(schema.payRun).values({ workspaceId: wsA, ...p }))).toBe("23505");
    expect(await pgCode(db.insert(schema.payRun).values({ workspaceId: wsB, ...p }))).toBeUndefined();
    const bad = { workspaceId: wsA, periodStart: p.periodEnd, periodEnd: p.periodStart };
    expect(await pgCode(db.insert(schema.payRun).values(bad))).toBe("23514");
  });

  it("rejects a share outside 0..10000 basis points", async () => {
    const share = { workspaceId: wsA, progressEntryId: a.entry, crewMemberId: a.crew };
    expect(await pgCode(db.insert(schema.progressShare).values({ ...share, shareBp: 10001 }))).toBe("23514");
    expect(await pgCode(db.insert(schema.progressShare).values({ ...share, shareBp: -1 }))).toBe("23514");
  });

  it("rejects negative expense amounts and GST", async () => {
    const e = expenseValues(wsA, a);
    expect(await pgCode(db.insert(schema.expense).values({ ...e, amountExGstCents: -1 }))).toBe("23514");
    expect(await pgCode(db.insert(schema.expense).values({ ...e, gstCents: -1 }))).toBe("23514");
  });

  it("rejects a crew-paid expense with no crew member, and a crew member on a card expense", async () => {
    const e = expenseValues(wsA, a);
    expect(await pgCode(db.insert(schema.expense).values({ ...e, paidBy: "crew" }))).toBe("23514");
    expect(await pgCode(db.insert(schema.expense).values({ ...e, crewMemberId: a.crew }))).toBe("23514");
  });

  it("rejects negative quantity, hours or amount on a log unless it is an adjustment", async () => {
    const log = logValues(wsA, a);
    for (const bad of [{ quantity: "-1.00" }, { hours: "-1.00" }, { amountCents: -1 }]) {
      expect(await pgCode(db.insert(schema.workLog).values({ ...log, ...bad })), JSON.stringify(bad)).toBe(
        "23514",
      );
      const adjustment = { ...log, ...bad, source: "adjustment", adjustsLogId: a.log } as const;
      expect(await pgCode(db.insert(schema.workLog).values(adjustment)), JSON.stringify(bad)).toBeUndefined();
    }
    expect(await pgCode(db.insert(schema.workLog).values({ ...log, rateCents: -1 }))).toBe("23514");
  });

  it("rejects a zero multiplier, a per-unit log with no unit, and adjusts_log_id off an adjustment", async () => {
    const log = logValues(wsA, a);
    for (const bad of [{ multiplier: "0.00" }, { basis: "per_unit" }, { adjustsLogId: a.log }] as const) {
      expect(await pgCode(db.insert(schema.workLog).values({ ...log, ...bad })), JSON.stringify(bad)).toBe(
        "23514",
      );
    }
    expect(await pgCode(db.insert(schema.workLog).values({ ...log, multiplier: "1.50" }))).toBeUndefined();
  });

  it("rejects a negative ledger amount unless it is a pay-run credit", async () => {
    const entry = { workspaceId: wsA, crewMemberId: a.crew, date: "2026-09-28", amountCents: -100 } as const;
    expect(await pgCode(db.insert(schema.ledgerEntry).values({ ...entry, kind: "payment" }))).toBe("23514");
    expect(
      await pgCode(db.insert(schema.ledgerEntry).values({ ...entry, kind: "payrun_credit" })),
    ).toBeUndefined();
  });

  it("keeps the phone's id on a client mutation", async () => {
    const id = uuidv7();
    const [row] = await db
      .insert(schema.clientMutation)
      .values({ id, workspaceId: wsA, userId: a.user, type: "crew_day", result: { ok: true } })
      .returning();
    expect(row!.id).toBe(id);
    expect(row!.receivedAt).toBeInstanceOf(Date);
    const again = db
      .insert(schema.clientMutation)
      .values({ id, workspaceId: wsA, userId: a.user, type: "crew_day" });
    expect(await pgCode(again)).toBe("23505");
  });
});

describe("schema part B: catalogue", () => {
  it("(d) has every dashboard index", async () => {
    const expected: [string, string][] = [
      ["work_log", "workspace_id, date"],
      ["progress_entry", "workspace_id, date"],
      ["expense", "workspace_id, date"],
      ["no_work", "workspace_id, date"],
      ["work_log", "workspace_id, stage_id"],
      ["progress_entry", "workspace_id, stage_id"],
      ["expense", "workspace_id, stage_id"],
      ["work_log", "workspace_id, crew_member_id, date"],
      ["work_log", "workspace_id, pay_run_id"],
      ["pay_run_line", "workspace_id, pay_run_id"],
      ["ledger_entry", "workspace_id, pay_run_id"],
    ];
    const { rows } = await pool("owner").query<{ tablename: string; indexdef: string }>(
      "select tablename, indexdef from pg_indexes where schemaname = 'public'",
    );
    const have = new Set(
      rows.map((r) => `${r.tablename} (${/\(([^)]*)\)/.exec(r.indexdef)?.[1]?.replaceAll(`"`, "") ?? ""})`),
    );
    expect(expected.map(([t, c]) => `${t} (${c})`).filter((i) => !have.has(i))).toEqual([]);
  });

  it("(e) lists every public table in TENANT_TABLES or AUTH_TABLES", async () => {
    const { rows } = await pool("owner").query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'",
    );
    expect(rows.map((r) => r.table_name).sort()).toEqual([...TENANT_TABLES, ...AUTH_TABLES].sort());
  });
});
