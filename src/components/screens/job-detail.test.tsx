import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProjectDetail } from "@/data/contracts";
import { JobDetailBody, JobDetailSkeleton } from "./job-detail";

const LONG = "Whitmore-Featherstonehaugh Heritage Slate Re-roof and Gutter Replacement";

/** A foreman's job with nothing on it yet: no stages, crew, logs, expenses or files. */
const bare = {
  view: "foreman",
  id: "p1",
  name: LONG,
  status: "active",
  jobType: "tile_reroof",
  client: { id: "c1", name: "Featherstonehaugh-Smythe Holdings" },
  siteAddress: "12 Extraordinarily-Long-Street-Name Rd, Ryde NSW 2112",
  pctBp: 0,
  stages: [],
  crewThisWeek: [],
  recentLogs: [],
  expenses: [],
  files: [],
} as unknown as ProjectDetail;

describe("JobDetailBody with nothing on the job yet", () => {
  const html = renderToStaticMarkup(<JobDetailBody job={bare} today="2026-10-08" />);

  it("says there are no stages instead of showing an empty list", () => {
    expect(html).toContain("This job has no stages yet.");
    expect(html).not.toContain("data-stage-list");
  });

  it("shows the long name and client in full, free to wrap", () => {
    expect(html).toContain("Whitmore-Featherstonehaugh");
    expect(html).toContain("Featherstonehaugh-Smythe Holdings");
    expect(html).toContain("overflow-wrap:anywhere");
  });

  it("leaves out the money section and the edit button for a foreman, and never prints a dollar sign", () => {
    expect(html).not.toContain("Money");
    expect(html).not.toContain("Edit job");
    expect(html).not.toContain("$");
  });

  it("has a Back row and no empty crew, logs or files headings", () => {
    expect(html).toContain("Back to jobs");
    for (const h of ["Crew this week", "Recent logs", "Files"]) expect(html).not.toContain(h);
  });

  it("keeps Expenses only for its Add expense link when there are none yet (flows.md 193)", () => {
    expect(html).toContain("data-job-add-expense");
    expect(html).toContain(`href="/expenses/new?job=${bare.id}"`);
  });
});

describe("JobDetailSkeleton", () => {
  it("marks the loading page busy, with the money block only for a manager", () => {
    expect(renderToStaticMarkup(<JobDetailSkeleton manager />)).toContain('aria-busy="true"');
    expect(renderToStaticMarkup(<JobDetailSkeleton manager={false} />)).toContain('aria-busy="true"');
  });
});

/** A manager's job with no stages, no contract or budgets, a labour overrun and a time-only log (i1-D9, D10, D12, F8). */
const boss = {
  ...bare,
  view: "manager",
  access: { canEdit: true },
  contractCents: 0,
  labour: { budgetCents: 0, actualCents: 5000 },
  materials: { budgetCents: 0, actualCents: 0 },
  margins: { forecastMarginCents: 0 },
  alert: { level: "over", byCents: 12345 },
  recentLogs: [
    { id: "l1", crewName: "Sam", stageName: "Ridge", date: "2026-10-07", basis: "time_only", quantity: 800, hours: 800, unit: null, amountCents: 0 },
    { id: "l2", crewName: "Tom", stageName: "Ridge", date: "2026-10-07", basis: "daily", quantity: 100, hours: 800, unit: null, amountCents: 40000 },
  ],
} as unknown as ProjectDetail;

describe("JobDetailBody for a manager", () => {
  const html = renderToStaticMarkup(<JobDetailBody job={boss} today="2026-10-08" />);
  const count = (needle: string) => html.split(needle).length - 1;

  it("has Edit job once, as a header action, and Add stage as the empty state's action", () => {
    expect(count("Edit job")).toBe(1);
    expect(html).toContain("Add stage");
    expect(html.indexOf("Edit job")).toBeLessThan(html.indexOf("data-job-title") + 400);
  });

  it("puts the over-budget warning right under the hero, above the stages", () => {
    const warning = html.indexOf("data-needs-attention");
    expect(warning).toBeGreaterThan(html.indexOf("% done"));
    expect(warning).toBeLessThan(html.indexOf("Stages"));
    const text = html.slice(warning, html.indexOf("Stages")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(text).toContain("Labour $123.45 over budget");
  });

  it("says when there is no contract value or budget instead of printing $0.00 for it", () => {
    expect(html).toContain("No contract value");
    expect(html).toContain("No budget set");
    expect(html).not.toContain("Contract $0.00");
    expect(html).not.toContain("Budget $0.00");
  });

  it("marks a time-only log and gives it no dollar figure", () => {
    expect(html).toContain("time only");
    const logs = html.slice(html.indexOf("Recent logs"));
    expect(logs).not.toContain("$0.00");
    expect(logs).toContain("$400.00");
  });
});
