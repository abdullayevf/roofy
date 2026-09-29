"use client";
import { useEffect } from "react";
import { ErrorState } from "@/components/page-states";

/** A screen failed to load; the tab bar stays, so the person can go elsewhere or try again. */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ErrorState onRetry={retry} />;
}
