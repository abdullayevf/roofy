import type { DataContext } from "@/data";
import { isDataError, type ProjectList } from "@/data/contracts";
import type { JobFilter } from "@/components/screens/job-input";

export type JobsData =
  | { kind: "ok"; list: ProjectList; anyJobs: boolean }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

/** The jobs under one status filter, and whether the workspace has any job at all (for the empty-state wording). */
export async function loadJobs({ data, actor }: DataContext, filter: JobFilter): Promise<JobsData> {
  try {
    const list = await data.projects.list(actor, { status: filter });
    const anyJobs = list.rows.length > 0 || (filter !== "all" && (await data.projects.list(actor, { status: "all" })).rows.length > 0);
    return { kind: "ok", list, anyJobs };
  } catch (e) {
    if (isDataError(e) && e.code === "forbidden") return { kind: "forbidden" };
    if (isDataError(e) && e.code === "unavailable") return { kind: "unavailable" };
    throw e;
  }
}
