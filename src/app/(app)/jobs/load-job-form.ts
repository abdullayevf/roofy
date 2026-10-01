import type { DataContext } from "@/data";
import { isDataError, type Client, type JobType, type StageProposal } from "@/data/contracts";
import { JOB_TYPES } from "@/components/screens/job-input";

export type JobFormData =
  | { kind: "ok"; clients: Client[]; proposals: Partial<Record<JobType, StageProposal | null>> }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

/**
 * What a job form needs: the clients to pick from and, for a new job, the stages proposed for each job type (last job of
 * that type, else the template). A job type with neither has no proposal (null; the clients above were allowed, so the refusal is the missing template) and the form lets the person add stages.
 */
export async function loadJobForm({ data, actor }: DataContext, withProposals: boolean): Promise<JobFormData> {
  try {
    const clients = await data.projects.clients(actor);
    const proposals: Partial<Record<JobType, StageProposal | null>> = {};
    if (withProposals) {
      for (const { value } of JOB_TYPES) {
        proposals[value] = await data.projects.proposeStages(actor, value).catch((e: unknown) => {
          if (isDataError(e) && e.code === "forbidden") return null;
          throw e;
        });
      }
    }
    return { kind: "ok", clients, proposals };
  } catch (e) {
    if (isDataError(e) && e.code === "forbidden") return { kind: "forbidden" };
    if (isDataError(e) && e.code === "unavailable") return { kind: "unavailable" };
    throw e;
  }
}
