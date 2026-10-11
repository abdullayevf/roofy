// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DoneProposal, ProjectDetail, StageDetail } from "../../contracts";
import { JobDetailBody } from "@/components/screens/job-detail";
import { StageDetailBody } from "@/components/screens/stage-detail";
import { StageDone } from "@/components/screens/stage-done";
import { StageForecastBody } from "@/components/screens/stage-forecast";
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

describe("forecast breakdown (flows find the job losing money, tap 2)", () => {
  async function manager(role: "manager" | "accountant" | "owner", stageId: string) {
    const { data, actor } = fake(role);
    const d = await data.stages.get(actor, stageId);
    if (d.view !== "manager") throw new Error("expected the money view");
    return renderToStaticMarkup(<StageForecastBody stage={d} today={TODAY} />).replace(/\u00a0/g, " ");
  }
  /** The words a reader sees, tags removed (the working's money values sit in figure-style spans). */
  const words = (html: string) => html.replace(/<[^>]+>/g, "");
  it("E11.1/E12.1 Smith sheet install: Sam and Dima per-unit lines, $1,432.50 so far, ÷ 30% = $4,775.00 against $4,000.00 and $4,200.00", async () => {
    const html = await manager("manager", meta.stages.smithSheetInstall);
    // lessons.md: money in the working uses the figure style, never bold body text.
    expect(html).toContain('<p data-forecast-working="" class="text-body text-ink [overflow-wrap:anywhere]">');
    expect(html).toContain('<span class="whitespace-nowrap text-figure num">$4,775.00</span>');
    expect(words(html)).toContain("Budget plus 5%, so a forecast over $4,200.00 shows as trending over");
    for (const t of ["Sam, Fri 25 Sep", "60 m² at $9.50 = $570.00, plus 25% on-cost = $712.50", "Dima, Fri 25 Sep", "60 m² at $12.00 = $720.00", "$720.00", "$1,432.50", "6 time-only lines cost nothing on their own", "$1,432.50 ÷ 30% done = $4,775.00", "$4,000.00", "$4,200.00", "Trending $775.00 over budget"]) {
      expect(words(html)).toContain(t);
    }
  });
  it("the accountant and owner see the same breakdown", async () => {
    for (const role of ["accountant", "owner"] as const) expect(words(await manager(role, meta.stages.smithSheetInstall))).toContain("$1,432.50 ÷ 30% done = $4,775.00");
  });
  it("a done stage says the forecast is what it cost, with no trigger", async () => {
    const id = getSeed().stages.find((st) => st.projectId === meta.projects.smith && st.name === "Site setup & safety")!.id;
    const html = await manager("manager", id);
    expect(html).toContain("Done, so the forecast is what it cost:");
    expect(html).not.toContain("Warning from");
  });
  it("a stage under 10% done says there is no forecast yet", async () => {
    const html = await manager("manager", meta.stages.rydeCoat);
    expect(html).toContain("No forecast yet. It starts once the stage is 10% done.");
    expect(html).not.toContain("Forecast labour</span>");
  });
});
