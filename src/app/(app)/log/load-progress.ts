import { isDataError, type ProgressDefaults } from "@/data/contracts";
import type { DataContext } from "@/data";
import type { SearchParams } from "@/data/session";
import type { ProgressStart } from "@/components/screens/log-progress";

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v) || undefined;
const list = (v: string | string[] | undefined): string[] => one(v)?.split(",").filter(Boolean) ?? [];

export type ProgressScreenData =
  | { kind: "ok"; defaults: ProgressDefaults; start: ProgressStart; demo: string | undefined }
  | { kind: "forbidden" };

/**
 * What the Progress screen needs. The address can fill it in (`stage`, `qty`, `crew`, `shares`): that is how
 * "Edit and resend" from the outbox reopens an entry.
 */
export async function loadProgressScreen({ data, actor }: DataContext, params: SearchParams): Promise<ProgressScreenData> {
  try {
    const defaults = await data.progress.defaults(actor);
    const wanted = one(params.stage);
    const pickable = defaults.projects.some((p) => p.stages.some((s) => s.id === wanted));
    const qty = Number(one(params.qty));
    const shares = list(params.shares).map(Number);
    return {
      kind: "ok",
      defaults,
      start: {
        stageId: pickable && wanted ? wanted : null,
        quantity: Number.isInteger(qty) && qty > 0 ? qty : null,
        crewMemberIds: list(params.crew).filter((id) => defaults.crew.some((c) => c.id === id)),
        shares: shares.length > 0 && shares.every(Number.isInteger) ? shares : null,
      },
      demo: one(params.demo),
    };
  } catch (e) {
    if (isDataError(e) && e.code === "forbidden") return { kind: "forbidden" };
    throw e;
  }
}
