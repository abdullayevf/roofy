"use client";

import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";

/** Print on a report: the browser's own print (the page has print styles); nothing is made on the server. Off when there is nothing to print. */
export function ReportPrintButton({ disabled = false, className }: { disabled?: boolean; className?: string }) {
  return (
    <Button variant="secondary" disabled={disabled} onClick={() => window.print()} className={cx("w-full sm:w-auto sm:min-w-40", className)}>
      Print
    </Button>
  );
}
