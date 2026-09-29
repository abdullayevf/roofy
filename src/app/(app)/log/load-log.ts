import { isDataError, type CrewDayDefaults } from "@/data/contracts";
import type { DataContext } from "@/data";
import type { SearchParams } from "@/data/session";

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v) || undefined;

export type LogScreenData =
  | { kind: "ok"; defaults: CrewDayDefaults; ticked: string[]; demo: string | undefined }
  | { kind: "forbidden" };

/**
 * What the Log grid needs: job, stage and pre-ticked crew from the address (`project`, `stage`, `crew`), or
 * `same=1` to open already filled from "Same as yesterday" (used by the design captures, which can't know ids).
 */
export async function loadLogScreen({ data, actor }: DataContext, params: SearchParams): Promise<LogScreenData> {
  try {
    let query = { projectId: one(params.project), stageId: one(params.stage) };
    let ticked = one(params.crew)?.split(",").filter(Boolean) ?? [];
    if (one(params.same) === "1") {
      const same = (await data.logs.crewDayDefaults(actor)).sameAsYesterday;
      if (same) {
        query = { projectId: same.projectId, stageId: same.stageId };
        ticked = same.crewMemberIds;
      }
    }
    const defaults = await data.logs.crewDayDefaults(actor, query);
    return { kind: "ok", defaults, ticked, demo: one(params.demo) };
  } catch (e) {
    if (isDataError(e) && e.code === "forbidden") return { kind: "forbidden" };
    throw e;
  }
}
