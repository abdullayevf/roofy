"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { shareOrCopy } from "./share-link";
import { LINK_COPIED } from "./statement-text";

/**
 * Share on the statement page itself: hands this page's own link to the phone's share sheet, or copies it where there
 * isn't one (desktop browsers). The link already exists, so nothing is made and no connection is asked for.
 */
export function StatementShareButton() {
  const [copied, setCopied] = useState(false);

  async function share() {
    setCopied(false);
    const outcome = await shareOrCopy(window.location.href.split("?")[0]!, navigator).catch(() => null);
    setCopied(outcome === "copied");
  }

  return (
    <div data-statement-share="" className="flex flex-col items-start gap-1 print:hidden">
      <Button variant="secondary" onClick={share}>
        Share
      </Button>
      <p role="status" className="text-meta text-ink-2 empty:hidden">
        {copied ? LINK_COPIED : ""}
      </p>
    </div>
  );
}
