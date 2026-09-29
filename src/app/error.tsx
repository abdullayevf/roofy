"use client";
import { useEffect } from "react";
import { ErrorState } from "@/components/page-states";

/** Root error boundary: the shell has its own in `(app)/error.tsx`; this catches everything outside it. */
export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto max-w-xl p-4">
      <ErrorState onRetry={retry} />
    </main>
  );
}
