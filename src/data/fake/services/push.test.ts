/**
 * The fake push (architecture §7, Review Focus 4): a mutation id is applied once; repeats return the
 * stored result; warnings are flags on an applied result; rejections say how to fix it.
 */
import { describe, expect, it } from "vitest";
import { v7 as uuidv7 } from "uuid";
import { DataError, type MutationEnvelope, type MutationPayloads, type MutationType } from "../../contracts";
import { scanForMoney } from "../../dto";
import { getSeed } from "../store";
import { OTHER_ACCOUNT } from "./records";
import { fakeSession } from "./testing";

const { meta } = getSeed();
const { crew, stages, projects } = meta;

function m<T extends MutationType>(type: T, payload: MutationPayloads[T]): MutationEnvelope {
  return {
    id: uuidv7(),
    type,
    schemaVersion: 1,
    appVersion: "0.1.0",
    createdAt: "2026-09-27T21:00:00.000Z",
    payload,
  } as MutationEnvelope;
}

const crewDay = (date = "2026-09-28", stageId = stages.smithSheetInstall, projectId = projects.smith) =>
  m("crew_day", {
    date,
    projectId,
    stageId,
    entries: [{ crewMemberId: crew.jake, basis: "hourly", days: null, hours: 800, multiplier: null }],
  });

describe("push", () => {
  it("the same id twice: one set of logs, identical response", async () => {
    const { data, actor, store } = fakeSession("manager");
    const entry = crewDay();
    const first = await data.sync.push(actor, { mutations: [entry] });
    const count = store.tables.workLogs.length;
    const second = await data.sync.push(actor, { mutations: [entry] });
    expect(second).toEqual(first);
    expect(first.results[0]).toMatchObject({ id: entry.id, status: "applied", result: { flags: [] } });
    expect(store.tables.workLogs.length).toBe(count);
    expect(store.tables.workLogs.filter((l) => l.mutationId === entry.id)).toHaveLength(1);
    // Within one batch too.
    const again = await data.sync.push(actor, { mutations: [entry, entry] });
    expect(again.results).toEqual([first.results[0], first.results[0]]);
    expect(store.tables.workLogs.length).toBe(count);
  });

  it("applies a batch in order: pause then resume the same stage", async () => {
    const { data, actor } = fakeSession("foreman");
    const res = await data.sync.push(actor, {
      mutations: [
        m("stage_pause", {
          stageId: stages.smithSheetInstall,
          date: "2026-09-29",
          reason: "weather",
          note: null,
        }),
        m("stage_resume", { stageId: stages.smithSheetInstall, date: "2026-10-01" }),
      ],
    });
    expect(res.results.map((r) => r.status)).toEqual(["applied", "applied"]);
    expect((await data.stages.get(actor, stages.smithSheetInstall)).segments).toHaveLength(2);
  });

  it("business warnings are applied with flags, never rejected", async () => {
    const { data, actor } = fakeSession("manager");
    const res = await data.sync.push(actor, {
      mutations: [
        crewDay("2026-09-28", stages.rydeCoat, projects.rydeHeritage),
        crewDay("2026-09-16", stages.rydeRepairs, projects.rydeHeritage),
        m("crew_day", {
          date: "2026-09-25",
          projectId: projects.smith,
          stageId: stages.smithSheetInstall,
          entries: [{ crewMemberId: crew.sam, basis: "time_only", days: null, hours: 800, multiplier: null }],
        }),
        m("crew_day", {
          date: "2026-09-28",
          projectId: projects.smith,
          stageId: stages.smithSheetInstall,
          entries: [{ crewMemberId: crew.ben, basis: "daily", days: 100, hours: 0, multiplier: null }],
        }),
      ],
    });
    expect(res.results.map((r) => (r.status === "applied" ? r.result.flags : r.status))).toEqual([
      ["paused_stage"],
      ["late_entry"],
      ["possible_duplicate"],
      ["missing_rate"],
    ]);
  });

  it("a foreman posting to a job he isn't assigned to is rejected forbidden, money-free", async () => {
    const { data, actor } = fakeSession("foreman");
    const entry = crewDay("2026-09-28", stages.rydeRepairs, projects.rydeHeritage);
    const res = await data.sync.push(actor, { mutations: [entry] });
    expect(res.results[0]).toEqual({
      id: entry.id,
      status: "rejected",
      code: "forbidden",
      message: "You don't have access to this. Ask your manager.",
    });
    expect(scanForMoney(res)).toEqual([]);
  });

  it("a foreman's applied results never carry pay-only flags", async () => {
    const { data, actor } = fakeSession("foreman");
    const res = await data.sync.push(actor, {
      mutations: [
        m("crew_day", {
          date: "2026-09-16",
          projectId: projects.smith,
          stageId: stages.smithSheetInstall,
          entries: [{ crewMemberId: crew.ben, basis: "daily", days: 100, hours: 0, multiplier: null }],
        }),
      ],
    });
    const r = res.results[0]!;
    if (r.status !== "applied") throw new Error("expected applied");
    expect(r.result.flags).not.toContain("missing_rate");
    expect(r.result.flags).not.toContain("late_entry");
  });

  it("an invalid payload is rejected with a plain message; the rest of the batch still applies", async () => {
    const { data, actor } = fakeSession("manager");
    const bad = m("progress", {
      stageId: stages.smithSheetInstall,
      date: "2026-09-28",
      quantity: 12000,
      crewMemberIds: [crew.sam, crew.dima],
      shares: { mode: "custom", bp: [5000, 4200] },
      photoFileId: null,
      note: null,
    });
    const good = crewDay();
    const res = await data.sync.push(actor, { mutations: [bad, good] });
    expect(res.results).toEqual([
      {
        id: bad.id,
        status: "rejected",
        code: "invalid",
        message: "Shares must add up to 100%. Currently 92%.",
      },
      expect.objectContaining({ id: good.id, status: "applied" }),
    ]);
  });

  it("a rejection isn't stored: the edited entry, resent with the same id, applies", async () => {
    const { data, actor } = fakeSession("manager");
    const entry = crewDay("2026-09-28", stages.rydeCoat, projects.smith);
    const first = await data.sync.push(actor, { mutations: [entry] });
    expect(first.results[0]!.status).toBe("rejected");
    const fixed = {
      ...entry,
      payload: { ...entry.payload, stageId: stages.smithSheetInstall },
    } as MutationEnvelope;
    expect((await data.sync.push(actor, { mutations: [fixed] })).results[0]!.status).toBe("applied");
  });

  it("an id already sent by someone else is refused, not replayed", async () => {
    const { data, actor, as } = fakeSession("manager");
    const entry = crewDay();
    await data.sync.push(actor, { mutations: [entry] });
    const foreman = as("foreman");
    expect((await foreman.data.sync.push(foreman.actor, { mutations: [entry] })).results[0]).toEqual({
      id: entry.id,
      status: "rejected",
      code: "conflict",
      message: OTHER_ACCOUNT,
    });
  });

  it("more than 25 mutations is refused as a whole", async () => {
    const { data, actor } = fakeSession("manager");
    const e = await data.sync.push(actor, { mutations: Array.from({ length: 26 }, () => crewDay()) }).then(
      () => null,
      (x: unknown) => x,
    );
    expect(e).toBeInstanceOf(DataError);
    expect((e as DataError).message).toBe("Send at most 25 entries at a time.");
  });

  it("an unexpected failure answers retry (the phone keeps the entry)", async () => {
    const { data, actor, store } = fakeSession("manager");
    const write = store.write.bind(store);
    store.write = () => {
      throw new Error("disk full");
    };
    const entry = crewDay();
    expect((await data.sync.push(actor, { mutations: [entry] })).results[0]).toEqual({
      id: entry.id,
      status: "retry",
    });
    store.write = write;
    expect((await data.sync.push(actor, { mutations: [entry] })).results[0]!.status).toBe("applied");
  });

  it("the accountant can't send field entries", async () => {
    const { data, actor } = fakeSession("accountant");
    expect((await data.sync.push(actor, { mutations: [crewDay()] })).results[0]).toMatchObject({
      status: "rejected",
      code: "forbidden",
    });
  });
});
