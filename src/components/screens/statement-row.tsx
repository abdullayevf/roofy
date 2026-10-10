"use client";

import type { StatementRef } from "@/data/contracts";
import { MoneyCell } from "@/components/ui/money-cell";
import { statementPeriodText } from "./crew-detail-text";
import { ShareStatementButton } from "./share-statement";

/**
 * One statement in a person's list: the pay period, what it came to, and Share. Share makes the private 90-day link
 * and hands it to the phone's share sheet, or copies it where there isn't one. It needs a connection and an approved run.
 */
export function StatementRow({
  statement,
  crewMemberId,
  today,
  demoOffline = false,
}: {
  statement: StatementRef;
  crewMemberId: string;
  today: string;
  demoOffline?: boolean;
}) {
  const draft = statement.status === "draft";
  return (
    <div data-statement-row="" className="flex min-h-16 flex-col justify-center gap-2 px-4 py-2">
      <div className="flex items-start justify-between gap-x-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-strong text-ink [overflow-wrap:anywhere]">{statementPeriodText(statement.period, today)}</span>
          <span className="text-meta text-ink-2">{draft ? "Draft, not shared until approved" : "Approved"}</span>
        </div>
        <MoneyCell cents={statement.totalCents} />
      </div>
      {statement.shareable ? (
        <ShareStatementButton payRunId={statement.payRunId} crewMemberId={crewMemberId} demoOffline={demoOffline} />
      ) : null}
    </div>
  );
}
