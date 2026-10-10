"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { Id, PayRunReview } from "@/data/contracts";
import { approvePayRun, exportPayRunCsv, reopenPayRun } from "@/app/actions/pay";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Toast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/format";
import { focusRing } from "@/components/ui/focus";
import { payActionsPlan, payNeedsConnectionText, sheetAllowed, type Sheet } from "./pay-actions-plan";
import { PinnedAction, usePinnedBar } from "./field-entry";
import { useOnline } from "./use-online";

export const MISSING_RATE_BLOCK = "Fix the missing rate before you approve.";
export const TWO_FACTOR_BLOCK = "Turn on two-factor before you approve a pay run.";
/** A manager can't turn on the owner's two-factor, so they get no Settings button (pay iter1 F4). */
export const TWO_FACTOR_BLOCK_MANAGER = "The owner needs to turn on two-factor before this pay run can be approved.";
const BUTTON = "w-full";

export type { Sheet };

export type PayRunActionsProps = {
  review: Pick<PayRunReview, "id" | "status" | "blockedBy" | "canReopen" | "access">;
  /** "Mon 21 Sep to Sun 27 Sep", for the confirmation sheet. */
  periodText: string;
  /** Where the missing rate's line is on this page (`#line-…`). */
  missingRateHref: string | null;
  /** Where Owner 2FA is turned on. */
  settingsHref: string;
  /** The viewer is the owner (only they get the Settings button when their two-factor is off). */
  owner: boolean;
  demoOffline?: boolean;
  /** `?confirm=approve|waive|reopen`: open with that sheet showing (prototype capture of the sheet). */
  initialSheet?: Sheet;
};

function download(filename: string, contentType: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: contentType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Pay run actions (flows.md screen 19): Approve through a confirmation sheet (it locks the period), blocked by a
 * missing rate (Owner/Manager may approve without it, audited) or Owner 2FA off (button to Settings); once approved,
 * Export CSV and Reopen. An accountant exports only. With no signal every action is disabled with "Needs connection".
 */
export function PayRunActions({
  review,
  periodText,
  missingRateHref,
  settingsHref,
  owner,
  demoOffline = false,
  initialSheet = null,
}: PayRunActionsProps) {
  const router = useRouter();
  const online = useOnline(demoOffline);
  const plan = payActionsPlan(
    { ...review, canApprove: review.access.canApprove, canExport: review.access.canExport, owner },
    online,
  );
  const [requested, setSheet] = useState<Sheet>(initialSheet);
  // Only a live action's sheet shows: `?confirm=` can't open one for an accountant, a blocked draft or offline.
  const sheet = sheetAllowed(plan, requested) ? requested : null;
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { style, barProps } = usePinnedBar(null);
  const barHeight = (style as Record<string, string>)["--pin-action-height"];
  // The page pads its bottom by the bar's height (`pin-pad` on the screen); the bar sits in the title row, so it sets
  // the height on the screen itself.
  useEffect(() => {
    barProps.ref.current?.closest<HTMLElement>("[data-screen]")?.style.setProperty("--pin-action-height", barHeight ?? "9rem");
  }, [barHeight, barProps.ref]);

  const run = (id: Id, which: Exclude<Sheet, null>) =>
    start(async () => {
      setError(null);
      const result =
        which === "reopen"
          ? await reopenPayRun(id)
          : await approvePayRun(id, { waiveMissingRate: which === "waive" });
      setSheet(null);
      if (!result.ok) return setError(result.message);
      setToast(which === "reopen" ? "Pay run reopened." : "Pay run approved.");
      router.refresh();
    });

  const exportCsv = () =>
    start(async () => {
      setError(null);
      const result = await exportPayRunCsv(review.id);
      if (!result.ok) return setError(result.message);
      download(result.filename, result.contentType, result.csv);
      setToast("CSV exported.");
      router.refresh();
    });

  const bar = plan.approve !== "none" || plan.exportCsv !== false || plan.reopen !== false;
  if (!bar && !plan.readOnly) return null;
  const blockText =
    plan.blocker === "owner_2fa_off" ? (owner ? TWO_FACTOR_BLOCK : TWO_FACTOR_BLOCK_MANAGER) : plan.blocker === "missing_rate" ? MISSING_RATE_BLOCK : null;

  return (
    <section aria-label="Pay run actions" data-pay-actions="" className="contents">
      {plan.readOnly ? <p className="text-body text-ink">An owner or manager approves this pay run.</p> : null}
      {bar ? (
        // Below 1024 px a bar pinned above the tab bar (one compact row on a phone on its side); from 1024 px in the
        // title row. The fix path (Show the line, Go to settings) comes first, Approve last, the waiver quieter under it.
        <PinnedAction barProps={barProps} error={error} className="pin-head pin-pay">
          {blockText ? (
            // The icon hangs left of the words; the text sits straight in the paragraph so the waiver below is an inline
            // text link. A phone on its side shows that inline waiver (one compact row, pay iter2 D25/N2) and hides the
            // standalone one; every other size hides the inline one.
            <p data-pay-block={plan.blocker ?? undefined} className="relative pl-8 text-body-strong text-over">
              <WarningCircle size={24} aria-hidden="true" className="absolute left-0 top-0" />
              {blockText}
              {plan.waive ? " " : null}
              {plan.waive ? (
                <a
                  href="?confirm=waive"
                  data-pay-waive-inline=""
                  onClick={(e) => {
                    e.preventDefault();
                    setSheet("waive");
                  }}
                  className={`hidden text-chalk-link underline underline-offset-4 ${focusRing(false)}`}
                >
                  Approve without the rate
                </a>
              ) : null}
            </p>
          ) : null}
          {plan.settings ? (
            <Button variant="secondary" href={settingsHref} className={BUTTON}>
              Go to settings
            </Button>
          ) : null}
          {plan.blocker === "missing_rate" && missingRateHref ? (
            <Button variant="secondary" href={missingRateHref} className={BUTTON}>
              Show the line
            </Button>
          ) : null}
          {plan.reopen ? (
            <Button variant="secondary" disabled={plan.reopen === "disabled" || pending} onClick={() => setSheet("reopen")} className={BUTTON}>
              Reopen pay run
            </Button>
          ) : null}
          {plan.approve !== "none" ? (
            <Button variant="primary" disabled={plan.approve === "disabled" || pending} onClick={() => setSheet("approve")} className={BUTTON}>
              Approve pay run
            </Button>
          ) : null}
          {plan.exportCsv ? (
            <Button variant="primary" disabled={plan.exportCsv === "disabled" || pending} onClick={exportCsv} className={BUTTON}>
              Export CSV
            </Button>
          ) : null}
          {plan.waive ? (
            <Button variant="link" onClick={() => setSheet("waive")} className="pay-waive self-center">
              Approve without the rate
            </Button>
          ) : null}
          {plan.needsConnection ? (
            <p data-pay-needs-connection="" className="text-meta text-ink">
              {payNeedsConnectionText(plan)}
            </p>
          ) : null}
        </PinnedAction>
      ) : null}
      <Dialog
        open={sheet === "approve" || sheet === "waive"}
        onOpenChange={(open) => !open && setSheet(null)}
        title="Approve this pay run?"
        description={
          sheet === "waive"
            ? (
                <>
                  Lines with no rate are paid{" "}
                  {/* Money in the figure face, as in every pay sentence (lesson 26, pay iter2 D21). */}
                  <span data-inline-money="" className="font-display font-semibold num whitespace-nowrap">{formatMoney(0)}</span>. We&apos;ll
                  note that you approved without the rate. Approving locks every day logged from {periodText}.
                </>
              )
            : `Approving locks every day logged from ${periodText} and adds each person's pay to what they're owed.`
        }
        confirmLabel={pending ? "Approving…" : sheet === "waive" ? "Approve without the rate" : "Approve"}
        onConfirm={() => sheet && online && !pending && run(review.id, sheet)}
        onCancel={() => setSheet(null)}
      />
      <Dialog
        open={sheet === "reopen"}
        onOpenChange={(open) => !open && setSheet(null)}
        title="Reopen this pay run?"
        description="Its days unlock and each person's pay comes off what they're owed until you approve it again."
        confirmLabel={pending ? "Reopening…" : "Reopen"}
        tone="danger"
        onConfirm={() => sheet === "reopen" && online && !pending && run(review.id, "reopen")}
        onCancel={() => setSheet(null)}
      />
      <Toast open={toast !== null} onOpenChange={(open) => !open && setToast(null)} message={toast ?? ""} />
    </section>
  );
}
