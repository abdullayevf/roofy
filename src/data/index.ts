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
 * `ROOFY_DATA` selects the implementation: "fake" (Phase 2; also the default when unset, so
 * `pnpm dev`/`build`/`start` work without a `.env`). Any other value throws — the real data layer
 * arrives in Phase 3.
 */
import { todayIn } from "@/domain/dates";
import type { LocalDate } from "@/domain/types";
import type { Actor, DataServices } from "./contracts";
import { fakeNow } from "./fake/clock";
import { demoFlags, parseDemoState, type DemoFlags } from "./fake/demo";
import { createFakeServices } from "./fake/services";
import { actorFor } from "./fake/services/context";
import { emptyStore, sessionStore, sharedStore } from "./fake/store";
import { readDemoParam, readSession, type SearchParamsInput } from "./session";

export type { DemoFlags } from "./fake/demo";
export { isLoadingDemo } from "./fake/demo";
export type { SearchParamsInput } from "./session";

export type DataMode = "fake";

/** `ROOFY_DATA`, defaulting to "fake" while Phase 2 has no other implementation. */
function rawMode(): string {
  return process.env.ROOFY_DATA || "fake";
}

export function isFakeMode(): boolean {
  return rawMode() === "fake";
}

export function dataMode(): DataMode {
  const mode = rawMode();
  if (mode !== "fake") {
    throw new Error(
      `ROOFY_DATA="${mode}" isn't available yet: the real data layer arrives in Phase 3. Set ROOFY_DATA=fake.`,
    );
  }
  return mode;
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
}

export async function getData(options: { searchParams?: SearchParamsInput } = {}): Promise<DataContext> {
  const mode = dataMode();
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
  };
}
