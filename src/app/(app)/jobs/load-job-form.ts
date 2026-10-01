import type { DataContext } from "@/data";
import { isDataError, type Client, type JobType, type StageProposal } from "@/data/contracts";
import { JOB_TYPES } from "@/components/screens/job-input";

export type JobFormData =
  | { kind: "ok"; clients: Client[]; proposals: Partial<Record<JobType, StageProposal | null>> }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

/**
 * What a job form needs: the clients to pick from and, for a new job, the stages proposed for each job type (last job of
 * that type, else the template; null when there is neither, and the form lets the person add stages). A refusal from
 * either call is a real permission refusal and says so.
 */
export async function loadJobForm({ data, actor }: DataContext, withProposals: boolean): Promise<JobFormData> {
  try {
    const [clients, found] = await Promise.all([
      data.projects.clients(actor),
      withProposals ? Promise.all(JOB_TYPES.map(({ value }) => data.projects.proposeStages(actor, value))) : Promise.resolve([]),
    ]);
    const proposals: Partial<Record<JobType, StageProposal | null>> = {};
    JOB_TYPES.forEach(({ value }, i) => {
      proposals[value] = found[i] ?? null;
    });
    return { kind: "ok", clients, proposals };
  } catch (e) {
    if (isDataError(e) && e.code === "forbidden") return { kind: "forbidden" };
    if (isDataError(e) && e.code === "unavailable") return { kind: "unavailable" };
    throw e;
  }
}
