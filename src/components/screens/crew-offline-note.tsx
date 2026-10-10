"use client";

import { formatTime } from "@/lib/format";
import { useOnline } from "./use-online";

/**
 * The Crew list only reads, so offline it says one plain sentence and nothing about sending later:
 * "No signal. Balances as of 7:42 am." The time is when the figures last loaded, in the workspace's zone.
 */
export function CrewOfflineNote({ asOf, timeZone, manager, demoOffline }: { asOf: string; timeZone: string; manager: boolean; demoOffline: boolean }) {
  const online = useOnline(demoOffline);
  if (online) return null;
  const time = formatTime(asOf, timeZone).replace(" ", " ");
  return (
    <p role="status" data-crew-offline="" className="text-body text-ink">
      {manager ? `No signal. Balances as of ${time}.` : `No signal. This list is as of ${time}.`}
    </p>
  );
}
