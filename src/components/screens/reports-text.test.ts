import { describe, expect, it } from "vitest";
import {
  REPORT_KINDS,
  countText,
  crewWorkText,
  defaultReportRange,
  isReportKind,
  marginText,
  monthText,
  perCrewDayText,
  reportCsvHref,
  workingDaysText,
  rangeText,
  readReportRange,
  reportTitle,
} from "./reports-text";

describe("reports text", () => {
  it("defaults the range to the last 3 months, ending today (Task 18 run A choice)", () => {
    expect(defaultReportRange("2026-09-28")).toEqual({ from: "2026-06-29", to: "2026-09-28" });
  });

  it("clamps the default start into a shorter month and crosses the year", () => {
    expect(defaultReportRange("2026-05-31")).toEqual({ from: "2026-03-01", to: "2026-05-31" });
    expect(defaultReportRange("2026-02-15")).toEqual({ from: "2025-11-16", to: "2026-02-15" });
  });

  it("reads a range from the address, falling back to the default for missing or unreadable dates", () => {
    expect(readReportRange("2026-09-28", { from: "2026-09-01", to: "2026-09-27" })).toEqual({
      range: { from: "2026-09-01", to: "2026-09-27" },
      chosen: true,
    });
    expect(readReportRange("2026-09-28", {})).toEqual({ range: { from: "2026-06-29", to: "2026-09-28" }, chosen: false });
    expect(readReportRange("2026-09-28", { from: "01/09/2026", to: "2026-02-30" })).toEqual({
      range: { from: "2026-06-29", to: "2026-09-28" },
      chosen: false,
    });
  });

  it("keeps the given end when only the start is given, and swaps a range given back to front", () => {
    expect(readReportRange("2026-09-28", { from: "2026-09-01" }).range).toEqual({ from: "2026-09-01", to: "2026-09-28" });
    expect(readReportRange("2026-09-28", { from: "2026-09-27", to: "2026-09-01" }).range).toEqual({ from: "2026-09-01", to: "2026-09-27" });
  });

  it("knows the five report kinds and their titles", () => {
    expect(REPORT_KINDS).toHaveLength(5);
    expect(isReportKind("job-profitability")).toBe(true);
    expect(isReportKind("margins")).toBe(false);
    expect(reportTitle("job-profitability")).toBe("Job profitability");
    expect(reportTitle("crew")).toBe("Crew");
    expect(reportTitle("pay-history")).toBe("Pay history");
  });

  it("words the range as two whole dates", () => {
    expect(rangeText({ from: "2026-06-29", to: "2026-09-28" }, "2026-09-28")).toBe("Mon 29 Jun to Mon 28 Sep");
  });

  it("shows margins to two places when not whole, and none when there is no contract", () => {
    expect(marginText(1825)).toBe("18.25%");
    expect(marginText(2000)).toBe("20%");
    expect(marginText(-305)).toBe("−3.05%");
    expect(marginText(null)).toBe("No contract price");
  });

  it("counts with the word kept together", () => {
    expect(countText(1, "job")).toBe("1 job");
    expect(countText(3, "job")).toBe("3 jobs");
  });

  it("words a crew member's days and hours", () => {
    expect(crewWorkText(1, 800)).toBe("1 day, 8 h");
    expect(crewWorkText(12, 9650)).toBe("12 days, 96.5 h");
  });
});

describe("reports text, run B kinds", () => {
  it("names a month in words", () => {
    expect(monthText("2026-09")).toBe("September 2026");
    expect(monthText("2026-01")).toBe("January 2026");
  });
  it("links Export CSV to the report's range", () => {
    expect(reportCsvHref("pauses", { from: "2026-06-29", to: "2026-09-28" })).toBe("/reports/pauses/csv?from=2026-06-29&to=2026-09-28");
  });
  it("counts working days lost", () => {
    expect(workingDaysText(1)).toBe("1\u00a0working day");
    expect(workingDaysText(3)).toBe("3\u00a0working days");
  });
  it("says the pace per crew-day with its unit", () => {
    expect(perCrewDayText(4250, "m2")).toMatch(/^42\.5\s?m² a crew-day$/);
  });
});
