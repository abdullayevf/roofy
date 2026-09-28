import { describe, expect, it } from "vitest";
import { ledgerBalance } from "@/domain/ledger";
import { sum } from "@/domain/money";
import { getSeed } from "../store";
import { fake } from "./testing";

const seed = getSeed();
const { meta } = seed;

describe("crew", () => {
  it("list: active crew by name; manager rows carry balance and last log, foreman rows don't", async () => {
    const m = fake("manager");
    const list = await m.data.crew.list(m.actor);
    expect(list.rows.map((r) => r.name)).not.toContain("Pete");
    expect(list.rows).toHaveLength(11);
    const all = await m.data.crew.list(m.actor, { includeInactive: true });
    expect(all.rows.find((r) => r.name === "Pete")!.active).toBe(false);
    if (list.view !== "manager") throw new Error("manager view expected");
    const kev = list.rows.find((r) => r.name === "Kev")!;
    expect([kev.unpaidTooLong, kev.lastLogDate]).toEqual([true, "2026-09-25"]);
    const f = fake("foreman");
    expect((await f.data.crew.list(f.actor)).view).toBe("foreman");
  });

  it("detail: Sam's rates with history (current flags incl. the Ryde override), ledger and statements", async () => {
    const { data, actor } = fake("manager");
    const sam = await data.crew.get(actor, meta.crew.sam);
    const daily = sam.rates.filter((r) => r.basis === "daily");
    expect(daily.map((r) => [r.amountCents, r.effectiveFrom, r.project?.name ?? null, r.current])).toEqual([
      [32000, "2026-09-15", null, true],
      [30000, "2026-07-01", null, false],
      [28000, "2024-09-02", null, false],
      [36000, "2026-09-01", "Ryde heritage", true],
    ]);
    expect(sam.level).toEqual(expect.objectContaining({ name: "Roofer", floorRateCents: 3200 }));
    expect(sam.balanceCents).toBe(0);
    expect(sam.ledger[0]!.balanceAfterCents).toBe(0);
    expect(sam.statements[0]).toMatchObject({
      payRunId: meta.payRuns.review,
      status: "draft",
      shareable: false,
    });
    expect(sam.statements[1]).toMatchObject({ payRunId: meta.payRuns.lastApproved, shareable: true });
    expect(sam.utilisation.availableDays).toBeGreaterThan(0);
    expect(sam.recentLogs).toHaveLength(20);
  });

  it("Dima's ledger: newest first, running balance −$300.00 after the advance (E15.1)", async () => {
    const { data, actor } = fake("accountant");
    const dima = await data.crew.get(actor, meta.crew.dima);
    // Date order: advance Mon 21 (−$300.00), last run's credit Mon 21, its payment Wed 23 → −$300.00.
    expect(dima.ledger.slice(0, 3).map((e) => [e.date, e.kind, e.balanceAfterCents])).toEqual([
      ["2026-09-23", "payment", -30000],
      ["2026-09-21", "payrun_credit", expect.any(Number)],
      ["2026-09-21", "advance", -30000],
    ]);
    expect(dima.balanceCents).toBe(
      ledgerBalance(seed.ledgerEntries.filter((e) => e.crewMemberId === meta.crew.dima)),
    );
  });

  it("a foreman can't open crew detail or rates", async () => {
    const { data, actor } = fake("foreman");
    await expect(data.crew.get(actor, meta.crew.sam)).rejects.toMatchObject({ code: "forbidden" });
    await expect(data.crew.rates(actor, meta.crew.sam)).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("expenses", () => {
  it("list totals are the sums of the listed rows", async () => {
    const { data, actor } = fake("manager");
    const list = await data.expenses.list(actor, { projectId: meta.projects.smith });
    if (list.view !== "manager") throw new Error("manager view expected");
    expect(list.totals.exGstCents).toBe(sum(list.rows.map((r) => r.amountExGstCents)));
    expect(list.totals.gstCents).toBe(sum(list.rows.map((r) => r.gstCents)));
    const ranged = await data.expenses.list(actor, { range: { from: "2026-09-21", to: "2026-09-27" } });
    expect(ranged.rows.every((r) => r.date >= "2026-09-21" && r.date <= "2026-09-27")).toBe(true);
  });

  it("detail: the edited Smith sheets receipt links to its history; foreman sees no amounts", async () => {
    const m = fake("manager");
    const d = await m.data.expenses.get(m.actor, meta.expenses.smithSheets);
    if (d.view !== "manager") throw new Error("manager view expected");
    expect(d.receipt?.name).toBe("Receipt — Harbour Steel.jpg");
    expect(d.historyHref).toBe(`/history?table=expense&rowId=${meta.expenses.smithSheets}`);
    expect(d.inApprovedPayRun).toBe(false);
    const f = fake("foreman");
    const fd = await f.data.expenses.get(f.actor, meta.expenses.smithSheets);
    expect(fd.view).toBe("foreman");
    expect("amountExGstCents" in fd.expense).toBe(false);
    const harris = seed.expenses.find((e) => e.projectId === meta.projects.harris)!;
    await expect(f.data.expenses.get(f.actor, harris.id)).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("workspace settings", () => {
  it("manager sees pay settings; foreman gets basics; levels/templates/members are manager-only", async () => {
    const m = fake("manager");
    const s = await m.data.workspace.settings(m.actor);
    expect(s.view === "manager" && s.settings).toMatchObject({
      name: "Harbour Roofing",
      onCostBp: 2500,
      payFrequency: "weekly",
    });
    expect((await m.data.workspace.levels(m.actor)).find((l) => l.name === "Roofer")).toMatchObject({
      floorRateCents: 3200,
      crewCount: 2,
    });
    expect((await m.data.workspace.templates(m.actor)).map((t) => t.jobType)).toHaveLength(5);
    expect((await m.data.workspace.members(m.actor)).map((x) => x.name)).toEqual([
      "Karen Holt",
      "Dan Holt",
      "Craig Dunn",
      "Priya Shah",
    ]);
    const [craig] = await m.data.workspace.assignments(m.actor);
    expect(craig!.projectIds.sort()).toEqual([meta.projects.smith, meta.projects.patel].sort());
    const f = fake("foreman");
    const fs = await f.data.workspace.settings(f.actor);
    expect(fs.view).toBe("foreman");
    expect((await f.data.workspace.categories(f.actor))[0]!.name).toBe("Materials");
    for (const call of [
      () => f.data.workspace.levels(f.actor),
      () => f.data.workspace.templates(f.actor),
      () => f.data.workspace.members(f.actor),
      () => f.data.workspace.assignments(f.actor),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: "forbidden" });
    }
  });

  it("an actor from another workspace is refused", async () => {
    const { data, actor } = fake("manager");
    await expect(data.home.get({ ...actor, workspaceId: "other" })).rejects.toMatchObject({
      code: "forbidden",
    });
  });
});

describe("record history, workspace export and the snapshot", () => {
  it("history: newest first with changed fields; filtered by row", async () => {
    const { data, actor } = fake("accountant");
    const rows = await data.audit.history(actor, { table: "expense", rowId: meta.expenses.smithSheets });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorName: "Dan Holt",
      action: "update",
      fields: ["amountExGstCents", "gstCents"],
    });
    const all = await data.audit.history(actor);
    expect(all.length).toBeGreaterThan(5);
    expect(all[0]!.at >= all.at(-1)!.at).toBe(true);
  });

  it("export: Owner only; one CSV per table", async () => {
    const o = fake("owner");
    const listing = await o.data.exports.listing(o.actor);
    expect(listing.files.find((x) => x.name === "work_logs.csv")!.rows).toBe(seed.workLogs.length);
    const file = await o.data.exports.file(o.actor, "crew_levels.csv");
    expect(file.body.split("\r\n")[0]).toContain("floorRateCents");
    await expect(o.data.exports.file(o.actor, "nope.csv")).rejects.toMatchObject({ code: "not_found" });
    const m = fake("manager");
    await expect(m.data.exports.listing(m.actor)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("snapshot for the foreman: assigned jobs, active crew, categories, no rates", async () => {
    const { data, actor } = fake("foreman");
    const s = await data.sync.snapshot(actor);
    expect(s.today).toBe("2026-09-28");
    expect(s.projects.map((p) => p.name).sort()).toEqual([
      "Patel job — Epping re-roof",
      "Smith job — Ryde re-roof",
    ]);
    expect(s.crew).toHaveLength(11);
  });
});
