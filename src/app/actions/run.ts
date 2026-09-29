/**
 * The admin Server Functions' shared runner (plain module — only `async` exports may live in the
 * `"use server"` files beside it). Each action: validate every argument with zod → act as the
 * signed-in person on the demo session's store (`getWriteData`) → revalidate the affected routes →
 * a typed `ActionResult`. Expected refusals (`DataError`) come back as `{ ok: false, code, message }`;
 * anything else as "unavailable", so a form always has a sentence to show.
 *
 * Location: `src/app/actions/*` (route groups don't exist yet; screens import from here).
 */
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { getWriteData, type WriteContext } from "@/data";
import { isDataError, type ActionResult } from "@/data/contracts";
import { fieldIssues, firstIssue } from "@/data/mutations";

export const SAVE_FAILED = "Couldn't save this. Try again.";

/** A route to refresh after a write: a literal path, or a pattern with `layout` for everything under it. */
export type Revalidate = readonly [path: string, type?: "page" | "layout"];

/** Screen groups from `docs/design/flows.md` (routes may land later; revalidating them early is harmless). */
export const PATHS = {
  home: ["/", "page"],
  jobs: ["/jobs", "layout"],
  log: ["/log", "layout"],
  crew: ["/crew", "layout"],
  expenses: ["/expenses", "layout"],
  pay: ["/pay", "layout"],
  reports: ["/reports", "layout"],
  history: ["/history", "page"],
  settings: ["/settings", "layout"],
  everything: ["/", "layout"],
} as const satisfies Record<string, Revalidate>;

type Schemas<A extends unknown[]> = { [K in keyof A]: z.ZodType<A[K]> };

export async function act<A extends unknown[], T extends object>(
  schemas: Schemas<A>,
  args: readonly unknown[],
  work: (ctx: WriteContext, ...args: A) => Promise<T>,
  paths: readonly Revalidate[],
): Promise<ActionResult<T>> {
  const parsed: unknown[] = [];
  for (let i = 0; i < schemas.length; i++) {
    const r = (schemas[i] as z.ZodType).safeParse(args[i]);
    if (!r.success)
      return { ok: false, code: "invalid", message: firstIssue(r.error), issues: fieldIssues(r.error) };
    parsed.push(r.data);
  }
  let result: T;
  try {
    result = await work(await getWriteData(), ...(parsed as A));
  } catch (e) {
    if (isDataError(e)) return { ok: false, code: e.code, message: e.message, issues: [...e.issues] };
    console.error(e);
    return { ok: false, code: "unavailable", message: SAVE_FAILED, issues: [] };
  }
  for (const [path, type] of paths) revalidatePath(path, type);
  return { ok: true, ...result };
}
