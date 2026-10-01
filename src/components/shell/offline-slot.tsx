"use client";

import { usePathname } from "next/navigation";
import { OfflineBanner } from "@/components/offline-banner";
import { queuesOffline } from "./active";

/**
 * The offline banner, except on a form that never queues (New and Edit job): "saved on this device" would be false
 * there, and the form already says "Needs connection" beside its disabled button.
 */
export function OfflineSlot() {
  const pathname = usePathname();
  return queuesOffline(pathname ?? "/") ? <OfflineBanner /> : null;
}
