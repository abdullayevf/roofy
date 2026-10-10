import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PayRunActions, type PayRunActionsProps } from "./pay-run-actions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }) }));
vi.mock("@/app/actions/pay", () => ({ approvePayRun: vi.fn(), exportPayRunCsv: vi.fn(), reopenPayRun: vi.fn() }));

const review = (r: Partial<PayRunActionsProps["review"]>): PayRunActionsProps["review"] => ({
  id: "run-1",
  status: "draft",
  blockedBy: [],
  canReopen: false,
  access: { canApprove: true, canExport: true },
  ...r,
} as PayRunActionsProps["review"]);
const render = (r: Partial<PayRunActionsProps["review"]>) =>
  renderToStaticMarkup(
    <PayRunActions review={review(r)} periodText="Mon 21 Sep to Sun 27 Sep" missingRateHref="#line-1" settingsHref="/settings" owner />,
  );

// Pay iter2 D25 + N2: on a phone on its side the bar is one row, so the waiver sits inline in the sentence (a text link
// that opens the waive sheet), and the standalone waiver link is marked so the landscape bar can hide it.
describe("Pay run actions, a missing rate", () => {
  it("puts the waiver inline in the blocking sentence as a link to the waive sheet", () => {
    const html = render({ blockedBy: ["missing_rate"] });
    expect(html).toMatch(/<p[^>]*data-pay-block="missing_rate"[^>]*>.*Fix the missing rate before you approve\..*<a[^>]*href="\?confirm=waive"[^>]*data-pay-waive-inline=""[^>]*>Approve without the rate<\/a><\/p>/s);
    expect(html).toMatch(/class="[^"]*pay-waive[^"]*"/);
  });
  it("has no inline waiver when two-factor is the only blocker", () => {
    const html = render({ blockedBy: ["owner_2fa_off"] });
    expect(html).not.toContain("data-pay-waive-inline");
  });
  it("lays the actions out left to right: Reopen, then Export CSV (pay iter2 D27)", () => {
    const html = render({ status: "approved", canReopen: true });
    expect(html.indexOf("Reopen pay run")).toBeLessThan(html.indexOf("Export CSV"));
  });
});
