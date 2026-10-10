"use client";

import { useState } from "react";
import type { Id } from "@/data/contracts";
import { shareStatement } from "@/app/actions/pay";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { SHARE_COPIED, SHARE_FAILED, shareOrCopy } from "./share-link";
import { NEEDS_CONNECTION, useOnline } from "./use-online";

type Shared = { kind: "idle" } | { kind: "copied" } | { kind: "failed"; message: string };

/**
 * Share statement: makes the person's private 90-day link for an approved run and hands it to the phone's share
 * sheet, or copies it where there isn't one. It needs a connection.
 */
export function ShareStatementButton({
  payRunId,
  crewMemberId,
  demoOffline = false,
  className,
}: {
  payRunId: Id;
  crewMemberId: Id;
  demoOffline?: boolean;
  className?: string;
}) {
  const online = useOnline(demoOffline);
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState<Shared>({ kind: "idle" });

  async function share() {
    setBusy(true);
    setShared({ kind: "idle" });
    try {
      const result = await shareStatement(payRunId, crewMemberId);
      if (!result.ok) return setShared({ kind: "failed", message: result.message });
      const outcome = await shareOrCopy(`${window.location.origin}${result.share.path}`, navigator);
      setShared(outcome === "copied" ? { kind: "copied" } : { kind: "idle" });
    } catch {
      setShared({ kind: "failed", message: SHARE_FAILED });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-share-statement="" className={cx("flex flex-col gap-1", className)}>
      <Button
        variant="secondary"
        loading={busy}
        loadingLabel="Making link"
        disabled={!online}
        onClick={share}
        className="self-end"
      >
        Share statement
      </Button>
      {!online ? <p className="text-meta text-ink-2">{NEEDS_CONNECTION}</p> : null}
      <p role="status" className="text-meta text-ink-2 empty:hidden">
        {shared.kind === "copied" ? SHARE_COPIED : shared.kind === "failed" ? shared.message : ""}
      </p>
    </div>
  );
}
