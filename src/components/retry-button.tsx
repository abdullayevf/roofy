"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

/** "Try again" for a screen that shows its own error: asks the server for the page again. */
export function RetryButton({ className, variant = "primary" }: { className?: string; variant?: "primary" | "secondary" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant={variant} loading={pending} loadingLabel="Trying again" onClick={() => start(() => router.refresh())} className={className}>
      Try again
    </Button>
  );
}
