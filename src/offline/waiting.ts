/**
 * Entries saved on this phone that have not been sent yet, counted for this visit only. Phase 2 has no device
 * queue, so a save with no signal is counted here for the "N to send" badge; Phase 5's Dexie outbox replaces it.
 */
import { useSyncExternalStore } from "react";

let count = 0;
const listeners = new Set<() => void>();

export const waitingCount = (): number => count;

export function noteWaiting(): void {
  count += 1;
  for (const l of listeners) l();
}

export function forgetWaiting(): void {
  count = 0;
  for (const l of listeners) l();
}

export function subscribeWaiting(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The number of entries waiting on this device from this visit (0 while the page renders on the server). */
export function useWaitingCount(): number {
  return useSyncExternalStore(subscribeWaiting, waitingCount, () => 0);
}
