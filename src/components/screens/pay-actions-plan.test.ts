import { describe, expect, it } from "vitest";
import { payActionsPlan, payNeedsConnectionText, sheetAllowed, type PlanInput } from "./pay-actions-plan";

const draft: PlanInput = { status: "draft", canApprove: true, canExport: true, blockedBy: [], canReopen: false, owner: true };

describe("payActionsPlan", () => {
  it("a clean draft offers Approve for an owner or manager", () => {
    expect(payActionsPlan(draft, true)).toEqual({
      approve: "enabled", waive: false, settings: false, missingRate: false, exportCsv: false, reopen: false, needsConnection: false, readOnly: false, blocker: null,
    });
  });

  it("a missing rate blocks Approve, with the waive option and the line", () => {
    const p = payActionsPlan({ ...draft, blockedBy: ["missing_rate"] }, true);
    expect(p).toMatchObject({ approve: "disabled", waive: true, missingRate: true, settings: false });
  });

  it("Owner 2FA off blocks Approve and the waive too, and offers Settings", () => {
    const p = payActionsPlan({ ...draft, blockedBy: ["missing_rate", "owner_2fa_off"] }, true);
    expect(p).toMatchObject({ approve: "disabled", waive: false, missingRate: true, settings: true, blocker: "owner_2fa_off" });
  });

  it("a missing rate alone is the bar's one blocker", () => {
    expect(payActionsPlan({ ...draft, blockedBy: ["missing_rate"] }, true).blocker).toBe("missing_rate");
  });

  it("a manager sees Owner 2FA off without the Settings button: only the owner can turn it on (F4)", () => {
    const p = payActionsPlan({ ...draft, owner: false, blockedBy: ["owner_2fa_off"] }, true);
    expect(p).toMatchObject({ approve: "disabled", settings: false, blocker: "owner_2fa_off" });
  });

  it("offline disables every action with the one Needs connection line", () => {
    expect(payActionsPlan(draft, false)).toMatchObject({ approve: "disabled", needsConnection: true });
    expect(payActionsPlan({ ...draft, blockedBy: ["missing_rate"] }, false)).toMatchObject({ waive: false, needsConnection: true });
    const approved = payActionsPlan({ ...draft, status: "approved", canReopen: true }, false);
    expect(approved).toMatchObject({ exportCsv: "disabled", reopen: "disabled", needsConnection: true });
  });

  it("an approved run offers Export CSV and Reopen while no later run is approved", () => {
    expect(payActionsPlan({ ...draft, status: "approved", canReopen: true }, true)).toMatchObject({
      approve: "none", exportCsv: "enabled", reopen: "enabled",
    });
    expect(payActionsPlan({ ...draft, status: "exported", canReopen: false }, true)).toMatchObject({ exportCsv: "enabled", reopen: false });
  });

  it("an accountant never approves or reopens, and exports an approved run", () => {
    const accountant = { ...draft, canApprove: false };
    expect(payActionsPlan(accountant, true)).toMatchObject({ approve: "none", waive: false, readOnly: true, needsConnection: false });
    expect(payActionsPlan({ ...accountant, status: "approved", canReopen: false }, true)).toMatchObject({ exportCsv: "enabled", reopen: false });
  });
});

describe("sheetAllowed (?confirm= opens a sheet only for a live action)", () => {
  const approved: PlanInput = { ...draft, status: "approved", canReopen: true };
  it("opens approve on a clean draft, waive on a missing-rate draft, reopen on an approved run", () => {
    expect(sheetAllowed(payActionsPlan(draft, true), "approve")).toBe(true);
    expect(sheetAllowed(payActionsPlan({ ...draft, blockedBy: ["missing_rate"] }, true), "waive")).toBe(true);
    expect(sheetAllowed(payActionsPlan(approved, true), "reopen")).toBe(true);
    expect(sheetAllowed(payActionsPlan(draft, true), null)).toBe(false);
  });

  it("no sheet for an accountant, a blocked draft, offline, or a run that can't reopen", () => {
    const accountant = { ...draft, canApprove: false };
    expect(sheetAllowed(payActionsPlan(accountant, true), "approve")).toBe(false);
    expect(sheetAllowed(payActionsPlan({ ...accountant, blockedBy: ["missing_rate"] }, true), "waive")).toBe(false);
    expect(sheetAllowed(payActionsPlan({ ...draft, blockedBy: ["missing_rate"] }, true), "approve")).toBe(false);
    expect(sheetAllowed(payActionsPlan({ ...draft, blockedBy: ["missing_rate", "owner_2fa_off"] }, true), "waive")).toBe(false);
    expect(sheetAllowed(payActionsPlan(draft, false), "approve")).toBe(false);
    expect(sheetAllowed(payActionsPlan({ ...draft, blockedBy: ["missing_rate"] }, false), "waive")).toBe(false);
    expect(sheetAllowed(payActionsPlan(approved, false), "reopen")).toBe(false);
    expect(sheetAllowed(payActionsPlan({ ...approved, canReopen: false }, true), "reopen")).toBe(false);
    expect(sheetAllowed(payActionsPlan({ ...approved, canApprove: false }, true), "reopen")).toBe(false);
    expect(sheetAllowed(payActionsPlan(approved, true), "approve")).toBe(false);
  });
  it("D26: the offline line names what needs signal", () => {
    expect(payNeedsConnectionText(payActionsPlan(draft, false))).toBe("Needs connection to approve.");
    const approved = { ...draft, status: "approved" as const, canReopen: true };
    expect(payNeedsConnectionText(payActionsPlan(approved, false))).toBe("Needs connection to export or reopen.");
    expect(payNeedsConnectionText(payActionsPlan({ ...approved, canApprove: false }, false))).toBe("Needs connection to export.");
  });
});
