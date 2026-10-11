"use client";

import { useState } from "react";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { EXPORT_FILENAME } from "./export-text";
import { NEEDS_CONNECTION, useOnline } from "./use-online";

type Phase = "idle" | "exporting" | "done" | "failed";

/**
 * The one Export workspace button. It asks the server for the file, saves it, and says so. Without a connection it
 * stays off and gives the one Needs connection sentence; the files list above still reads.
 */
export function ExportWorkspaceButton({ demoOffline }: { demoOffline: boolean }) {
  const online = useOnline(demoOffline);
  const [phase, setPhase] = useState<Phase>("idle");

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
    <div data-export-action="" className="flex flex-col gap-3">
      <Button
        variant="primary"
        onClick={run}
        loading={phase === "exporting"}
        loadingLabel="Exporting"
        disabled={!online}
        reason={online ? undefined : NEEDS_CONNECTION}
        className="w-full sm:w-auto sm:min-w-60"
      >
        Export workspace
      </Button>
      {phase === "done" ? (
        <p role="status" className="flex items-start gap-2 text-body text-ink">
          <CheckCircle size={24} aria-hidden="true" className="shrink-0 text-ink" />
          Done. {EXPORT_FILENAME} is saved to your downloads.
        </p>
      ) : null}
      {phase === "failed" ? (
        <p role="alert" className="flex items-start gap-2 text-body text-ink">
          <WarningCircle size={24} aria-hidden="true" className="shrink-0 text-over" />
          Couldn&apos;t make the file. Try again.
        </p>
      ) : null}
    </div>
  );
}
