/**
 * The seam between `src/data` and the real data layer. `src/data` must not import `@/server/*`, so the
 * server side registers itself here at start-up (`src/instrumentation.ts` → `registerDbData`) and
 * `getData()` / `getAuth()` / `getOnboarding*()` reach it through `dbData()` when `ROOFY_DATA=db`.
 */
import type { LocalDate } from "@/domain/types";
import type { Actor, AuthService, DataServices, OnboardingService } from "./contracts";

/** What a db-mode request gets: the signed-in person, their services and their workspace's work date. */
export interface DataContextCore {
  actor: Actor;
  data: DataServices;
  today: LocalDate;
  workspaceName: string;
}

export interface DbDataProvider {
  /** The request's actor and services, or where to send someone who is signed out or has no workspace yet. */
  context(h: Headers): Promise<DataContextCore | { redirect: "/sign-in" | "/onboarding" }>;
  auth(): AuthService;
  /** The set-up wizard, or where to send someone who is signed out or already in a workspace. */
  onboarding(h: Headers): Promise<{ actor: Actor; service: OnboardingService } | { redirect: "/sign-in" | "/" }>;
}

export const DB_DATA_NOT_REGISTERED = "The database data layer is not registered";

// On globalThis so the provider registered by instrumentation is the one every bundle (page, route,
// Server Function) sees, even if this module is evaluated more than once.
const KEY = Symbol.for("roofy.dbData");
type Holder = { [KEY]?: DbDataProvider };

export function registerDbData(provider: DbDataProvider | null): void {
  if (provider === null) delete (globalThis as Holder)[KEY];
  else (globalThis as Holder)[KEY] = provider;
}

export function dbData(): DbDataProvider {
  const provider = (globalThis as Holder)[KEY];
  if (!provider) throw new Error(DB_DATA_NOT_REGISTERED);
  return provider;
}
