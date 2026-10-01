import { describe, expect, it } from "vitest";
import type { StageDraft, StageProposal } from "@/data/contracts";
import {
  finishProblem,
  jobAlertText,
  jobLine,
  jobMissing,
  jobNameFor,
  lastLogOn,
  overBudgetJobs,
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
      "accept the stages",
    ]);
  });
  it("does not ask for a job name: the site address names the job (R1)", () => {
    expect(jobMissing({ ...base, nickname: "" }, { needStages: false, stagesAccepted: false })).toEqual([]);
    expect(jobNameFor({ nickname: "  ", siteAddress: " 14 Quarry Rd, Ryde " })).toBe("14 Quarry Rd, Ryde");
    expect(jobNameFor({ nickname: " Smith job ", siteAddress: "14 Quarry Rd" })).toBe("Smith job");
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
  it("joins two with 'and'", () => expect(missingSentence(["choose a client", "add the site address"])).toBe("Choose a client and add the site address."));
  it("joins three with commas and 'and'", () =>
    expect(missingSentence(["choose a client", "choose a job type", "add the site address"])).toBe("Choose a client, choose a job type and add the site address."));
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

describe("jobAlertText (i1-F1: the sentence names the stage its amount belongs to)", () => {
  it("red: the stage is over by its own amount", () => {
    expect(jobAlertText({ level: "over", byCents: 10000 }, "Clean-up")).toBe("Clean-up is $100.00 over");
  });
  it("amber: the stage is trending over", () => {
    expect(jobAlertText({ level: "trending", byCents: 77500 }, "Sheet install")).toBe("Sheet install is trending $775.00 over");
  });
  it("never states an amount with no stage to own it", () => {
    expect(jobAlertText({ level: "over", byCents: 5000 }, null)).toBe("A stage is $50.00 over");
  });
});

describe("jobLine (the one status line on a job row)", () => {
  const stage = (name: string, status: "active" | "paused" = "active", pauseReason: "materials" | "client" | null = null) => ({ stageId: name, name, status, pauseReason });
  const base = { status: "active" as const, pctBp: 4000, currentStages: [stage("Sheet install")] };
  it("an over-budget stage replaces everything else on the line and names the stage", () => {
    expect(jobLine({ ...base, over: { kind: "stage", stageName: "Clean-up", byCents: 10000 } })).toEqual({
      alert: { tone: "over", text: "Clean-up is $100.00 over" },
    });
  });
  it("labour over the job's budget says so, with no stage (R9)", () => {
    expect(jobLine({ ...base, over: { kind: "labour", byCents: 12000 } })).toEqual({
      alert: { tone: "over", text: "Labour is $120.00 over budget" },
    });
  });
  it("a trending job is amber and names its stage", () => {
    expect(jobLine({ ...base, alert: { level: "trending", severity: "watch", byCents: 77500 }, alertStageName: "Sheet install" })).toEqual({
      alert: { tone: "watch", text: "Sheet install is trending $775.00 over" },
    });
  });
  it("a finished job over budget keeps its chip and gets the over line (Hunter: Complete, $2,120 of $2,000)", () => {
    expect(jobLine({ status: "complete", pctBp: 10000, currentStages: [], over: { kind: "labour", byCents: 12000 } })).toEqual({
      chip: { status: "complete" },
      alert: { tone: "over", text: "Labour is $120.00 over budget" },
    });
  });
  it("on hold names its reason in the chip, with no parenthetical (i2-D11)", () => {
    expect(jobLine({ ...base, status: "on_hold", currentStages: [stage("Coat / paint", "paused", "client")] })).toEqual({
      chip: { status: "on-hold", reason: "client" },
      text: "Coat / paint",
    });
  });
  it("a closed job shows its real stage state unless it finished (RR8)", () => {
    expect(jobLine({ status: "closed", pctBp: 10000, currentStages: [] })).toEqual({ chip: { status: "closed" }, text: "All stages done" });
    expect(jobLine({ ...base, status: "closed", pctBp: 4000 })).toEqual({ chip: { status: "closed" }, text: "Sheet install" });
    expect(jobLine({ ...base, status: "closed", pctBp: 0, currentStages: [] })).toEqual({ chip: { status: "closed" }, text: "No stage started" });
  });
  it("a paused stage shows as a Paused chip with its reason", () => {
    expect(jobLine({ ...base, currentStages: [stage("Coat / paint", "paused", "materials")] })).toEqual({
      chip: { status: "paused", reason: "materials" },
      text: "Coat / paint",
    });
  });
  it("a complete job says all stages are done, not that no stage started (i1-F4)", () => {
    expect(jobLine({ status: "complete", pctBp: 10000, currentStages: [] })).toEqual({ chip: { status: "complete" }, text: "All stages done" });
    expect(jobLine({ ...base, pctBp: 10000, currentStages: [] })).toEqual({ text: "All stages done" });
  });
  it("a job on hold keeps its chip and its stages", () => {
    expect(jobLine({ ...base, status: "on_hold" })).toEqual({ chip: { status: "on-hold" }, text: "Sheet install" });
  });
  it("an active job with nothing started says so", () => {
    expect(jobLine({ ...base, pctBp: 0, currentStages: [] })).toEqual({ text: "No stage started" });
  });
});

describe("lastLogOn", () => {
  it("uses days within a week and the date after it", () => {
    expect(lastLogOn(0, "2026-09-28")).toBe("Today");
    expect(lastLogOn(7, "2026-09-28")).toBe("7 days ago");
    expect(lastLogOn(8, "2026-09-28")).toBe("Sun 20 Sep");
    expect(lastLogOn(null, "2026-09-28")).toBe("None yet");
  });
});

describe("overBudgetJobs", () => {
  it("counts the jobs the over rule flags, by labour or by stage, not the ones only trending over", () => {
    const labour = { kind: "labour" as const, byCents: 1 };
    const stage = { kind: "stage" as const, stageName: "Clean-up", byCents: 1 };
    expect(overBudgetJobs([{ over: labour }, { over: null }, { over: stage }, { over: null }])).toBe(2);
  });
});
