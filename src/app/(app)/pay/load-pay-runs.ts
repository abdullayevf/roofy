import type { DataContext } from "@/data";
import { isDataError, type PayFlag, type PayRunListItem } from "@/data/contracts";

export type PayRunsData =
  | { kind: "ok"; runs: PayRunListItem[]; reviewId: string | null; reviewFlags: PayFlag[] }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

/** Every pay run, and the draft to review now with its flags (the list item only says whether it is blocked). */
export async function loadPayRuns({ data, actor }: DataContext): Promise<PayRunsData> {
  try {
    const [runs, draft] = await Promise.all([data.payRuns.list(actor), data.payRuns.draft(actor)]);
    return { kind: "ok", runs, reviewId: draft?.id ?? null, reviewFlags: draft?.flags ?? [] };
  } catch (e) {
    if (isDataError(e) && e.code === "forbidden") return { kind: "forbidden" };
    if (isDataError(e) && e.code === "unavailable") return { kind: "unavailable" };
    throw e;
  }
}
