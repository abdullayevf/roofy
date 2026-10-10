import type { PayRunReview } from "@/data/contracts";

export type PlanInput = Pick<PayRunReview, "status" | "blockedBy" | "canReopen"> & { canApprove: boolean; canExport: boolean };
type State = "enabled" | "disabled";

export type PayActionsPlan = {
  /** Approve pay run: "none" once approved, or for someone who only reads (an accountant). */
  approve: State | "none";
  /** "Approve without the rate" (Owner/Manager, audited): only when a missing rate is the one block and there is signal. */
  waive: boolean;
  /** Owner 2FA is off: the "Go to settings" button. */
  settings: boolean;
  /** A missing rate blocks: the sentence and the tap-through to the line. */
  missingRate: boolean;
  exportCsv: State | false;
  reopen: State | false;
  /** No signal and an action that needs it: the one "Needs connection" line. */
  needsConnection: boolean;
  /** A draft someone can only read (an accountant): a plain line says who approves it. */
  readOnly: boolean;
};

/** Which pay run actions show, and which are live (flows.md "Review and approve a pay run"; pay rules §9). */
export function payActionsPlan(r: PlanInput, online: boolean): PayActionsPlan {
  const draft = r.status === "draft";
  const live = (on: boolean): State | false => (on ? (online ? "enabled" : "disabled") : false);
  const twoFactorOff = r.blockedBy.includes("owner_2fa_off");
  const missingRate = r.blockedBy.includes("missing_rate");
  const approver = draft && r.canApprove;
  const approve: PayActionsPlan["approve"] = !approver ? "none" : online && r.blockedBy.length === 0 ? "enabled" : "disabled";
  const exportCsv = live(!draft && r.canExport);
  const reopen = live(!draft && r.canApprove && r.canReopen);
  return {
    approve,
    waive: approver && online && missingRate && !twoFactorOff,
    settings: approver && twoFactorOff,
    missingRate: approver && missingRate,
    exportCsv,
    reopen,
    needsConnection: !online && (approver || exportCsv !== false || reopen !== false),
    readOnly: draft && !r.canApprove,
  };
}

export type Sheet = "approve" | "waive" | "reopen" | null;

/** A confirmation sheet shows only while its action is live in the plan, so `?confirm=` can't open one that isn't. */
export function sheetAllowed(plan: PayActionsPlan, sheet: Sheet): boolean {
  if (sheet === "approve") return plan.approve === "enabled";
  if (sheet === "waive") return plan.waive;
  if (sheet === "reopen") return plan.reopen === "enabled";
  return false;
}
