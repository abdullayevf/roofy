import { describe, expect, it } from "vitest";
import { getSeed, FakeStore } from "../store";
import { actorFor } from "./context";
import { createFakeServices } from "./index";
import { createFakeOnboarding, newWorkspaceTables } from "./onboarding";
import { TEST_NOW } from "./testing";

function fresh(role: "owner" | "manager" = "owner") {
  const store = new FakeStore(newWorkspaceTables(getSeed()), { readOnly: false });
  const data = createFakeServices(store, { now: () => TEST_NOW, demo: null });
  return { store, data, actor: actorFor(store.tables, role), onboarding: createFakeOnboarding(store, data, "2026-09-28") };
}

describe("fake onboarding", () => {
  it("starts a new workspace at the business step with no jobs, crew, templates or categories", async () => {
    const { onboarding, actor, store } = fresh();
    const state = await onboarding.state(actor);
    expect(state.step).toBe("business");
    expect(state.business).toEqual({ name: "", abn: "", gstRegistered: false });
    expect(store.tables.projects).toEqual([]);
    expect(store.tables.stageTemplates).toEqual([]);
    expect(store.tables.expenseCategories).toEqual([]);
  });

  it("refuses a blank name and a bad ABN field by field, and keeps the step", async () => {
    const { onboarding, actor } = fresh();
    await expect(onboarding.saveBusiness(actor, { name: "", abn: "12", gstRegistered: true })).rejects.toMatchObject({
      code: "invalid",
      issues: [
        { field: "name", message: "Add your business name." },
        { field: "abn", message: "ABN should be 11 digits." },
      ],
    });
    expect((await onboarding.state(actor)).step).toBe("business");
  });

  it("walks business, trade, defaults, crew and install, saving as it goes (resumable)", async () => {
    const { onboarding, actor, data } = fresh();
    let s = await onboarding.saveBusiness(actor, { name: "Smith Roofing", abn: "51 824 753 556", gstRegistered: true });
    expect(s.step).toBe("trade");
    expect((await onboarding.state(actor)).business).toEqual({ name: "Smith Roofing", abn: "51 824 753 556", gstRegistered: true });
    s = await onboarding.chooseTrade(actor, "roofing");
    expect(s.step).toBe("defaults");
    expect(s.defaults.templates.map((t) => t.name)).toContain("Metal re-roof");
    expect(s.defaults.categories.length).toBeGreaterThan(0);
    s = await onboarding.acceptDefaults(actor);
    expect(s.step).toBe("crew");
    expect((await data.workspace.templates(actor)).length).toBe(getSeed().stageTemplates.length);
    expect((await data.workspace.categories(actor)).length).toBe(getSeed().expenseCategories.length);
    s = await onboarding.addCrew(actor, { name: "Sam", type: "employee", levelId: null, basis: "daily", rateCents: 32000 });
    expect(s.crew).toMatchObject([{ name: "Sam", basis: "daily", rateCents: 32000 }]);
    expect(s.step).toBe("crew");
    s = await onboarding.finishCrew(actor);
    expect(s.step).toBe("install");
    s = await onboarding.back(actor);
    expect(s.step).toBe("crew");
    expect(s.crew).toHaveLength(1);
    await onboarding.finishCrew(actor);
    s = await onboarding.finish(actor);
    expect(s.step).toBe("done");
    expect((await data.crew.list(actor)).view).toBeDefined();
  });

  it("refuses a crew row with no rate", async () => {
    const { onboarding, actor } = fresh();
    await expect(
      onboarding.addCrew(actor, { name: "Sam", type: "employee", levelId: null, basis: "daily", rateCents: 0 }),
    ).rejects.toMatchObject({ code: "invalid", issues: [{ field: "rate", message: "Add a rate before adding." }] });
  });

  it("is the owner's alone", async () => {
    const { onboarding, actor } = fresh("manager");
    await expect(onboarding.state(actor)).rejects.toMatchObject({ code: "forbidden" });
  });
});
