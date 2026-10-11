import { describe, expect, it } from "vitest";
import { attachmentsText, EXPORT_FILENAME, formatBytes, rowsText } from "./export-text";

describe("workspace export words", () => {
  it("counts rows with the right plural", () => {
    expect(rowsText(0)).toBe("0 rows");
    expect(rowsText(1)).toBe("1 row");
    expect(rowsText(1234)).toBe("1,234 rows");
  });

  it("sizes in plain units", () => {
    expect(formatBytes(0)).toBe("0 KB");
    expect(formatBytes(1)).toBe("1 KB");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1_500_000)).toBe("1.4 MB");
    expect(formatBytes(3_221_225_472)).toBe("3.0 GB");
  });

  it("says what the attachments are", () => {
    expect(attachmentsText({ count: 0, bytes: 0 })).toBe("No attachments yet.");
    expect(attachmentsText({ count: 1, bytes: 2048 })).toBe("1 attachment, 2 KB");
    expect(attachmentsText({ count: 42, bytes: 1_500_000 })).toBe("42 attachments, 1.4 MB");
  });

  it("names the file you get", () => {
    expect(EXPORT_FILENAME).toBe("roofy-workspace-export.zip");
  });
});
