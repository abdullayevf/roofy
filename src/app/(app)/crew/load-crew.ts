import type { DataContext } from "@/data";
import { isDataError, type CrewList } from "@/data/contracts";

export type CrewData =
  | { kind: "ok"; list: CrewList; anyCrew: boolean }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

/** The crew under one filter, and whether the workspace has anyone at all (for the empty-state wording). */
export async function loadCrew({ data, actor }: DataContext, includeInactive: boolean): Promise<CrewData> {
  try {
    // One read of everyone: the All filter shows it, Active keeps the active rows, and either way
    // it says whether the workspace has any crew at all.
    const everyone = await data.crew.list(actor, { includeInactive: true });
    const list = includeInactive ? everyone : ({ ...everyone, rows: everyone.rows.filter((r) => r.active) } as CrewList);
    return { kind: "ok", list, anyCrew: everyone.rows.length > 0 };
  } catch (e) {
    if (isDataError(e) && e.code === "forbidden") return { kind: "forbidden" };
    if (isDataError(e) && e.code === "unavailable") return { kind: "unavailable" };
    throw e;
  }
}
