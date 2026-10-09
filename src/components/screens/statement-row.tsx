"use client";

import { useState } from "react";
import type { StatementRef } from "@/data/contracts";
import { shareStatement } from "@/app/actions/pay";
import { Button } from "@/components/ui/button";
import { MoneyCell } from "@/components/ui/money-cell";
import { statementPeriodText } from "./crew-detail-text";
import { NEEDS_CONNECTION, useOnline } from "./use-online";

type Shared = { kind: "idle" } | { kind: "copied" } | { kind: "failed"; message: string };

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
  const online = useOnline(demoOffline);
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState<Shared>({ kind: "idle" });

  async function share() {
    setBusy(true);
    setShared({ kind: "idle" });
    try {
      const result = await shareStatement(statement.payRunId, crewMemberId);
      if (!result.ok) {
        setShared({ kind: "failed", message: result.message });
        return;
      }
      const url = `${window.location.origin}${result.share.path}`;
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Pay statement", url }).catch(() => undefined);
        setShared({ kind: "idle" });
      } else {
        await navigator.clipboard.writeText(url);
        setShared({ kind: "copied" });
      }
    } catch {
      setShared({ kind: "failed", message: "Couldn't make the link. Try again." });
    } finally {
      setBusy(false);
    }
  }

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
        <Button variant="secondary" loading={busy} loadingLabel="Making link" disabled={!online} onClick={share} className="self-end">
          Share statement
        </Button>
      ) : null}
      {statement.shareable && !online ? <p className="text-meta text-ink-2">{NEEDS_CONNECTION}</p> : null}
      <p role="status" className="text-meta text-ink-2 empty:hidden">
        {shared.kind === "copied" ? "Link copied. It works for 90 days." : shared.kind === "failed" ? shared.message : ""}
      </p>
    </div>
  );
}
