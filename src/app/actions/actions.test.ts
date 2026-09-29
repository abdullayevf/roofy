/**
 * Admin Server Functions (plan Task 7): zod-validated, typed results, role refusals, the demo-session
 * cookie, revalidation of the affected routes — and a follow-up render in the same session sees the write.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSeed } from "@/data/fake/store";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
  }),
  headers: async () => new Headers(),
}));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

const projects = await import("./projects");
const stages = await import("./stages");
const crew = await import("./crew");
const pay = await import("./pay");
const records = await import("./records");
const settings = await import("./settings");
const { getData } = await import("@/data");

const seed = getSeed();
const { meta } = seed;

const as = (role: string) => {
  jar.set("roofy_role", role);
};

beforeEach(() => {
  jar.clear();
  revalidatePath.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

const job = {
  clientId: seed.clients[0]!.id,
  nickname: "Nguyen job",
  siteAddress: "12 Forest Rd, Hurstville",
  jobType: "metal_reroof" as const,
  contractCents: 4_200_000,
  status: "active" as const,
  startDate: null,
  targetFinish: null,
};

describe("admin Server Functions", () => {
  it("createProject: gives the browser a demo session, revalidates Home and Jobs, and the next render shows it", async () => {
    const r = await projects.createProject(job);
    if (!r.ok) throw new Error(r.message);
    expect(jar.get("roofy_demo")).toMatch(/^[0-9a-f-]{36}$/);
    expect(revalidatePath).toHaveBeenCalledWith("/", "page");
    expect(revalidatePath).toHaveBeenCalledWith("/jobs", "layout");
    const { data, actor } = await getData();
    expect((await data.projects.get(actor, r.id)).name).toBe("Nguyen job");
    const again = await projects.updateProject(r.id, { nickname: "Nguyen job — Hurstville" });
    expect(again.ok).toBe(true);
    expect((await data.projects.get(actor, r.id)).name).toBe("Nguyen job — Hurstville");
  });

  it("invalid input → invalid, with a plain message and field issues; nothing revalidated", async () => {
    const r = await projects.createProject({ ...job, nickname: " ", targetFinish: "2026-13-01" });
    expect(r).toEqual({
      ok: false,
      code: "invalid",
      message: "Add a name for the job.",
      issues: [
        { field: "nickname", message: "Add a name for the job." },
        { field: "targetFinish", message: "Pick a date." },
      ],
    });
    expect(revalidatePath).not.toHaveBeenCalled();
    const bad = await crew.setRate({
      crewMemberId: meta.crew.sam,
      basis: "per_unit",
      unit: null,
      amountCents: 950,
      effectiveFrom: "2026-10-01",
      projectId: null,
    });
    expect(bad).toMatchObject({
      ok: false,
      code: "invalid",
      message: "Pick the unit this rate is for: m², lm or each.",
    });
  });

  it("a foreman or accountant calling a money/admin action gets forbidden, money-free", async () => {
    for (const role of ["foreman", "accountant"]) {
      as(role);
      const results = [
        await pay.approvePayRun(meta.payRuns.review),
        await pay.recordPayout({
          crewMemberId: meta.crew.dima,
          date: "2026-09-28",
          amountCents: 1000,
          kind: "payment",
          method: "cash",
          note: null,
        }),
        await crew.setRate({
          crewMemberId: meta.crew.sam,
          basis: "daily",
          unit: null,
          amountCents: 33000,
          effectiveFrom: "2026-10-01",
          projectId: null,
        }),
        await stages.confirmStageDone({
          stageId: meta.stages.harrisRidge,
          completedOn: "2026-09-28",
          note: null,
          photoFileId: null,
          crewMemberIds: [meta.crew.sam],
          shares: { mode: "equal" },
        }),
        await settings.saveLevel({ id: null, name: "Tiler", floorRateCents: 3000 }),
      ];
      for (const r of results) {
        expect(r).toMatchObject({ ok: false, code: "forbidden" });
        if (!r.ok) expect(r.message).not.toMatch(/\$\s?\d/);
      }
    }
  });

  it("pay run: blocked approve → conflict; fix the rate, approve, export CSV, record the payout", async () => {
    const blocked = await pay.approvePayRun(meta.payRuns.review);
    expect(blocked).toEqual({
      ok: false,
      code: "conflict",
      message: "Fix the missing rate before you approve.",
      issues: [],
    });
    expect(
      (
        await crew.setRate({
          crewMemberId: meta.crew.jake,
          basis: "per_unit",
          unit: "lm",
          amountCents: 800,
          effectiveFrom: "2026-01-05",
          projectId: null,
        })
      ).ok,
    ).toBe(true);
    const approved = await pay.approvePayRun(meta.payRuns.review);
    if (!approved.ok) throw new Error(approved.message);
    expect(approved.payRun.status).toBe("approved");
    expect(revalidatePath).toHaveBeenCalledWith("/pay", "layout");
    const csv = await pay.exportPayRunCsv(meta.payRuns.review);
    if (!csv.ok) throw new Error(csv.message);
    expect(csv.csv.split("\r\n")[0]).toBe(
      "Date,Person,ABN,Job,Stage,Basis,Qty,Unit,Hours,Rate,Amount,GST,Total",
    );
    const paid = await pay.recordPayout({
      crewMemberId: meta.crew.dima,
      date: "2026-09-28",
      amountCents: 148200,
      kind: "payment",
      method: "bank_transfer",
      note: null,
    });
    expect(paid).toMatchObject({ ok: true, balanceCents: 0 });
    const reopened = await pay.reopenPayRun(meta.payRuns.review);
    // No later run is approved, so it reopens; the recorded payment stays in the ledger.
    expect(reopened).toMatchObject({ ok: true, payRun: { status: "draft" } });
  });

  it("stage done / reopen, log edit, settings and assignments round-trip", async () => {
    const done = await stages.confirmStageDone({
      stageId: meta.stages.harrisRidge,
      completedOn: "2026-09-28",
      note: "Ridge capped",
      photoFileId: null,
      crewMemberIds: [meta.crew.sam, meta.crew.tom, meta.crew.dima],
      shares: { mode: "custom", bp: [4000, 3000, 3000] },
    });
    expect(done.ok).toBe(true);
    expect((await stages.reopenStage(meta.stages.harrisRidge)).ok).toBe(true);
    const edit = await records.editLog(meta.logs.lateEntry, { hours: 400 });
    expect(edit.ok).toBe(true);
    expect(await records.editLog(meta.logs.lateEntry, {})).toMatchObject({
      ok: false,
      message: "Change the hours or days before saving.",
    });
    const craig = seed.members.find((m) => m.role === "foreman")!;
    expect((await settings.setAssignments(craig.id, [meta.projects.smith])).ok).toBe(true);
    as("owner");
    expect((await settings.setMemberRole(craig.id, "manager")).ok).toBe(true);
  });

  it("outside fake mode nothing is written: a plain 'try again'", async () => {
    vi.stubEnv("ROOFY_DATA", "postgres");
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await projects.createProject(job)).toEqual({
      ok: false,
      code: "unavailable",
      message: "Couldn't save this. Try again.",
      issues: [],
    });
    spy.mockRestore();
  });
});
