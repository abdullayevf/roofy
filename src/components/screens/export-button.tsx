"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { EXPORT_FILENAME } from "./export-text";
import { useOnline } from "./use-online";

type Phase = "idle" | "exporting" | "done" | "failed";

/** The one sentence under the off button when there is no signal. */
export const EXPORT_NEEDS_CONNECTION = "Export needs a connection.";

/**
 * The one Export workspace button. It asks the server for the file, saves it, and says so. Without a connection it
 * stays off and gives the one Needs connection sentence; the files list above still reads.
 */
export function ExportWorkspaceButton({ demoOffline }: { demoOffline: boolean }) {
  const online = useOnline(demoOffline);
  const [phase, setPhase] = useState<Phase>("idle");
  const result = useRef<HTMLParagraphElement>(null);

  // The message can land below the visible part of a short screen, under the tab bar: bring it up above the bar (N15).
  useEffect(() => {
    if (phase === "done" || phase === "failed") result.current?.scrollIntoView({ block: "nearest" });
  }, [phase]);

  async function run() {
    setPhase("exporting");
    try {
      const res = await fetch("/export/download", { cache: "no-store" });
      if (!res.ok) throw new Error("export failed");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = EXPORT_FILENAME;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setPhase("done");
    } catch {
      setPhase("failed");
    }
  }

  return (
    <div data-export-action="" className="flex flex-col items-start gap-3">
      <Button
        variant="primary"
        onClick={run}
        loading={phase === "exporting"}
        loadingLabel="Exporting"
        disabled={!online}
        reason={online ? undefined : EXPORT_NEEDS_CONNECTION}
        className="w-full sm:w-auto sm:min-w-60"
      >
        Export workspace
      </Button>
      {phase === "done" ? (
        <p ref={result} role="status" className="flex scroll-mb-[var(--tab-bar-height)] items-start gap-2 text-body text-ink">
          <CheckCircle size={24} aria-hidden="true" className="shrink-0 text-ink" />
          <span>
            Done. <span className="whitespace-nowrap">{EXPORT_FILENAME}</span> is saved to your downloads.
          </span>
        </p>
      ) : null}
      {phase === "failed" ? (
        <p ref={result} role="alert" className="flex scroll-mb-[var(--tab-bar-height)] items-start gap-2 text-body text-ink">
          <WarningCircle size={24} aria-hidden="true" className="shrink-0 text-over" />
          Couldn&apos;t make the file. Try again.
        </p>
      ) : null}
    </div>
  );
}
