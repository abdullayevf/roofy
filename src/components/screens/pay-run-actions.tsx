"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { Id, PayRunReview } from "@/data/contracts";
import { approvePayRun, exportPayRunCsv, reopenPayRun } from "@/app/actions/pay";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Toast } from "@/components/ui/toast";
import { payActionsPlan, sheetAllowed, type Sheet } from "./pay-actions-plan";
import { NEEDS_CONNECTION, useOnline } from "./use-online";

export const MISSING_RATE_BLOCK = "Fix the missing rate before you approve.";
export const TWO_FACTOR_BLOCK = "Turn on two-factor before you approve a pay run.";

export type { Sheet };

export type PayRunActionsProps = {
  review: Pick<PayRunReview, "id" | "status" | "blockedBy" | "canReopen" | "access">;
  /** "Mon 21 Sep to Sun 27 Sep", for the confirmation sheet. */
  periodText: string;
  /** Where the missing rate's line is on this page (`#line-…`). */
  missingRateHref: string | null;
  /** Where Owner 2FA is turned on. */
  settingsHref: string;
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

function Block({ text, data, children }: { text: string; data: string; children?: React.ReactNode }) {
  return (
    <div data-pay-block={data} className="flex flex-col gap-2">
      <p className="flex items-start gap-2 text-body-strong text-over">
        <WarningCircle size={24} aria-hidden="true" className="shrink-0" />
        <span>{text}</span>
      </p>
      {children}
    </div>
  );
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
  demoOffline = false,
  initialSheet = null,
}: PayRunActionsProps) {
  const router = useRouter();
  const online = useOnline(demoOffline);
  const plan = payActionsPlan(
    { ...review, canApprove: review.access.canApprove, canExport: review.access.canExport },
    online,
  );
  const [requested, setSheet] = useState<Sheet>(initialSheet);
  // Only a live action's sheet shows: `?confirm=` can't open one for an accountant, a blocked draft or offline.
  const sheet = sheetAllowed(plan, requested) ? requested : null;
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const wide = "w-full sm:w-auto sm:min-w-60 sm:self-start";

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

  const nothing = plan.approve === "none" && !plan.exportCsv && !plan.reopen && !plan.readOnly;
  if (nothing) return null;

  return (
    <section aria-label="Pay run actions" data-pay-actions="" className="flex flex-col gap-4">
      {plan.settings ? (
        <Block text={TWO_FACTOR_BLOCK} data="owner_2fa_off">
          <Button variant="secondary" href={settingsHref} className={wide}>
            Go to settings
          </Button>
        </Block>
      ) : null}
      {plan.missingRate ? (
        <Block text={MISSING_RATE_BLOCK} data="missing_rate">
          {missingRateHref ? (
            <Button variant="link" href={missingRateHref} className="self-start">
              Show the line
            </Button>
          ) : null}
          {plan.waive ? (
            <Button variant="secondary" onClick={() => setSheet("waive")} className={wide}>
              Approve without the rate
            </Button>
          ) : null}
        </Block>
      ) : null}
      {plan.readOnly ? (
        <p className="text-body text-ink">An owner or manager approves this pay run.</p>
      ) : null}
      {plan.approve !== "none" ? (
        <Button
          variant="primary"
          disabled={plan.approve === "disabled" || pending}
          onClick={() => setSheet("approve")}
          className={wide}
        >
          Approve pay run
        </Button>
      ) : null}
      {plan.exportCsv ? (
        <Button
          variant="primary"
          disabled={plan.exportCsv === "disabled" || pending}
          onClick={exportCsv}
          className={wide}
        >
          Export CSV
        </Button>
      ) : null}
      {plan.reopen ? (
        <Button
          variant="secondary"
          disabled={plan.reopen === "disabled" || pending}
          onClick={() => setSheet("reopen")}
          className={wide}
        >
          Reopen pay run
        </Button>
      ) : null}
      {plan.needsConnection ? (
        <p data-pay-needs-connection="" className="text-meta text-ink">
          {NEEDS_CONNECTION}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-body-strong text-over">
          {error}
        </p>
      ) : null}
      <Dialog
        open={sheet === "approve" || sheet === "waive"}
        onOpenChange={(open) => !open && setSheet(null)}
        title="Approve this pay run?"
        description={
          sheet === "waive"
            ? `Lines with no rate are paid $0.00. We'll note that you approved without the rate. Approving locks every day logged from ${periodText}.`
            : `Approving locks every day logged from ${periodText} and adds each person's pay to what they're owed.`
        }
        confirmLabel={pending ? "Approving…" : "Approve"}
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
