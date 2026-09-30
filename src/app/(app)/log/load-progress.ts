import { isDataError, type ProgressDefaults } from "@/data/contracts";
import type { DataContext } from "@/data";
import type { SearchParams } from "@/data/session";
import type { ProgressStart } from "@/components/screens/log-progress";
import { parseLocalDate } from "@/components/screens/field-input";

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v) || undefined;
const list = (v: string | string[] | undefined): string[] => one(v)?.split(",").filter(Boolean) ?? [];

export type ProgressScreenData =
  | { kind: "ok"; defaults: ProgressDefaults; start: ProgressStart; today: string; demo: string | undefined }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

/**
 * What the Progress screen needs. The address can fill it in (`date`, `stage`, `qty`, `crew`, `shares`): that is
 * how "Edit and resend" from the outbox reopens an entry. A `date` that isn't a real date is ignored.
 */
export async function loadProgressScreen({ data, actor, today }: DataContext, params: SearchParams): Promise<ProgressScreenData> {
  try {
    const date = parseLocalDate(one(params.date)) ?? undefined;
    const first = await data.progress.defaults(actor, { date });
    const wanted = one(params.stage);
    const pickable = first.projects.some((p) => p.stages.some((s) => s.id === wanted));
    // With a stage asked for, the crew who worked on its job lead the list.
    const defaults = pickable && wanted ? await data.progress.defaults(actor, { date, stageId: wanted }) : first;
    const qty = Number(one(params.qty));
    const crewMemberIds = list(params.crew);
    // Shares line up with the crew as sent; keep a share only alongside the person it belongs to.
    const shares = list(params.shares).map(Number);
    const known = crewMemberIds.map((id, i) => ({ id, share: shares[i] })).filter((p) => defaults.crew.some((c) => c.id === p.id));
    const customShares = shares.length === crewMemberIds.length && shares.every(Number.isInteger);
    return {
      kind: "ok",
      defaults,
      start: {
        stageId: pickable && wanted ? wanted : null,
        quantity: Number.isInteger(qty) && qty > 0 ? qty : null,
        crewMemberIds: known.map((p) => p.id),
        shares: customShares && known.length > 0 ? known.map((p) => p.share!) : null,
      },
      today,
      demo: one(params.demo),
    };
  } catch (e) {
    if (isDataError(e) && e.code === "forbidden") return { kind: "forbidden" };
    if (isDataError(e) && e.code === "unavailable") return { kind: "unavailable" };
    throw e;
  }
}
