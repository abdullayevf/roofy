/**
 * The fake implementation of `DataServices` (plan Task 6: read side; Task 7 adds the writes),
 * bound to one store and one request's clock and demo state.
 */
import { DataError, type DataServices } from "../../contracts";
import type { FakeStore } from "../store";
import { FakeContext, NO_ACCESS, type ServiceOptions } from "./context";
import { createCrewService } from "./crew";
import { createExpenseService } from "./expenses";
import { createHomeService } from "./home";
import { createLogService, createNoWorkService, createProgressService } from "./logs";
import { createLedgerService, createPayRunService, createStatementLinkService } from "./pay";
import { createProjectService } from "./projects";
import { createAuditService, createExportService, createSyncService } from "./records";
import { createReportService } from "./reports";
import { createStageService } from "./stages";
import { createWorkspaceService } from "./workspace";

export const UNAVAILABLE = "Couldn't load this. Try again.";

/** `?demo=error` / `?demo=noperm`: every method rejects with the typed error the page renders. */
function forced(options: ServiceOptions): DataError | null {
  if (options.demo === "error") return new DataError("unavailable", UNAVAILABLE);
  if (options.demo === "noperm") return new DataError("forbidden", NO_ACCESS);
  return null;
}

function guard<T extends object>(service: T, options: ServiceOptions): T {
  const error = forced(options);
  if (error === null) return service;
  const out = {} as Record<string, unknown>;
  for (const key of Object.keys(service)) out[key] = async () => Promise.reject(error);
  return out as T;
}

export function createFakeServices(store: FakeStore, options: ServiceOptions): DataServices {
  const c = new FakeContext(store, options);
  const services: DataServices = {
    workspace: createWorkspaceService(c),
    projects: createProjectService(c),
    stages: createStageService(c),
    crew: createCrewService(c),
    logs: createLogService(c),
    progress: createProgressService(c),
    noWork: createNoWorkService(c),
    expenses: createExpenseService(c),
    payRuns: createPayRunService(c),
    statements: createStatementLinkService(c),
    ledger: createLedgerService(c),
    reports: createReportService(c),
    home: createHomeService(c),
    sync: createSyncService(c),
    audit: createAuditService(c),
    exports: createExportService(c),
  };
  return Object.fromEntries(
    Object.entries(services).map(([k, v]) => [k, guard(v as object, options)]),
  ) as unknown as DataServices;
}
