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

  it("has a Back row and no empty crew, logs, expenses or files headings", () => {
    expect(html).toContain("Back to jobs");
    for (const h of ["Crew this week", "Recent logs", "Expenses", "Files"]) expect(html).not.toContain(h);
  });
});

describe("JobDetailSkeleton", () => {
  it("marks the loading page busy, with the money block only for a manager", () => {
    expect(renderToStaticMarkup(<JobDetailSkeleton manager />)).toContain('aria-busy="true"');
    expect(renderToStaticMarkup(<JobDetailSkeleton manager={false} />)).toContain('aria-busy="true"');
  });
});
