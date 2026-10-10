"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { OfflineBanner } from "@/components/offline-banner";
import { queuesOffline } from "./active";

/**
 * The offline banner, except on a form that never queues (New and Edit job, Edit expense): "saved on this device" would be false
 * there, and the form already says "Needs connection" beside its disabled button. Stage done never queues either, so
 * it gets a one-sentence banner that agrees with its disabled Confirm done.
 */
export function OfflineSlot() {
  const pathname = usePathname() ?? "/";
  const edit = useSearchParams()?.get("edit") ?? null;
  if (/^\/jobs\/[^/]+\/stages\/[^/]+\/done\/?$/.test(pathname))
    return <OfflineBanner message="No signal. Marking a stage done needs a connection." />;
  return queuesOffline(pathname, edit) ? <OfflineBanner /> : null;
}
