import { isDataError, type CrewDayDefaults } from "@/data/contracts";
import type { DataContext } from "@/data";
import type { SearchParams } from "@/data/session";
import { parseEntryPicks, parseLocalDate } from "@/components/screens/field-input";

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v) || undefined;

export type LogScreenData =
  | {
      kind: "ok";
      defaults: CrewDayDefaults;
      ticked: string[];
      picks: ReturnType<typeof parseEntryPicks>;
      /** The date was asked for in the address (an entry reopened from the outbox). */
      dateFromAddress: boolean;
      today: string;
      demo: string | undefined;
    }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

/**
 * What the Log grid needs: the day, job, stage, pre-ticked crew and each person's day or hours from the address
 * (`date`, `project`, `stage`, `crew`, `ex`), or `same=1` to open already filled from "Same as yesterday" (used by
 * the design captures, which can't know ids). A `date` that isn't a real date is ignored: the day is today.
 */
export async function loadLogScreen({ data, actor, today }: DataContext, params: SearchParams): Promise<LogScreenData> {
  try {
    const date = parseLocalDate(one(params.date)) ?? undefined;
    let query = { date, projectId: one(params.project), stageId: one(params.stage) };
    let ticked = one(params.crew)?.split(",").filter(Boolean) ?? [];
    if (one(params.same) === "1") {
      const same = (await data.logs.crewDayDefaults(actor)).sameAsYesterday;
      if (same) {
        query = { ...query, projectId: same.projectId, stageId: same.stageId };
        ticked = same.crewMemberIds;
      }
    }
    const defaults = await data.logs.crewDayDefaults(actor, query);
    return {
      kind: "ok",
      defaults,
      ticked,
      picks: parseEntryPicks(one(params.ex)),
      dateFromAddress: date !== undefined,
      today,
      demo: one(params.demo),
    };
  } catch (e) {
    if (isDataError(e) && e.code === "forbidden") return { kind: "forbidden" };
    if (isDataError(e) && e.code === "unavailable") return { kind: "unavailable" };
    throw e;
  }
}
