import type { DataContext } from "@/data";
import { isDataError, type CrewList } from "@/data/contracts";

export type CrewData =
  | { kind: "ok"; list: CrewList; anyCrew: boolean }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

/** The crew under one filter, and whether the workspace has anyone at all (for the empty-state wording). */
export async function loadCrew({ data, actor }: DataContext, includeInactive: boolean): Promise<CrewData> {
  try {
    const list = await data.crew.list(actor, { includeInactive });
    const anyCrew = list.rows.length > 0 || (!includeInactive && (await data.crew.list(actor, { includeInactive: true })).rows.length > 0);
    return { kind: "ok", list, anyCrew };
  } catch (e) {
    if (isDataError(e) && e.code === "forbidden") return { kind: "forbidden" };
    if (isDataError(e) && e.code === "unavailable") return { kind: "unavailable" };
    throw e;
  }
}
