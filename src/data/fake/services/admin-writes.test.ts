/**
 * Fake admin writes (plan Task 7): projects, stage done/reopen, crew and rates, pay run approve /
 * reopen / export, payouts and settings — role rules and every figure through `src/domain`.
 */
import { describe, expect, it } from "vitest";
import { hourlyAmount } from "@/domain/lines";
import { lumpSumLines } from "@/domain/piece";
import { DataError, type ProjectDetailManager, type StageDetailManager } from "../../contracts";
import { scanForMoney } from "../../dto";
import { getSeed } from "../store";
import { fakeSession } from "./testing";

const seed = getSeed();
const { meta } = seed;
const { crew, stages, projects, payRuns } = meta;

async function refusal(p: Promise<unknown>): Promise<DataError> {
  const e = await p.then(
    () => null,
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(DataError);
  return e as DataError;
}

/** Fix E4.3 (Jake has no lm rate) the way the flows do: add the rate. */
const jakeLm = {
  crewMemberId: crew.jake,
  basis: "per_unit" as const,
  unit: "lm" as const,
  amountCents: 800,
  effectiveFrom: "2026-01-05",
  projectId: null,
};

describe("projects", () => {
  it("a new job without stages gets the proposal (last metal re-roof); an update is audited", async () => {
    const { data, actor } = fakeSession("manager");
    const proposal = await data.projects.proposeStages(actor, "metal_reroof");
    const { id } = await data.projects.create(actor, {
      clientId: seed.clients[0]!.id,
      nickname: "Nguyen job — Hurstville re-roof",
      siteAddress: "12 Forest Rd, Hurstville",
      jobType: "metal_reroof",
      contractCents: 4_200_000,
      status: "active",
      startDate: null,
      targetFinish: "2026-11-20",
    });
    const job = (await data.projects.get(actor, id)) as ProjectDetailManager;
    expect(job.stages.map((s) => [s.name, s.status, s.labourBudgetCents])).toEqual(
      proposal.stages.map((s) => [s.name, "not_started", s.labourBudgetCents]),
    );
    expect(job.contractCents).toBe(4_200_000);
    await data.projects.update(actor, id, { nickname: "Nguyen job" });
    expect((await data.projects.get(actor, id)).name).toBe("Nguyen job");
    const history = await data.audit.history(actor, { table: "project", rowId: id });
    expect(history.map((h) => h.action)).toEqual(["update", "insert"]);
  });

  it("the unit of a stage with progress can't change; foreman and accountant can't edit jobs", async () => {
    const { data, actor, as } = fakeSession("manager");
    const e = await refusal(data.projects.updateStage(actor, stages.smithSheetInstall, { unit: "lm" }));
    expect(e.code).toBe("invalid");
    for (const role of ["foreman", "accountant"] as const) {
      const r = as(role);
      expect((await refusal(r.data.projects.update(r.actor, projects.smith, { nickname: "x" }))).code).toBe(
        "forbidden",
      );
    }
  });
});

describe("stage done with a lump sum, and reopen", () => {
  const done = {
    stageId: stages.harrisRidge,
    completedOn: "2026-09-28",
    note: null,
    photoFileId: null,
    crewMemberIds: [crew.sam, crew.tom, crew.dima],
    shares: { mode: "equal" as const },
  };

  it("E5.1: $2,000.00 split Sam/Tom/Dima → $666.67 / $666.67 / $666.66; segment closes at completion + 1", async () => {
    const { data, actor } = fakeSession("manager");
    await data.stages.confirmDone(actor, done);
    const st = (await data.stages.get(actor, stages.harrisRidge)) as StageDetailManager;
    expect(st.status).toBe("done");
    expect(st.segments.at(-1)!.end).toBe("2026-09-29");
    expect(st.lumpSumShares.map((s) => [s.name, s.shareBp, s.amountCents])).toEqual([
      ["Sam", 3334, 66667],
      ["Tom", 3333, 66667],
      ["Dima", 3333, 66666],
    ]);
    expect(st.lumpSumShares.map((s) => s.amountCents)).toEqual(
      lumpSumLines(200_000, done.crewMemberIds, { mode: "equal" }).map((l) => l.amountCents),
    );
  });

  it("only a manager or owner marks Done; custom shares must total 100%", async () => {
    const { data, actor, as } = fakeSession("manager");
    const f = as("foreman");
    expect(
      (await refusal(f.data.stages.confirmDone(f.actor, { ...done, stageId: stages.smithSheetInstall })))
        .code,
    ).toBe("forbidden");
    const e = await refusal(
      data.stages.confirmDone(actor, { ...done, shares: { mode: "custom", bp: [5000, 3000, 1000] } }),
    );
    expect(e.code).toBe("invalid");
  });

  it("reopen before approval deletes the lump-sum logs; the stage is active again", async () => {
    const { data, actor } = fakeSession("manager");
    await data.stages.confirmDone(actor, done);
    const r = await data.stages.reopen(actor, stages.harrisRidge);
    expect(r.ids).toEqual([]);
    const st = (await data.stages.get(actor, stages.harrisRidge)) as StageDetailManager;
    expect([st.status, st.segments.at(-1)!.end, st.lumpSumShares]).toEqual(["active", null, []]);
    expect(st.logs.filter((l) => l.basis === "lump_sum")).toEqual([]);
  });

  it("reopen after approval reverses the locked lump-sum logs with adjustments in the next draft (pay rules §5, §8)", async () => {
    const { data, actor } = fakeSession("manager");
    await data.stages.confirmDone(actor, done);
    await data.crew.setRate(actor, jakeLm);
    await data.payRuns.approve(actor, payRuns.review);
    await data.payRuns.approve(actor, payRuns.current);
    const r = await data.stages.reopen(actor, stages.harrisRidge);
    expect(r.ids).toHaveLength(3);
    const next = await data.payRuns.draft(actor);
    expect(next!.period.start).toBe("2026-10-05");
    const sam = next!.people.find((p) => p.name === "Sam")!;
    expect(sam.lines.map((l) => [l.label, l.basis, l.amountCents, l.date])).toEqual([
      ["adjustment", "lump_sum", -66667, "2026-09-28"],
    ]);
  });
});

describe("crew and rates", () => {
  it("adding the missing lm rate re-prices Jake's $0.00 line and unblocks approval (E4.3 fixed)", async () => {
    const { data, actor } = fakeSession("manager");
    const before = await data.payRuns.get(actor, payRuns.review);
    expect(before.blockedBy).toEqual(["missing_rate"]);
    const rate = await data.crew.setRate(actor, jakeLm);
    expect(rate).toMatchObject({ basis: "per_unit", unit: "lm", amountCents: 800, current: true });
    const after = await data.payRuns.get(actor, payRuns.review);
    expect(after.blockedBy).toEqual([]);
    expect(after.canApprove).toBe(true);
    const jake = after.people.find((p) => p.name === "Jake")!;
    expect(jake.lines.find((l) => l.basis === "per_unit")).toMatchObject({
      quantity: 2000,
      amountCents: 16000,
      missingRate: false,
    });
  });

  it("rates keep their history; the same start date replaces the amount; old logs keep their snapshot", async () => {
    const { data, actor, store } = fakeSession("manager");
    const old = store.tables.workLogs.find(
      (l) => l.crewMemberId === crew.sam && l.basis === "daily" && l.date === "2026-09-16",
    )!;
    await data.crew.setRate(actor, {
      crewMemberId: crew.sam,
      basis: "daily",
      unit: null,
      amountCents: 33000,
      effectiveFrom: "2026-10-01",
      projectId: null,
    });
    await data.crew.setRate(actor, {
      crewMemberId: crew.sam,
      basis: "daily",
      unit: null,
      amountCents: 34000,
      effectiveFrom: "2026-10-01",
      projectId: null,
    });
    const rates = (await data.crew.rates(actor, crew.sam)).filter(
      (r) => r.basis === "daily" && r.project === null,
    );
    expect(rates.map((r) => [r.effectiveFrom, r.amountCents])).toEqual([
      ["2026-10-01", 34000],
      ["2026-09-15", 32000],
      ["2026-07-01", 30000],
      ["2024-09-02", 28000],
    ]);
    expect(store.tables.workLogs.find((l) => l.id === old.id)!.rateCents).toBe(old.rateCents);
  });

  it("creates and updates a crew member; a contractor's GST flag, a per-unit worker's unit", async () => {
    const { data, actor } = fakeSession("manager");
    const { id } = await data.crew.create(actor, {
      name: "Aroha",
      phone: null,
      type: "contractor",
      levelId: null,
      abn: "51 824 753 556",
      gstRegistered: true,
      activeFrom: "2026-09-28",
      activeTo: null,
      defaultBasis: "per_unit",
      defaultUnit: "m2",
    });
    await data.crew.update(actor, id, { phone: "0400 000 111" });
    expect(await data.crew.get(actor, id)).toMatchObject({
      name: "Aroha",
      phone: "0400 000 111",
      defaultUnit: "m2",
    });
    const e = await refusal(data.crew.update(actor, id, { type: "employee" }));
    expect(e.message).toBe("Only an ABN contractor can be registered for GST.");
  });
});

describe("pay runs and payouts", () => {
  it("approval is blocked by a missing rate (unless waived) and by Owner 2FA off", async () => {
    const { data, actor } = fakeSession("manager");
    const e = await refusal(data.payRuns.approve(actor, payRuns.review));
    expect([e.code, e.message]).toEqual(["conflict", "Fix the missing rate before you approve."]);
    const later = await refusal(data.payRuns.approve(actor, payRuns.current));
    expect(later.message).toBe("Approve the pay run for Mon 21 Sep – Sun 27 Sep first.");
    const blocked = fakeSession("owner", { demo: "blocked" });
    const b = await refusal(
      blocked.data.payRuns.approve(blocked.actor, payRuns.review, { waiveMissingRate: true }),
    );
    expect(b.message).toBe("Turn on two-factor before you approve a pay run.");
    const r = await data.payRuns.approve(actor, payRuns.review, { waiveMissingRate: true });
    expect(r.status).toBe("approved");
    const history = await data.audit.history(actor, { table: "pay_run", rowId: payRuns.review });
    expect(history[0]!.after).toMatchObject({ status: "approved", waivedMissingRate: true });
  });

  it("approve freezes lines, locks logs and credits the ledger: E15.1 Dima $1,482.00 → payment → $0.00", async () => {
    const { data, actor, store } = fakeSession("manager");
    await data.crew.setRate(actor, jakeLm);
    const draft = await data.payRuns.get(actor, payRuns.review);
    const approved = await data.payRuns.approve(actor, payRuns.review);
    expect([approved.status, approved.totals]).toEqual(["approved", draft.totals]);
    expect(approved.people.map((p) => p.totals)).toEqual(draft.people.map((p) => p.totals));
    const dima = approved.people.find((p) => p.name === "Dima")!;
    expect(dima.totals).toEqual({
      subtotalCents: 152000,
      gstCents: 15200,
      reimbursementsCents: 11000,
      totalCents: 178200,
    });
    const logIds = draft.people.flatMap((p) => p.lines.map((l) => l.logId));
    expect(
      store.tables.workLogs.filter((l) => logIds.includes(l.id)).every((l) => l.payRunId === payRuns.review),
    ).toBe(true);
    expect((await data.ledger.balances(actor)).find((b) => b.name === "Dima")!.balanceCents).toBe(148200);
    const paid = await data.ledger.recordPayout(actor, {
      crewMemberId: crew.dima,
      date: "2026-09-28",
      amountCents: 148200,
      kind: "payment",
      method: "bank_transfer",
      note: null,
    });
    expect(paid.balanceCents).toBe(0);
    expect(approved.canReopen).toBe(true);
  });

  it("editing a locked log makes an adjustment in the next draft (E8.1 shape); reopen unlocks and removes credits", async () => {
    const { data, actor } = fakeSession("manager");
    await data.crew.setRate(actor, jakeLm);
    await data.payRuns.approve(actor, payRuns.review);
    const run = await data.payRuns.get(actor, payRuns.review);
    const line = run.people.find((p) => p.name === "Jake")!.lines.find((l) => l.date === "2026-09-21")!;
    const r = await data.logs.editLog(actor, line.logId, { hours: 850 });
    const current = await data.payRuns.get(actor, payRuns.current);
    const adj = current.people.find((p) => p.name === "Jake")!.lines.find((l) => l.logId === r.ids[0])!;
    expect([adj.label, adj.hours, adj.amountCents]).toEqual([
      "adjustment",
      50,
      hourlyAmount(850, line.rateCents!) - hourlyAmount(800, line.rateCents!),
    ]);
    const reopened = await data.payRuns.reopen(actor, payRuns.review);
    expect(reopened.status).toBe("draft");
    expect((await data.ledger.balances(actor)).find((b) => b.name === "Dima")!.balanceCents).toBe(-30000);
  });

  it("reopen only while no later run is approved; the accountant can't approve", async () => {
    const { data, actor, as } = fakeSession("manager");
    const sep7 = seed.payRuns.find((r) => r.periodStart === "2026-09-07")!;
    expect((await refusal(data.payRuns.reopen(actor, sep7.id))).message).toBe(
      "A later pay run is approved. Reopen that one first.",
    );
    expect((await data.payRuns.reopen(actor, payRuns.lastApproved)).status).toBe("draft");
    const acct = as("accountant");
    expect((await refusal(acct.data.payRuns.approve(acct.actor, payRuns.review))).code).toBe("forbidden");
  });

  it("export CSV: approved runs only, bookkeeper columns, marks Exported; the accountant may export", async () => {
    const { data, actor, as } = fakeSession("manager");
    expect((await refusal(data.payRuns.exportCsv(actor, payRuns.review))).message).toBe(
      "Approve the pay run before you export it.",
    );
    await data.crew.setRate(actor, jakeLm);
    await data.payRuns.approve(actor, payRuns.review);
    const acct = as("accountant");
    const file = await acct.data.payRuns.exportCsv(acct.actor, payRuns.review);
    expect(file.filename).toBe("pay-run-2026-09-21-to-2026-09-27.csv");
    const lines = file.body.trim().split("\r\n");
    expect(lines[0]).toBe("Date,Person,ABN,Job,Stage,Basis,Qty,Unit,Hours,Rate,Amount,GST,Total");
    const dima = seed.crewMembers.find((c) => c.id === crew.dima)!;
    expect(lines).toContain(`2026-09-27,Dima,${dima.abn},,,Total,,,40.00,,1520.00,152.00,1782.00`);
    expect(lines.some((l) => l.includes("Reimbursement (") && l.includes(",110.00,"))).toBe(true);
    expect((await data.payRuns.get(actor, payRuns.review)).status).toBe("exported");
    const f = as("foreman");
    expect((await refusal(f.data.payRuns.exportCsv(f.actor, payRuns.review))).code).toBe("forbidden");
  });

  it("a shared statement link opens the statement", async () => {
    const { data, actor } = fakeSession("manager");
    const share = await data.payRuns.shareStatement(actor, payRuns.lastApproved, crew.dima);
    expect(share.token).toMatch(/^[0-9a-f]{64}$/);
    expect(share.path).toBe(`/s/${share.token}`);
    expect((await data.statements.open(share.token)).person.name).toBe("Dima");
    expect((await refusal(data.payRuns.shareStatement(actor, payRuns.review, crew.dima))).code).toBe(
      "conflict",
    );
  });
});

describe("settings", () => {
  it("on-cost change reprices job labour cost; the pay-period anchor must match the start day", async () => {
    const { data, actor } = fakeSession("owner");
    const view = await data.workspace.settings(actor);
    if (view.view !== "manager") throw new Error("manager view");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...settings } = view.settings;
    const before = (await data.projects.get(actor, projects.smith)) as ProjectDetailManager;
    await data.workspace.updateSettings(actor, { ...settings, onCostBp: 3000 });
    const after = (await data.projects.get(actor, projects.smith)) as ProjectDetailManager;
    expect(after.labour.actualCents).toBeGreaterThan(before.labour.actualCents);
    const e = await refusal(data.workspace.updateSettings(actor, { ...settings, payAnchor: "2026-09-29" }));
    expect(e.message).toBe("The pay period start date must be a Monday.");
  });

  it("levels, categories and templates", async () => {
    const { data, actor } = fakeSession("manager");
    const roofer = (await data.workspace.levels(actor)).find((l) => l.name === "Roofer")!;
    expect(
      (await data.workspace.saveLevel(actor, { id: roofer.id, name: "Roofer", floorRateCents: 3300 }))
        .floorRateCents,
    ).toBe(3300);
    const added = await data.workspace.saveCategory(actor, { id: null, name: "Tools", position: 10 });
    expect((await data.workspace.categories(actor)).map((x) => x.name)).toContain("Tools");
    expect(
      (await refusal(data.workspace.saveCategory(actor, { id: null, name: "tools", position: 11 }))).code,
    ).toBe("invalid");
    expect(added.name).toBe("Tools");
    const tpl = await data.workspace.saveTemplate(actor, {
      jobType: "repair",
      items: [
        { name: "Inspect", position: 1, defaultUnit: null, labourShareBp: 2000, materialsShareBp: 0 },
        { name: "Repair", position: 2, defaultUnit: null, labourShareBp: 8000, materialsShareBp: 10000 },
      ],
    });
    expect(tpl.items.map((i) => i.name)).toEqual(["Inspect", "Repair"]);
    expect(
      (
        await refusal(
          data.workspace.saveTemplate(actor, {
            jobType: "repair",
            items: [{ ...tpl.items[0]!, labourShareBp: 9000 }],
          }),
        )
      ).message,
    ).toBe("Labour shares must add up to 100%.");
  });

  it("members and roles are the Owner's; assignments open a job to the foreman", async () => {
    const { data, actor, as } = fakeSession("owner");
    const manager = as("manager");
    expect(
      (
        await refusal(
          manager.data.workspace.inviteMember(manager.actor, {
            email: "a@b.au",
            name: "Al",
            role: "foreman",
          }),
        )
      ).code,
    ).toBe("forbidden");
    const m = await data.workspace.inviteMember(actor, {
      email: "Sue@Harbour.au",
      name: "Sue",
      role: "accountant",
    });
    expect([m.email, m.role]).toEqual(["sue@harbour.au", "accountant"]);
    const owner = (await data.workspace.members(actor)).find((x) => x.role === "owner")!;
    expect((await refusal(data.workspace.setMemberRole(actor, owner.id, "manager"))).code).toBe("conflict");
    expect((await data.workspace.setMemberRole(actor, m.id, "manager")).role).toBe("manager");
    const craig = (await data.workspace.assignments(actor))[0]!;
    await manager.data.workspace.setAssignments(manager.actor, craig.memberId, [
      ...craig.projectIds,
      projects.rydeHeritage,
    ]);
    const f = as("foreman");
    const job = await f.data.projects.get(f.actor, projects.rydeHeritage);
    expect(job.view).toBe("foreman");
    expect(scanForMoney(job)).toEqual([]);
  });
});
