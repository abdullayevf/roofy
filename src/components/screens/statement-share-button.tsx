"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { COPY_FAILED, shareThisPage } from "./share-link";
import { LINK_COPIED } from "./statement-text";

/**
 * Share on the statement page itself: hands this page's own link to the phone's share sheet, or copies it where there
 * isn't one (desktop browsers). The link already exists, so nothing is made and no connection is asked for.
 */
export function StatementShareButton() {
  const [outcome, setOutcome] = useState<"shared" | "copied" | "failed" | null>(null);

  async function share() {
    setOutcome(null);
    setOutcome(await shareThisPage(window.location.href.split("?")[0]!, navigator));
  }

  return (
    <div data-statement-share="" className="flex flex-col items-start gap-1 print:hidden">
      <Button variant="secondary" onClick={share}>
        Share
      </Button>
      <p
        role="status"
        data-statement-share-outcome={outcome ?? ""}
        className={`empty:hidden ${outcome === "failed" ? "text-body-strong text-over" : "text-meta text-ink-2"}`}
      >
        {outcome === "copied" ? LINK_COPIED : outcome === "failed" ? COPY_FAILED : ""}
      </p>
    </div>
  );
}
