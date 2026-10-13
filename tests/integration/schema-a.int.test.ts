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
});
