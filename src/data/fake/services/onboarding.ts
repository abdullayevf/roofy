/**
 * Fake set-up wizard (prototype). A new workspace starts with no jobs, crew, templates or categories; each step
 * saves through the ordinary services (workspace settings, templates, categories, crew and rates) and records
 * where the wizard is in the store's meta, so a reload resumes at the same step with the same entries.
 */
import {
  DataError,
  ONBOARDING_STEPS,
  type Actor,
  type DataServices,
  type FieldIssue,
  type OnboardingService,
  type OnboardingState,
  type OnboardingStep,
} from "../../contracts";
import type { LocalDate } from "@/domain/types";
import { businessProblems, crewRowProblems } from "@/lib/onboarding-input";
import { fakeNow } from "../clock";
import type { Seed } from "../seed";
import { buildEmptyTables, type FakeStore, sharedStore } from "../store";
import { actorFor, NO_ACCESS } from "./context";
import { createFakeServices } from "./index";

/** A workspace that has just signed up: the seed's people and levels, nothing else, wizard at the start. */
export function newWorkspaceTables(seed: Seed): Seed {
  const base = structuredClone(buildEmptyTables(seed));
  return {
    ...base,
    workspace: { ...base.workspace, name: "", abn: "", gstRegistered: false },
    stageTemplates: [],
    stageTemplateItems: [],
    expenseCategories: [],
    meta: { ...base.meta, onboarding: { step: "business", trade: null } },
  };
}

function refuse(issues: FieldIssue[]): never {
  throw new DataError("invalid", issues[0]!.message, issues);
}

export function createFakeOnboarding(store: FakeStore, data: DataServices, today: LocalDate): OnboardingService {
  const seedData = createFakeServices(sharedStore(), { now: fakeNow, demo: null });
  const seedOwner = actorFor(sharedStore().tables, "owner");
  const meta = () => store.tables.meta.onboarding ?? { step: "done" as OnboardingStep, trade: null };
  const go = (step: OnboardingStep, trade = meta().trade) =>
    store.write((t) => {
      t.meta.onboarding = { step, trade };
    });

  function owner(actor: Actor): void {
    if (actor.role !== "owner") throw new DataError("forbidden", NO_ACCESS);
  }

  async function state(actor: Actor): Promise<OnboardingState> {
    owner(actor);
    const w = store.tables.workspace;
    const [templates, categories, levels] = await Promise.all([
      seedData.workspace.templates(seedOwner),
      seedData.workspace.categories(seedOwner),
      data.workspace.levels(actor),
    ]);
    const levelName = new Map(levels.map((l) => [l.id, l.name]));
    const rows = store.tables.crewMembers.map((m) => {
      const rate = store.tables.rates.find((r) => r.crewMemberId === m.id && r.projectId === null);
      return {
        id: m.id,
        name: m.name,
        type: m.type,
        levelName: m.levelId === null ? null : (levelName.get(m.levelId) ?? null),
        basis: m.defaultBasis === "hourly" ? ("hourly" as const) : ("daily" as const),
        rateCents: rate?.amountCents ?? 0,
      };
    });
    return {
      step: meta().step,
      business: { name: w.name, abn: w.abn, gstRegistered: w.gstRegistered },
      trade: meta().trade,
      defaults: {
        templates: templates.map((t) => ({ jobType: t.jobType, name: t.name, stages: t.items.length })),
        categories: categories.map((c) => c.name),
      },
      levels: levels.map((l) => ({ id: l.id, name: l.name })),
      crew: rows,
    };
  }

  return {
    state,
    async saveBusiness(actor, input) {
      owner(actor);
      const p = businessProblems(input);
      const issues: FieldIssue[] = [];
      if (p.name) issues.push({ field: "name", message: p.name });
      if (p.abn) issues.push({ field: "abn", message: p.abn });
      if (issues.length > 0) refuse(issues);
      const view = await data.workspace.settings(actor);
      if (view.view !== "manager") throw new DataError("forbidden", NO_ACCESS);
      const { id, ...settings } = view.settings;
      void id; // the id is not a setting to update
      await data.workspace.updateSettings(actor, {
        ...settings,
        name: input.name.trim(),
        abn: input.abn.trim(),
        gstRegistered: input.gstRegistered,
      });
      go("trade");
      return state(actor);
    },
    async chooseTrade(actor, trade) {
      owner(actor);
      go("defaults", trade);
      return state(actor);
    },
    async acceptDefaults(actor) {
      owner(actor);
      if ((await data.workspace.templates(actor)).length === 0) {
        for (const t of await seedData.workspace.templates(seedOwner))
          await data.workspace.saveTemplate(actor, { jobType: t.jobType, items: t.items });
        for (const c of await seedData.workspace.categories(seedOwner))
          await data.workspace.saveCategory(actor, { id: null, name: c.name, position: c.position });
      }
      go("crew");
      return state(actor);
    },
    async addCrew(actor, input) {
      owner(actor);
      const p = crewRowProblems(input);
      const issues: FieldIssue[] = [];
      if (p.name) issues.push({ field: "name", message: p.name });
      if (p.rate) issues.push({ field: "rate", message: p.rate });
      if (issues.length > 0) refuse(issues);
      const { id } = await data.crew.create(actor, {
        name: input.name.trim(),
        phone: null,
        type: input.type,
        levelId: input.type === "employee" ? input.levelId : null,
        abn: null,
        gstRegistered: false,
        activeFrom: today,
        activeTo: null,
        defaultBasis: input.basis,
        defaultUnit: null,
      });
      await data.crew.setRate(actor, {
        crewMemberId: id,
        basis: input.basis,
        unit: null,
        amountCents: input.rateCents,
        effectiveFrom: today,
        projectId: null,
      });
      return state(actor);
    },
    async finishCrew(actor) {
      owner(actor);
      go("install");
      return state(actor);
    },
    async back(actor) {
      owner(actor);
      const at = ONBOARDING_STEPS.indexOf(meta().step);
      if (at > 0) go(ONBOARDING_STEPS[at - 1]!);
      return state(actor);
    },
    async finish(actor) {
      owner(actor);
      go("done");
      return state(actor);
    },
  };
}
