"use client";

import { Button } from "@/components/ui/button";

/** Print on a report: the browser's own print (the page has print styles); nothing is made on the server. */
export function ReportPrintButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()} className="w-full sm:w-auto sm:min-w-40">
      Print
    </Button>
  );
}
