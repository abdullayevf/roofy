import { describe, expect, it } from "vitest";
import type { StageDraft, StageProposal } from "@/data/contracts";
import {
  finishProblem,
  jobMissing,
  missingSentence,
  parseJobPrefill,
  parseStatusFilter,
  proposalSource,
  renumber,
  statusEmptyMessage,
} from "./job-input";

const base = {
  clientId: "c1",
  jobType: "metal_reroof" as const,
  nickname: "Smith job",
  siteAddress: "12 Quarry Rd, Ryde",
  contractCents: null,
  status: "active" as const,
  startDate: "",
  targetFinish: "",
};

describe("jobMissing", () => {
  it("names nothing when everything is filled in and the stages are accepted", () => {
    expect(jobMissing(base, { needStages: true, stagesAccepted: true })).toEqual([]);
  });
  it("names only what is missing, in form order", () => {
    expect(jobMissing({ ...base, clientId: "", nickname: " ", jobType: "" }, { needStages: true, stagesAccepted: false })).toEqual([
      "choose a client",
      "choose a job type",
      "name the job",
      "accept the stages",
    ]);
  });
  it("asks for the site address", () => {
    expect(jobMissing({ ...base, siteAddress: "" }, { needStages: false, stagesAccepted: false })).toEqual(["add the site address"]);
  });
  it("does not ask for stages when editing", () => {
    expect(jobMissing(base, { needStages: false, stagesAccepted: false })).toEqual([]);
  });
  it("names a finish that is before the start", () => {
    expect(jobMissing({ ...base, startDate: "2026-10-05", targetFinish: "2026-10-01" }, { needStages: false, stagesAccepted: false })).toEqual([
      "move the target finish to after the start",
    ]);
  });
});

describe("missingSentence", () => {
  it("is undefined when nothing is missing", () => expect(missingSentence([])).toBeUndefined());
  it("capitalises one item and ends with a full stop", () => expect(missingSentence(["choose a client"])).toBe("Choose a client."));
  it("joins two with 'and'", () => expect(missingSentence(["choose a client", "name the job"])).toBe("Choose a client and name the job."));
  it("joins three with commas and 'and'", () =>
    expect(missingSentence(["choose a client", "name the job", "add the site address"])).toBe("Choose a client, name the job and add the site address."));
});

describe("finishProblem", () => {
  it("is null when either date is blank or the order is right", () => {
    expect(finishProblem("", "2026-10-01")).toBeNull();
    expect(finishProblem("2026-10-01", "")).toBeNull();
    expect(finishProblem("2026-10-01", "2026-10-01")).toBeNull();
    expect(finishProblem("2026-10-01", "2026-11-01")).toBeNull();
  });
  it("says what is wrong when the finish is first", () => {
    expect(finishProblem("2026-10-05", "2026-10-01")).toBe("The target finish can't be before the start.");
  });
});

describe("parseStatusFilter", () => {
  it("defaults to active", () => {
    expect(parseStatusFilter(undefined)).toBe("active");
    expect(parseStatusFilter("nonsense")).toBe("active");
  });
  it("accepts every status and all", () => {
    for (const s of ["active", "quoted", "on_hold", "complete", "closed", "all"]) expect(parseStatusFilter(s)).toBe(s);
  });
  it("takes the first of a repeated value", () => expect(parseStatusFilter(["closed", "all"])).toBe("closed"));
});

describe("statusEmptyMessage", () => {
  it("says which kind of job there are none of", () => {
    expect(statusEmptyMessage("active")).toBe("No active jobs right now.");
    expect(statusEmptyMessage("on_hold")).toBe("No jobs on hold.");
    expect(statusEmptyMessage("quoted")).toBe("No quoted jobs.");
    expect(statusEmptyMessage("complete")).toBe("No complete jobs.");
    expect(statusEmptyMessage("closed")).toBe("No closed jobs.");
  });
});

describe("proposalSource", () => {
  const stages: StageDraft[] = [];
  it("names the last job of that type", () => {
    const p: StageProposal = {
      jobType: "metal_reroof",
      source: { kind: "last_job", projectId: "p1", projectName: "Smith job — Ryde re-roof" },
      stages,
    };
    expect(proposalSource(p)).toBe("From your last metal re-roof job, Smith job — Ryde re-roof.");
  });
  it("names the template when there is no earlier job", () => {
    const p: StageProposal = { jobType: "new_build", source: { kind: "template", templateId: "t1" }, stages };
    expect(proposalSource(p)).toBe("From the new build template.");
  });
});

describe("renumber", () => {
  it("numbers stages from 1 in the order given", () => {
    const d = (name: string, position: number): StageDraft => ({
      name,
      position,
      unit: null,
      plannedQuantity: null,
      labourBudgetCents: 0,
      materialsBudgetCents: 0,
      lumpSumCents: null,
    });
    expect(renumber([d("A", 4), d("B", 9)]).map((s) => [s.name, s.position])).toEqual([
      ["A", 1],
      ["B", 2],
    ]);
  });
});

describe("parseJobPrefill", () => {
  const clients = new Set(["c1"]);
  it("reads a full address", () => {
    expect(
      parseJobPrefill(
        { client: "c1", type: "tile_reroof", name: "Harris job", address: "3 Elm St", contract: "1250000", status: "quoted", start: "2026-10-05", finish: "2026-10-01", accepted: "1" },
        clients,
      ),
    ).toEqual({
      clientId: "c1",
      jobType: "tile_reroof",
      nickname: "Harris job",
      siteAddress: "3 Elm St",
      contractCents: 1250000,
      status: "quoted",
      startDate: "2026-10-05",
      targetFinish: "2026-10-01",
      accepted: true,
    });
  });
  it("ignores anything that is not real", () => {
    expect(parseJobPrefill({ client: "nope", type: "shed", contract: "-5", status: "x", start: "2026-02-30", accepted: "yes" }, clients)).toEqual({
      clientId: "",
      jobType: "",
      nickname: "",
      siteAddress: "",
      contractCents: null,
      status: "active",
      startDate: "",
      targetFinish: "",
      accepted: false,
    });
  });
});
