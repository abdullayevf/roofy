"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { PayRunListItem } from "@/data/contracts";
import { cx } from "@/lib/cx";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { FOCUS, GROUP } from "./home-parts";
import { olderRunsLabel, payRunPeriodText, peopleCountText, RUNS_SHOWN } from "./pay-runs-text";
import { TD, TH } from "./table-cells";

/** A phone row's fixed right column: the total, right-aligned, never squeezed by the period. */
const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_min(8.5rem,40%)] items-start gap-x-4";

function Total({ run }: { run: PayRunListItem }) {
  return <span data-pay-total="" className="block text-right text-figure num text-ink whitespace-nowrap">{formatMoney(run.totalCents)}</span>;
}

/** A phone or tablet row: period, status and people on the left, the total in the right column. */
function PhoneRow({ run, today }: { run: PayRunListItem; today: string }) {
  return (
    <Link
      href={`/pay/${run.id}`}
      prefetch={false}
      data-pay-row=""
      className={cx("relative block min-h-16 py-2 pl-4 pr-9 first:rounded-t-group last:rounded-b-group active:bg-galv", FOCUS)}
    >
      <span className={ROW_GRID}>
        <span className="flex flex-col">
          <span data-pay-period="" className="text-body-strong text-ink">{payRunPeriodText(run.period, today)}</span>
          <StatusChip status={run.status} plain />
          <span className="text-meta text-ink">{peopleCountText(run.peopleCount)}</span>
        </span>
        <Total run={run} />
      </span>
      <CaretRight size={24} aria-hidden="true" className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-2" />
    </Link>
  );
}

/** From 1024 px, a table with the whole row as the link: period, status, people, total. */
function RunsTable({ runs, today }: { runs: PayRunListItem[]; today: string }) {
  return (
    <table className="hidden w-full lg:table">
      <thead>
        <tr>
          <th scope="col" className={TH}>Period</th>
          <th scope="col" className={TH}>Status</th>
          <th scope="col" className={TH}>People</th>
          <th scope="col" className={cx(TH, "text-right")}>Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {runs.map((run) => (
          <tr key={run.id} data-pay-row="" className="relative h-14 hover:bg-galv">
            <td className={TD}>
              <Link href={`/pay/${run.id}`} prefetch={false} className={cx("block text-body-strong text-ink after:absolute after:inset-0", FOCUS)}>
                {payRunPeriodText(run.period, today)}
              </Link>
            </td>
            <td className={TD}>
              <StatusChip status={run.status} plain />
            </td>
            <td className={cx(TD, "text-body text-ink")}>{peopleCountText(run.peopleCount)}</td>
            <td className={cx(TD, "pr-4")}>
              <Total run={run} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The other runs, newest first: the latest eight, then one "Show older pay runs" button for the rest. Phone rows below
 * 1024 px, the table from 1024 px; both show the same runs.
 */
export function PayRunRows({ runs, today }: { runs: PayRunListItem[]; today: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? runs : runs.slice(0, RUNS_SHOWN);
  const hasOlder = runs.length > RUNS_SHOWN;
  return (
    <div className="flex flex-col gap-3">
      <div className={cx(GROUP, "overflow-hidden")}>
        <div className="divide-y divide-line lg:hidden">
          {shown.map((run) => (
            <PhoneRow key={run.id} run={run} today={today} />
          ))}
        </div>
        <RunsTable runs={shown} today={today} />
      </div>
      {hasOlder ? (
        <Button variant="secondary" onClick={() => setAll((v) => !v)} className="w-full sm:w-auto sm:min-w-60 sm:self-start">
          {olderRunsLabel(all)}
        </Button>
      ) : null}
    </div>
  );
}
