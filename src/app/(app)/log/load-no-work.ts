import { addDays } from "@/domain/dates";
import { isDataError, type CrewDayDefaults, type NoWorkReason } from "@/data/contracts";
import type { DataContext } from "@/data";
import type { SearchParams } from "@/data/session";

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v) || undefined;
const REASONS: readonly NoWorkReason[] = ["rain", "leave", "sick", "other"];

export type NoWorkScreenData =
  | {
      kind: "ok";
      defaults: CrewDayDefaults;
      today: string;
      start: { crewMemberIds: string[]; reason: NoWorkReason | null };
      demo: string | undefined;
    }
  | { kind: "forbidden" };

/** What the No-work screen needs: the day (`day=yesterday`, else today), and any people and reason from the address. */
export async function loadNoWorkScreen({ data, actor, today }: DataContext, params: SearchParams): Promise<NoWorkScreenData> {
  try {
    const date = one(params.day) === "yesterday" ? addDays(today, -1) : today;
    const defaults = await data.logs.crewDayDefaults(actor, { date });
    const reason = one(params.reason);
    return {
      kind: "ok",
      defaults,
      today,
      start: {
        crewMemberIds: (one(params.crew)?.split(",") ?? []).filter((id) => defaults.crew.some((c) => c.crewMemberId === id)),
        reason: REASONS.find((r) => r === reason) ?? null,
      },
      demo: one(params.demo),
    };
  } catch (e) {
    if (isDataError(e) && e.code === "forbidden") return { kind: "forbidden" };
    throw e;
  }
}
