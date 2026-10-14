/**
 * `getData()` — the one way pages, layouts, Server Functions and Route Handlers reach data.
 *
 * ```tsx
 * export default async function Page({ searchParams }: PageProps<"/jobs/[id]">) {
 *   const { data, actor, demo } = await getData({ searchParams });
 *   if (demo.loading) return <JobSkeleton />;            // ?demo=loading
 *   const job = await data.projects.get(actor, id);      // DataError → error.tsx / no-permission
 *   return job.view === "foreman" ? <JobField job={job} /> : <JobManager job={job} />;
 * }
 * ```
 *
 * Page contract for the demo states (fake mode only; see `./fake/demo.ts`):
 * - `demo.loading` → render the same skeleton the route's `loading.tsx` shows, instead of content.
 *   (A never-resolving Suspense child would keep the HTML response open, so `page.goto` in e2e and
 *   the design capture would never finish; returning the skeleton is the same pixels, finished.)
 * - `error` / `noperm` → every service call rejects with `DataError` "unavailable" / "forbidden":
 *   let "unavailable" reach the route's `error.tsx`; catch "forbidden" (`isDataError(e) &&
 *   e.code === "forbidden"`) and render the no-permission state. In production builds Next hides
 *   a Server Component's error message from `error.tsx`, so it shows the standard copy, not `e.message`.
 * - `demo.offline` → the layout shows the offline banner; `demo.outbox` → the outbox screen and the
 *   "N to send" badge. Layouts get no `searchParams`: call `getData()` with no argument there and
 *   the state comes from the `x-roofy-demo` header that `src/proxy.ts` copies from `?demo=`.
 *
 * `ROOFY_DATA` selects the implementation: "fake" (the prototype) or "db" (Postgres and Better Auth,
 * registered by `src/instrumentation.ts` through `./db-registry`). Unset means fake outside production
 * only; in production (`pnpm start`) set it explicitly. Anything else throws. In db mode there are no
 * demo states: `demo` flags are all off and `?demo=` is ignored; someone signed out (or without a
 * workspace yet) is redirected to `/sign-in` (or `/onboarding`).
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { todayIn } from "@/domain/dates";
import type { LocalDate } from "@/domain/types";
import type { Actor, AuthService, DataServices, OnboardingService, Role } from "./contracts";
import { fakeNow } from "./fake/clock";
import { demoFlags, parseDemoState, type DemoFlags } from "./fake/demo";
import { createFakeServices } from "./fake/services";
import { createFakeAuth } from "./fake/services/auth";
import { actorFor } from "./fake/services/context";
import { createFakeOnboarding, newWorkspaceTables } from "./fake/services/onboarding";
import { dbData } from "./db-registry";
import { emptyStore, FakeStore, getSeed, replaceSessionStore, sessionStore, sharedStore } from "./fake/store";
import { ensureDemoSession, readDemoParam, readSession, type SearchParamsInput } from "./session";

export type { DemoFlags } from "./fake/demo";
export { isLoadingDemo } from "./fake/demo";
export type { SearchParamsInput } from "./session";

export type DataMode = "fake" | "db";

/**
 * `ROOFY_DATA`. Unset or empty means "fake" outside production only (so `pnpm dev` needs no
 * `.env`); in production (`next start`) it must be set explicitly — playwright's webServer does.
 */
function rawMode(): string {
  return process.env.ROOFY_DATA || (process.env.NODE_ENV === "production" ? "" : "fake");
}

export function isFakeMode(): boolean {
  return rawMode() === "fake";
}

export function dataMode(): DataMode {
  const mode = rawMode();
  if (mode === "") {
    throw new Error(
      "ROOFY_DATA isn't set. Set ROOFY_DATA=db for the database or ROOFY_DATA=fake to run the prototype.",
    );
  }
  if (mode !== "fake" && mode !== "db") {
    throw new Error(`ROOFY_DATA="${mode}" isn't a data mode. Set ROOFY_DATA=db or ROOFY_DATA=fake.`);
  }
  return mode;
}

/** Db mode has no demo states (a fresh object each time: `outbox` is an array a caller could change). */
const noDemo = (): DemoFlags => ({ state: null, loading: false, offline: false, outbox: [] });

/** The db-mode request context, or a redirect for someone signed out or without a workspace (never returns then). */
async function dbContext(): Promise<WriteContext & { workspaceName: string }> {
  const ctx = await dbData().context(await headers());
  if ("redirect" in ctx) redirect(ctx.redirect);
  return { mode: "db", data: ctx.data, actor: ctx.actor, today: ctx.today, workspaceName: ctx.workspaceName };
}

async function dbOnboarding(): Promise<OnboardingContext> {
  const found = await dbData().onboarding(await headers());
  if ("redirect" in found) redirect(found.redirect);
  return { onboarding: found.service, actor: found.actor, demo: noDemo() };
}

export interface DataContext {
  mode: DataMode;
  /** Services bound to this request's store, clock and demo state. */
  data: DataServices;
  /** The signed-in person (prototype: from the `roofy_role` cookie; default manager). */
  actor: Actor;
  /** The work date in the workspace timezone. */
  today: LocalDate;
  demo: DemoFlags;
  /** The workspace name, readable even when every service call fails (`?demo=error`), for the shell. */
  workspaceName: string;
}

export async function getData(options: { searchParams?: SearchParamsInput } = {}): Promise<DataContext> {
  const mode = dataMode();
  if (mode === "db") return { ...(await dbContext()), demo: noDemo() };
  const session = await readSession();
  const state = parseDemoState(await readDemoParam(options.searchParams));
  const store =
    state === "empty"
      ? emptyStore()
      : session.demoSessionId === null
        ? sharedStore()
        : sessionStore(session.demoSessionId);
  const now = fakeNow();
  return {
    mode,
    data: createFakeServices(store, { now: () => now, demo: state }),
    actor: actorFor(store.tables, session.role),
    today: todayIn(store.tables.workspace.timezone, now),
    demo: demoFlags(state, store.tables, now),
    workspaceName: store.tables.workspace.name,
  };
}

/**
 * The `?demo=` flags alone, for pages that need no signed-in person (sign in, sign up). Never redirects:
 * in db mode it reads no session and answers all-off flags; in fake mode it is `getData()`'s `demo`.
 */
export async function getDemo(options: { searchParams?: SearchParamsInput } = {}): Promise<DemoFlags> {
  if (dataMode() === "db") return noDemo();
  return (await getData(options)).demo;
}

export interface WriteContext {
  mode: DataMode;
  data: DataServices;
  actor: Actor;
  today: LocalDate;
}

/**
 * Services for a write (fake mode): always the demo session's own store — never the shared, read-only
 * seed or `?demo=empty` — and no forced demo state, so a write lands where the session's next page
 * render (`getData()` with the same `roofy_demo` cookie) reads it back.
 */
export function writeContext(session: { role: Role; demoSessionId: string }): WriteContext {
  const mode = dataMode();
  const store = sessionStore(session.demoSessionId);
  const now = fakeNow();
  return {
    mode,
    data: createFakeServices(store, { now: () => now, demo: null }),
    actor: actorFor(store.tables, session.role),
    today: todayIn(store.tables.workspace.timezone, now),
  };
}

/**
 * `writeContext` for a Server Function: reads the role cookie and creates the demo-session cookie if
 * the browser has none (Server Functions may set cookies; Server Components may not).
 */
export async function getWriteData(): Promise<WriteContext> {
  if (dataMode() === "db") {
    const { mode, data, actor, today } = await dbContext();
    return { mode, data, actor, today };
  }
  const session = await readSession();
  const demoSessionId = await ensureDemoSession();
  return writeContext({ role: session.role, demoSessionId });
}

/** Sign in and sign up: there is no signed-in person yet, so no store, actor or demo state. */
export function getAuth(): AuthService {
  return dataMode() === "db" ? dbData().auth() : createFakeAuth();
}

export interface OnboardingContext {
  onboarding: OnboardingService;
  actor: Actor;
  demo: DemoFlags;
}

function onboardingOn(
  store: FakeStore,
  role: Role,
  demo: ReturnType<typeof parseDemoState>,
): OnboardingContext {
  const now = fakeNow();
  const data = createFakeServices(store, { now: () => now, demo: null });
  const onboarding = createFakeOnboarding(store, data, todayIn(store.tables.workspace.timezone, now));
  return { onboarding, actor: actorFor(store.tables, role), demo: demoFlags(demo, store.tables, now) };
}

/**
 * The set-up wizard for a page render: the demo session's workspace, or (no session yet) a new one that is
 * shown but never written. `?demo=error|noperm` refuse every call as elsewhere.
 */
export async function getOnboarding(
  options: { searchParams?: SearchParamsInput } = {},
): Promise<OnboardingContext> {
  if (dataMode() === "db") return dbOnboarding();
  const session = await readSession();
  const state = parseDemoState(await readDemoParam(options.searchParams));
  const store =
    session.demoSessionId === null
      ? new FakeStore(newWorkspaceTables(getSeed()), { readOnly: true })
      : sessionStore(session.demoSessionId);
  const ctx = onboardingOn(store, session.role, state);
  if (state === "error" || state === "noperm") {
    const refusal = createFakeServices(store, { now: fakeNow, demo: state }).workspace.settings;
    const refuse = () => refusal(ctx.actor) as never;
    ctx.onboarding = Object.fromEntries(
      Object.keys(ctx.onboarding).map((k) => [k, refuse]),
    ) as unknown as OnboardingService;
  }
  return ctx;
}

/** The set-up wizard for a Server Function: always the demo session's own, writable workspace. */
export async function getOnboardingWrite(): Promise<OnboardingContext> {
  if (dataMode() === "db") return dbOnboarding();
  const session = await readSession();
  const id = await ensureDemoSession();
  return onboardingOn(sessionStore(id), session.role, null);
}

/**
 * Sign-up (fake mode): the demo session becomes a new, empty workspace whose set-up wizard starts at the
 * beginning. In db mode the wizard creates the workspace, so there is nothing to do here.
 */
export async function startNewWorkspace(): Promise<void> {
  if (dataMode() === "db") return;
  replaceSessionStore(await ensureDemoSession(), newWorkspaceTables(getSeed()));
}
