// Schema part A: composite tenant FKs, the rate uniqueness rule, date round-trips and segment ranges.
process.env.TZ = "Pacific/Kiritimati";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePools, pool } from "@/server/db/client";
import * as schema from "@/server/db/schema";

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
      { name: "Alpha Roofing", timezone: "Australia/Sydney" },
      { name: "Bravo Roofing", timezone: "Australia/Perth" },
    ])
    .returning({ id: schema.workspace.id });
  [wsA, wsB] = made.map((w) => w.id) as [string, string];
});

afterAll(async () => {
  await closePools();
});

describe("schema part A", () => {
  it("(a) rejects a crew member in workspace A whose level belongs to workspace B", async () => {
    const [levelB] = await db
      .insert(schema.crewLevel)
      .values({ workspaceId: wsB, name: "Leading hand", floorRateCents: 4200 })
      .returning();
    const [levelA] = await db
      .insert(schema.crewLevel)
      .values({ workspaceId: wsA, name: "Leading hand", floorRateCents: 4000 })
      .returning();
    const crew = { workspaceId: wsA, name: "Sam", type: "employee", activeFrom: "2026-01-05" } as const;
    expect(await pgCode(db.insert(schema.crewMember).values({ ...crew, levelId: levelB!.id }))).toBe("23503");
    expect(
      await pgCode(db.insert(schema.crewMember).values({ ...crew, levelId: levelA!.id })),
    ).toBeUndefined();
  });

  it("(b) rejects a second default rate with no unit for the same crew member and date", async () => {
    const [sam] = await db
      .insert(schema.crewMember)
      .values({ workspaceId: wsA, name: "Rate Sam", type: "contractor", activeFrom: "2026-01-05" })
      .returning();
    const rate = {
      workspaceId: wsA,
      crewMemberId: sam!.id,
      basis: "hourly",
      unit: null,
      projectId: null,
      amountCents: 5500,
      effectiveFrom: "2026-09-01",
    } as const;
    expect(await pgCode(db.insert(schema.rate).values(rate))).toBeUndefined();
    expect(await pgCode(db.insert(schema.rate).values({ ...rate, amountCents: 6000 }))).toBe("23505");
    // Positive controls: each part of the key on its own makes a new rate.
    const [job] = await db
      .insert(schema.project)
      .values({ workspaceId: wsA, siteAddress: "9 Rate St", jobType: "repair" })
      .returning();
    expect(
      await pgCode(db.insert(schema.rate).values({ ...rate, effectiveFrom: "2026-10-01" })),
    ).toBeUndefined();
    expect(
      await pgCode(db.insert(schema.rate).values({ ...rate, basis: "per_unit", unit: "m2" })),
    ).toBeUndefined();
    expect(await pgCode(db.insert(schema.rate).values({ ...rate, projectId: job!.id }))).toBeUndefined();
    expect(await pgCode(db.insert(schema.rate).values({ ...rate, projectId: job!.id }))).toBe("23505");
    expect(await pgCode(db.insert(schema.rate).values({ ...rate, basis: "per_unit", unit: "m2" }))).toBe(
      "23505",
    );
  });

  it("(c) reads a date back as the same YYYY-MM-DD string with TZ=Pacific/Kiritimati", async () => {
    expect(new Date(2026, 8, 28).getTimezoneOffset()).toBe(-840);
    const [p] = await db
      .insert(schema.project)
      .values({
        workspaceId: wsA,
        siteAddress: "1 Ridge St",
        jobType: "metal_reroof",
        startDate: "2026-09-28",
      })
      .returning({ id: schema.project.id });
    const [row] = await db
      .select({ startDate: schema.project.startDate })
      .from(schema.project)
      .where(eq(schema.project.id, p!.id));
    expect(row?.startDate).toBe("2026-09-28");
    // The raw pg path (used by `rows()` in later tests) returns the same string, never a Date.
    const raw = await pool("owner").query<{ start_date: unknown }>(
      "select start_date from project where id = $1",
      [p!.id],
    );
    expect(raw.rows[0]?.start_date).toBe("2026-09-28");
    for (const role of ["app", "auth"] as const) {
      const v = await pool(role).query<{ d: unknown }>("select '2026-09-28'::date as d");
      expect(v.rows[0]?.d, role).toBe("2026-09-28");
    }
  });

  it("(d) rejects a stage segment that ends before it starts", async () => {
    const [p] = await db
      .insert(schema.project)
      .values({ workspaceId: wsA, siteAddress: "2 Gutter Rd", jobType: "repair" })
      .returning();
    const [s] = await db
      .insert(schema.stage)
      .values({ workspaceId: wsA, projectId: p!.id, name: "Strip", position: 1 })
      .returning();
    const segment = { workspaceId: wsA, stageId: s!.id, startDate: "2026-09-28" };
    expect(await pgCode(db.insert(schema.stageSegment).values({ ...segment, endDate: "2026-09-27" }))).toBe(
      "23514",
    );
    expect(
      await pgCode(db.insert(schema.stageSegment).values({ ...segment, endDate: "2026-09-28" })),
    ).toBeUndefined();
    expect(
      await pgCode(db.insert(schema.stageSegment).values({ ...segment, endDate: null })),
    ).toBeUndefined();
  });

  it("rejects a stage in workspace B that points at workspace A's project", async () => {
    const [p] = await db
      .insert(schema.project)
      .values({ workspaceId: wsA, siteAddress: "3 Valley Ct", jobType: "repair" })
      .returning();
    expect(
      await pgCode(
        db.insert(schema.stage).values({ workspaceId: wsB, projectId: p!.id, name: "Strip", position: 1 }),
      ),
    ).toBe("23503");
  });

  it("rejects working days that are empty and a manual percent off the 25% steps", async () => {
    const ws = { name: "Check Roofing", timezone: "Australia/Sydney" };
    expect(await pgCode(db.insert(schema.workspace).values({ ...ws, workingDays: [] }))).toBe("23514");
    expect(
      await pgCode(db.insert(schema.workspace).values({ ...ws, workingDays: [0, 1, 2, 3, 4, 5, 6, 6] })),
    ).toBe("23514");
    expect(await pgCode(db.insert(schema.workspace).values({ ...ws, workingDays: [1] }))).toBeUndefined();
    const [p] = await db
      .insert(schema.project)
      .values({ workspaceId: wsA, siteAddress: "4 Pitch Pl", jobType: "repair" })
      .returning();
    const st = { workspaceId: wsA, projectId: p!.id, name: "Sheet", position: 1 };
    expect(await pgCode(db.insert(schema.stage).values({ ...st, manualPctBp: 1234 }))).toBe("23514");
    for (const manualPctBp of [0, 2500, 5000, 7500, 10000]) {
      expect(
        await pgCode(db.insert(schema.stage).values({ ...st, manualPctBp })),
        String(manualPctBp),
      ).toBeUndefined();
    }
  });
});

/** One row of each parent kind in a workspace. */
type Parents = Record<"member" | "client" | "project" | "template" | "stage" | "level" | "crew", string>;

async function parents(workspaceId: string, tag: string): Promise<Parents> {
  const one = async <T extends { id: string }>(q: Promise<T[]>) => (await q)[0]!.id;
  const userId = await one(
    db
      .insert(schema.user)
      .values({ name: tag, email: `${tag}-${workspaceId}@example.test` })
      .returning(),
  );
  const project = await one(
    db.insert(schema.project).values({ workspaceId, siteAddress: tag, jobType: "repair" }).returning(),
  );
  return {
    member: await one(db.insert(schema.member).values({ workspaceId, userId, role: "foreman" }).returning()),
    client: await one(db.insert(schema.client).values({ workspaceId, name: tag }).returning()),
    project,
    template: await one(
      db.insert(schema.stageTemplate).values({ workspaceId, name: tag, jobType: "repair" }).returning(),
    ),
    stage: await one(
      db.insert(schema.stage).values({ workspaceId, projectId: project, name: tag, position: 1 }).returning(),
    ),
    level: await one(
      db.insert(schema.crewLevel).values({ workspaceId, name: tag, floorRateCents: 4000 }).returning(),
    ),
    crew: await one(
      db
        .insert(schema.crewMember)
        .values({ workspaceId, name: tag, type: "employee", activeFrom: "2026-01-05" })
        .returning(),
    ),
  };
}

// Decision 3, every composite FK: `own` is workspace A's parents, `fk` is the parents for the
// key under test (A's for the control, B's for the cross-tenant insert).
const crossTenant: [string, (own: Parents, fk: Parents) => Promise<unknown>][] = [
  [
    "project.client_id",
    (_, fk) =>
      db
        .insert(schema.project)
        .values({ workspaceId: wsA, siteAddress: "x", jobType: "repair", clientId: fk.client }),
  ],
  [
    "project_assignment.member_id",
    (own, fk) =>
      db
        .insert(schema.projectAssignment)
        .values({ workspaceId: wsA, memberId: fk.member, projectId: own.project }),
  ],
  [
    "project_assignment.project_id",
    (own, fk) =>
      db
        .insert(schema.projectAssignment)
        .values({ workspaceId: wsA, memberId: own.member, projectId: fk.project }),
  ],
  [
    "stage_template_item.template_id",
    (_, fk) =>
      db
        .insert(schema.stageTemplateItem)
        .values({ workspaceId: wsA, templateId: fk.template, name: "x", position: 1 }),
  ],
  [
    "stage.project_id",
    (_, fk) =>
      db.insert(schema.stage).values({ workspaceId: wsA, projectId: fk.project, name: "x", position: 2 }),
  ],
  [
    "stage_segment.stage_id",
    (_, fk) =>
      db.insert(schema.stageSegment).values({ workspaceId: wsA, stageId: fk.stage, startDate: "2026-09-28" }),
  ],
  [
    "crew_member.level_id",
    (_, fk) =>
      db.insert(schema.crewMember).values({
        workspaceId: wsA,
        name: "x",
        type: "employee",
        activeFrom: "2026-01-05",
        levelId: fk.level,
      }),
  ],
  [
    "rate.crew_member_id",
    (_, fk) =>
      db.insert(schema.rate).values({
        workspaceId: wsA,
        crewMemberId: fk.crew,
        basis: "hourly",
        amountCents: 5000,
        effectiveFrom: "2026-09-01",
      }),
  ],
  [
    "rate.project_id",
    (own, fk) =>
      db.insert(schema.rate).values({
        workspaceId: wsA,
        crewMemberId: own.crew,
        basis: "daily",
        amountCents: 5000,
        effectiveFrom: "2026-09-01",
        projectId: fk.project,
      }),
  ],
  [
    "stage_completion_share.stage_id",
    (own, fk) =>
      db
        .insert(schema.stageCompletionShare)
        .values({ workspaceId: wsA, stageId: fk.stage, crewMemberId: own.crew, shareBp: 5000 }),
  ],
  [
    "stage_completion_share.crew_member_id",
    (own, fk) =>
      db
        .insert(schema.stageCompletionShare)
        .values({ workspaceId: wsA, stageId: own.stage, crewMemberId: fk.crew, shareBp: 5000 }),
  ],
];

describe("composite tenant foreign keys", () => {
  let b: Parents;
  beforeAll(async () => {
    b = await parents(wsB, "fk-b");
  });

  it.each(crossTenant)("%s rejects a parent from another workspace", async (key, insert) => {
    // Fresh parents in A per key, so the controls of two keys on one table never collide.
    const a = await parents(wsA, `fk-a-${key}`);
    expect(await pgCode(insert(a, b))).toBe("23503");
    expect(await pgCode(insert(a, a))).toBeUndefined();
  });
});
