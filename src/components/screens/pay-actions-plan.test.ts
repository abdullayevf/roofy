import { describe, expect, it } from "vitest";
import { payActionsPlan, type PlanInput } from "./pay-actions-plan";

const draft: PlanInput = { status: "draft", canApprove: true, canExport: true, blockedBy: [], canReopen: false };

describe("payActionsPlan", () => {
  it("a clean draft offers Approve for an owner or manager", () => {
    expect(payActionsPlan(draft, true)).toEqual({
      approve: "enabled", waive: false, settings: false, missingRate: false, exportCsv: false, reopen: false, needsConnection: false, readOnly: false,
    });
  });

  it("a missing rate blocks Approve, with the waive option and the line", () => {
    const p = payActionsPlan({ ...draft, blockedBy: ["missing_rate"] }, true);
    expect(p).toMatchObject({ approve: "disabled", waive: true, missingRate: true, settings: false });
  });

  it("Owner 2FA off blocks Approve and the waive too, and offers Settings", () => {
    const p = payActionsPlan({ ...draft, blockedBy: ["missing_rate", "owner_2fa_off"] }, true);
    expect(p).toMatchObject({ approve: "disabled", waive: false, missingRate: true, settings: true });
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
