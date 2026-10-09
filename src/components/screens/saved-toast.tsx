"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Toast } from "@/components/ui/toast";

/**
 * A level-3 toast shown once when a page opens after a save ("Payment saved."). Once shown, the
 * `?saved=` flag leaves the address (native replaceState: no server round trip, so the toast stays
 * up), and a reload or a Back to this page never shows it again.
 */
export function SavedToast({ message }: { message: string }) {
  const [open, setOpen] = useState(true);
  const pathname = usePathname();
  useEffect(() => {
    window.history.replaceState(null, "", pathname);
  }, [pathname]);
  return <Toast open={open} onOpenChange={setOpen} message={message} viewportClassName="toast-above-bar" />;
}
