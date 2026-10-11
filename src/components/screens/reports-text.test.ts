import { describe, expect, it } from "vitest";
import {
  REPORT_KINDS,
  countText,
  crewWorkText,
  defaultReportRange,
  isReportKind,
  keyFigureParts,
  keyFigureText,
  marginText,
  monthText,
  pauseReasonLine,
  perCrewDayText,
  periodText,
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

  describe("periodText (a productivity row's label)", () => {
    const today = "2026-09-28";
    it("names the month when the row covers the whole month", () => {
      expect(periodText({ month: "2026-08", period: { from: "2026-08-01", to: "2026-08-31" } }, today)).toBe("August 2026");
      expect(periodText({ month: "2026-02", period: { from: "2026-02-01", to: "2026-02-28" } }, today)).toBe("February 2026");
    });
    it("names the range when it covers part of a month", () => {
      const week = { from: "2026-09-21", to: "2026-09-27" };
      expect(periodText({ month: "2026-09", period: week }, today)).toBe(rangeText(week, today));
      const upToToday = { from: "2026-09-01", to: "2026-09-27" };
      expect(periodText({ month: "2026-09", period: upToToday }, today)).toBe(rangeText(upToToday, today));
      const fromMid = { from: "2026-08-10", to: "2026-08-31" };
      expect(periodText({ month: "2026-08", period: fromMid }, today)).toBe(rangeText(fromMid, today));
    });
  });

  describe("key figure parts (figure on one line, unit on the line below)", () => {
    it("money has no unit", () => {
      expect(keyFigureParts({ format: "money", value: -117000, label: "x" })).toEqual({ figure: "−$1,170.00", unit: "" });
    });
    it("working days: the count is the figure, the words are the unit", () => {
      expect(keyFigureParts({ format: "days", value: 45, label: "x" })).toEqual({ figure: "45", unit: "working days" });
      expect(keyFigureParts({ format: "days", value: 1, label: "x" })).toEqual({ figure: "1", unit: "working day" });
    });
    it("pace: the quantity is the figure, 'a crew-day' is the unit", () => {
      expect(keyFigureParts({ format: "per-crew-day", value: 4250, unit: "m2", label: "x" })).toEqual({ figure: "42.5 m²", unit: "a crew-day" });
    });
    it("reads as one phrase in text", () => {
      expect(keyFigureText({ format: "money", value: 12345, label: "x" })).toBe("$123.45");
      expect(keyFigureText({ format: "days", value: 3, label: "x" })).toBe("3 working days");
      expect(keyFigureText({ format: "per-crew-day", value: 4250, unit: "m2", label: "x" })).toBe("42.5 m² a crew-day");
    });
  });

  it("says each pause reason as what the stage was waiting on", () => {
    expect(pauseReasonLine("materials")).toBe("Waiting on materials");
    expect(pauseReasonLine("weather")).toBe("Held up by weather");
    expect(pauseReasonLine("client")).toBe("Waiting on the client");
    expect(pauseReasonLine("other_job")).toBe("Crew on another job");
    expect(pauseReasonLine("other")).toBe("Another reason");
  });
});
