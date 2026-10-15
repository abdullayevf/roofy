/**
 * The real services behind `getData()` in db mode. Each one arrives in its own task (workspace in
 * Task 11, onboarding and auth in Task 12, the rest in later phases); until then every method of a
 * service that isn't built yet rejects with `DataError("unavailable", "This part isn't ready yet.")`.
 *
 * The method lists below are checked against the contracts by `satisfies`: a method added to or
 * removed from a service interface fails the typecheck here until the list matches.
 */
import {
  DataError,
  type Actor,
  type AuthService,
  type DataServices,
  type OnboardingService,
} from "@/data/contracts";
import { createDbOnboarding } from "./onboarding";
import { createWorkspaceService } from "./workspace";

export { createDbOnboarding };
/** Sign in, sign up, email links, two-factor, invites and sign-out (Task 12 run 2). */
export { createDbAuth } from "./auth";

export const NOT_READY = "This part isn't ready yet.";

type MethodsOf<S> = { readonly [M in keyof S]-?: true };

export const DATA_SERVICE_METHODS = {
  workspace: {
    settings: true, updateSettings: true, levels: true, saveLevel: true, categories: true, saveCategory: true,
    templates: true, saveTemplate: true, members: true, inviteMember: true, setMemberRole: true,
    removeMember: true, assignments: true, setAssignments: true, turnOnTwoFactor: true,
  },
  projects: { list: true, get: true, proposeStages: true, create: true, update: true, updateStage: true, clients: true, createClient: true },
  stages: { get: true, start: true, pause: true, resume: true, doneProposal: true, confirmDone: true, reopen: true, setManualPct: true },
  crew: { list: true, get: true, create: true, update: true, rates: true, setRate: true },
  logs: {
    crewDayDefaults: true, sameAsYesterday: true, byDay: true, byPerson: true, byStage: true,
    saveCrewDay: true, editLog: true, deleteLog: true,
  },
  progress: { defaults: true, byStage: true, record: true },
  noWork: { list: true, record: true, remove: true },
  expenses: { list: true, get: true, create: true, update: true },
  payRuns: { list: true, get: true, draft: true, approve: true, reopen: true, exportCsv: true, statement: true, shareStatement: true },
  statements: { open: true },
  ledger: { balances: true, entries: true, recordPayout: true },
  reports: { jobProfitability: true, crew: true, productivity: true, pauses: true, payHistory: true, csv: true },
  home: { get: true },
  sync: { push: true, snapshot: true },
  audit: { history: true },
  exports: { listing: true, file: true },
} as const satisfies { [K in keyof DataServices]-?: MethodsOf<DataServices[K]> };

export const ONBOARDING_METHODS = {
  state: true, saveBusiness: true, chooseTrade: true, acceptDefaults: true, addCrew: true, finishCrew: true, back: true, finish: true,
} as const satisfies MethodsOf<OnboardingService>;

export const AUTH_METHODS = {
  signIn: true, signUp: true, continueWithGoogle: true, verifyEmail: true, requestPasswordReset: true,
  resetPassword: true, verifyTwoFactor: true, acceptInvite: true, inviteDetails: true,
  startTwoFactor: true, confirmTwoFactor: true, hasPassword: true,
} as const satisfies MethodsOf<AuthService>;

function notReady(): Promise<never> {
  return Promise.reject(new DataError("unavailable", NOT_READY));
}

/** A service whose every method rejects as not ready yet. */
function notReadyService<S>(methods: Readonly<Record<string, true>>): S {
  return Object.fromEntries(Object.keys(methods).map((m) => [m, notReady])) as S;
}

/**
 * The real services as they land; each reads `shapeAccess` (`@/server/authz`) for the access flags
 * it hands to screens. A service built in parts keeps not-ready placeholders for the rest.
 */
const BUILT: { [K in keyof DataServices]?: (actor: Actor) => DataServices[K] } = {
  workspace: () => ({
    ...notReadyService<DataServices["workspace"]>(DATA_SERVICE_METHODS.workspace),
    ...createWorkspaceService(),
  }),
};

export function createDbServices(actor: Actor): DataServices {
  const entries = (Object.keys(DATA_SERVICE_METHODS) as (keyof DataServices)[]).map((k) => {
    const build = BUILT[k] as ((a: Actor) => unknown) | undefined;
    return [k, build ? build(actor) : notReadyService(DATA_SERVICE_METHODS[k])];
  });
  return Object.fromEntries(entries) as DataServices;
}

