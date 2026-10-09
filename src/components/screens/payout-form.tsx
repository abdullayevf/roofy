"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import type { Cents, PayoutMethod } from "@/data/contracts";
import { recordPayout } from "@/app/actions/pay";
import { cx } from "@/lib/cx";
import { KeepTogether } from "@/components/keep-together";
import { Button } from "@/components/ui/button";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { ErrorMessage } from "@/components/ui/error-message";
import { Field } from "@/components/ui/field";
import { MoneyField } from "@/components/ui/money-field";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { balanceView } from "./crew-input";
import { FORM_WIDTH, FieldSkeleton, LoadError, PinnedAction, usePinnedBar } from "./field-entry";
import {
  PAYOUT_KINDS,
  PAYOUT_METHODS,
  payoutInput,
  missingHint, payoutProblems,
  type PayoutFormValues,
  type PayoutKind,
} from "./payout-input";
import { NEEDS_CONNECTION, useOnline } from "./use-online";

const LABEL = "text-body-strong text-ink";

function Heading({ crewId, name }: { crewId: string; name: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <Button variant="link" href={name ? `/crew/${crewId}` : "/crew"} className="self-start">
        {name ? <KeepTogether text={`Back to ${name}`} /> : "Back to crew"}
      </Button>
      <h1 className="text-title text-ink">Record payout</h1>
    </div>
  );
}

export type PayoutFormProps = {
  crewId: string;
  name: string;
  balanceCents: Cents;
  initial: PayoutFormValues;
  /** Show what is missing straight away, as after a refused Save payout (`?check=1`). */
  initialCheck?: boolean;
  /** The text of an amount that couldn't be read (`?amount=` in the prototype), shown with its error. */
  amountText?: string;
  demoOffline?: boolean;
};

/**
 * Record payout (flows.md screen 20, manager and owner only): date (today), amount, Advance or Payment, how it was
 * paid, a note. Save payout goes back to the crew member's page, which shows the new balance and a toast. Payouts
 * never queue: with no signal Save payout is disabled with the "Needs connection" line. Props only.
 */
export function PayoutForm({
  crewId,
  name,
  balanceCents,
  initial,
  initialCheck = false,
  amountText,
  demoOffline = false,
}: PayoutFormProps) {
  const router = useRouter();
  const online = useOnline(demoOffline);
  const [v, setV] = useState(initial);
  const [checked, setChecked] = useState(initialCheck);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const { style, barProps } = usePinnedBar(checked);
  const latest = useRef(v);
  useLayoutEffect(() => {
    latest.current = v;
  });
  const set = <K extends keyof PayoutFormValues>(key: K, value: PayoutFormValues[K]) => {
    setV((prev) => ({ ...prev, [key]: value }));
    setFailed(null);
  };
  const problems = checked ? payoutProblems(v) : { ready: true };
  const b = balanceView(balanceCents);

  async function save() {
    // A tap on Save may not blur the amount still being typed (iOS): commit it now, so the check sees what it became.
    flushSync(() => (document.activeElement as HTMLElement | null)?.blur());
    const now = latest.current;
    setChecked(true);
    const input = payoutInput(crewId, now);
    if (!input) return;
    setSaving(true);
    setFailed(null);
    try {
      const r = await recordPayout(input);
      if (r.ok) {
        // Replace, not push: Back from the crew page must not reopen a filled-in form.
        router.replace(`/crew/${crewId}?saved=${input.kind}`);
        return;
      }
      setFailed(r.message);
      setSaving(false);
    } catch {
      setFailed(`Couldn't save this. ${NEEDS_CONNECTION}`);
      setSaving(false);
    }
  }

  return (
    <div data-screen="payout" style={style} className={cx("flex flex-col gap-6", FORM_WIDTH, "pin-pad")}>
      <div className="flex flex-col gap-2">
        <Heading crewId={crewId} name={name} />
        <p data-payout-balance={b.kind} className="text-body text-ink [overflow-wrap:anywhere]">
          {name}:{" "}
          <span className="num">
            {b.word.toLowerCase()} {b.amount}
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div data-field="payout-date">
          <Field
            label="Date paid"
            inputMode="text"
            type="date"
            value={v.date}
            onChange={(e) => set("date", e.target.value)}
            error={problems.date}
          />
        </div>
        <div data-field="payout-amount">
          <MoneyField
            label="Amount"
            defaultText={v.amountCents === "unreadable" ? amountText : undefined}
            defaultCents={typeof v.amountCents === "number" ? v.amountCents : undefined}
            onCentsChange={(c) => set("amountCents", c)}
            error={problems.amount}
          />
        </div>
        <div data-field="payout-kind" className="flex flex-col gap-1.5">
          <p className={LABEL}>Advance or payment</p>
          <Segmented
            legend="Advance or payment"
            fill
            name="payout-kind"
            options={PAYOUT_KINDS}
            value={v.kind}
            onChange={(k) => set("kind", k as PayoutKind)}
          />
          <p className="text-meta text-ink-2">
            An advance is paid before a pay run; a payment pays what is owed.
          </p>
          {problems.kind ? <ErrorMessage>{problems.kind}</ErrorMessage> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <p className={LABEL}>How it was paid</p>
          <ChoiceChip
            legend="How it was paid"
            name="payout-method"
            options={PAYOUT_METHODS}
            value={v.method}
            onChange={(m) => set("method", m as PayoutMethod)}
          />
        </div>
        <Field
          label="Note (optional)"
          inputMode="text"
          autoComplete="off"
          value={v.note}
          onChange={(e) => set("note", e.target.value)}
        />
      </div>

      <PinnedAction
        barProps={barProps}
        error={failed}
        hintOnSide
        hint={online ? missingHint(problems) : NEEDS_CONNECTION}
      >
        <Button
          disabled={!online}
          loading={saving}
          loadingLabel="Saving payout"
          onClick={save}
          className="w-full"
        >
          Save payout
        </Button>
      </PinnedAction>
    </div>
  );
}

/** A server failure: the back row stays, the body says so and offers Try again as the one primary button. */
export function PayoutError({ crewId }: { crewId: string }) {
  return (
    <div data-screen="payout" className={cx("flex flex-col gap-6", FORM_WIDTH)}>
      <Heading crewId={crewId} name={null} />
      <LoadError primary />
    </div>
  );
}

/** The form while it loads (`?demo=loading`): the title is real; the fields and the pinned bar are blocks shaped like them. */
export function PayoutSkeleton() {
  const { style, barProps } = usePinnedBar(null);
  return (
    <div
      data-screen="payout"
      aria-busy="true"
      style={style}
      className={cx("flex flex-col gap-6", FORM_WIDTH, "pin-pad")}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <Skeleton width={160} height={24} className="my-3" />
          <h1 className="text-title text-ink">Record payout</h1>
        </div>
        <Skeleton width={200} height={24} />
      </div>
      <div className="flex flex-col gap-4">
        <FieldSkeleton />
        <FieldSkeleton />
        <div className="flex flex-col gap-1.5">
          <Skeleton width={160} height={24} />
          <Skeleton height={56} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton width={140} height={24} />
          <div className="flex flex-wrap gap-2">
            {[76, 140, 76].map((w, i) => (
              <Skeleton key={i} width={w} height={48} rounded="full" />
            ))}
          </div>
        </div>
        <FieldSkeleton />
      </div>
      <PinnedAction barProps={barProps}>
        <Skeleton height={52} />
      </PinnedAction>
    </div>
  );
}
