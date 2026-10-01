"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Whether this phone has a connection, for screens that never queue a save (jobs, crew, pay, settings). `demoOffline`
 * is the prototype's `?demo=offline`, which says no whatever the browser thinks.
 */
export function useOnline(demoOffline = false): boolean {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  return online && !demoOffline;
}

/** The sentence under a disabled save when there is no signal (flows.md "Needs connection"). */
export const NEEDS_CONNECTION = "Needs connection. Try again once you're back online.";
