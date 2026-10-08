// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DoneProposal, ProjectDetail, StageDetail } from "../../contracts";
import { JobDetailBody } from "@/components/screens/job-detail";
import { StageDetailBody } from "@/components/screens/stage-detail";
import { StageDone } from "@/components/screens/stage-done";
import { expectNoMoney } from "../../dto";
import { getSeed } from "../store";
import { fake } from "./testing";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/app/actions/stages", () => ({
  startStage: async () => ({ ok: true }),
  reopenStage: async () => ({ ok: true }),
  proposeStageDone: async () => ({ ok: false }),
  confirmStageDone: async () => ({ ok: true }),
}));

const { meta } = getSeed();
const TODAY = "2026-09-28";

async function job(role: "manager" | "foreman"): Promise<ProjectDetail> {
  const { data, actor } = fake(role);
  return data.projects.get(actor, meta.projects.smith);
}
async function stage(role: "manager" | "foreman"): Promise<StageDetail> {
  const { data, actor } = fake(role);
  return data.stages.get(actor, meta.stages.smithSheetInstall);
}

describe("job detail on the populated Smith job", () => {
  it("the foreman's job has stages, logs and expenses to show, and none of it carries money", async () => {
    const d = await job("foreman");
    expect(d.stages.length).toBeGreaterThan(1);
    expect(d.recentLogs.length).toBeGreaterThan(0);
    expect(d.expenses.length).toBeGreaterThan(0);
    expectNoMoney(d, "foreman view");
    const html = renderToStaticMarkup(<JobDetailBody job={d} today={TODAY} />);
    expect(html).toContain('data-view="foreman"');
    expect(html).toContain("Recent logs");
    expect(html).not.toContain("$");
    expect(html).not.toContain("Money");
    expect(html).not.toContain("Edit job");
  });

  it("the manager's job shows the money section, figures and the links behind them", async () => {
    const d = await job("manager");
    const html = renderToStaticMarkup(<JobDetailBody job={d} today={TODAY} />);
    expect(html).toContain('data-view="manager"');
    expect(html).toContain("Money");
    expect(html).toContain("Forecast margin");
    expect(html).toContain("$");
    expect(html).toContain(`/history?job=${meta.projects.smith}`);
    expect(html).toContain("Edit job");
  });
});

describe("stage detail on the populated Smith sheet install", () => {
  it("the manager sees the forecast working and each progress entry's quantity and unit", async () => {
    const d = await stage("manager");
    if (d.view !== "manager") throw new Error("expected the manager view");
    expect(d.progress.length).toBeGreaterThan(0);
    const html = renderToStaticMarkup(<StageDetailBody stage={d} today={TODAY} />);
    expect(html).toContain("$1,432.50 spent at 30% done, so about $4,775.00 for the whole stage.");
    for (const p of d.progress) {
      expect(html).toContain(`${p.quantity / 100} m²`);
    }
  });

  it("the foreman sees each progress entry's quantity and unit and no dollar sign anywhere", async () => {
    const d = await stage("foreman");
    expect(d.view).toBe("foreman");
    expect(d.progress.length).toBeGreaterThan(0);
    expectNoMoney(d, "foreman view");
    const html = renderToStaticMarkup(<StageDetailBody stage={d} today={TODAY} />);
    for (const p of d.progress) expect(html).toContain(`${p.quantity / 100} m²`);
    expect(html).not.toContain("$");
    expect(html).not.toContain("Money");
    expect(html).not.toContain("Forecast");
  });
});

describe("stage done on a lump-sum stage nobody has logged work on", () => {
  const proposal: DoneProposal = {
    stageId: "s1",
    stageName: "Ridge capping",
    projectId: "p1",
    projectName: "Harris ridge",
    completedOn: TODAY,
    lumpSumCents: 200000,
    crew: [],
  };
  const html = renderToStaticMarkup(<StageDone proposal={proposal} today={TODAY} />);

  it("says nobody has logged work, instead of an empty split", () => {
    expect(html).toContain("data-split-empty");
    expect(html).toContain("$2,000.00 is shared by everyone who logged work on this stage. Nobody has logged work on it yet.");
    expect(html).not.toContain("data-shares-left");
  });

  it("offers Log crew time, opened on this job and this stage", () => {
    expect(html).toMatch(/<a[^>]*href="\/log\?project=p1&(amp;)?stage=s1"[^>]*>(<[^>]+>)*Log crew time/);
  });
});
