import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ProjectList } from "@/data/contracts";
import { JobsListBody } from "./jobs-list";
import { STATUS_FILTERS, statusEmptyMessage, type JobFilter } from "./job-input";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }) }));

// The seed has jobs under every Jobs filter, so the "nothing under this filter" sentence cannot be reached in the browser
// without editing a seed job (which leaks into the other specs and projects sharing the server). It is proved here instead.
const none = { view: "manager", rows: [] } as unknown as ProjectList;
const render = (filter: JobFilter, anyJobs: boolean, canAdd = true) =>
  renderToStaticMarkup(<JobsListBody list={none} filter={filter} anyJobs={anyJobs} canAdd={canAdd} today="2026-09-28" />);

describe("Jobs list with no jobs under the chosen filter", () => {
  it.each(STATUS_FILTERS.filter((f) => f.value !== "all"))("$label says so and keeps the filter and Add job", ({ value, label }) => {
    const html = render(value, true);
    expect(html).toContain(statusEmptyMessage(value as Exclude<JobFilter, "all">));
    expect(html).not.toContain("No jobs yet");
    expect(html).not.toContain("data-job-row");
    expect(html).toContain(`>${label}<`);
    expect(html).toContain("Add job");
  });

  it("uses the exact sentences: No jobs on hold. / No quoted jobs. / No complete jobs. / No closed jobs. / No active jobs right now.", () => {
    expect(render("on_hold", true)).toContain("No jobs on hold.");
    expect(render("quoted", true)).toContain("No quoted jobs.");
    expect(render("complete", true)).toContain("No complete jobs.");
    expect(render("closed", true)).toContain("No closed jobs.");
    expect(render("active", true)).toContain("No active jobs right now.");
  });

  it("a workspace with no jobs at all says so and offers the first job instead", () => {
    const html = render("active", false);
    expect(html).toContain("No jobs yet. Add your first job.");
    expect(html).not.toContain("No active jobs right now.");
  });
});
