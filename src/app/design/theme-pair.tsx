"use client";

import type { ReactNode } from "react";

/**
 * Renders the same content twice, once under a forced light theme and once
 * under a forced dark theme, side by side on desktop (stacked on phone so
 * neither column has to shrink below a usable width at 390 px).
 *
 * Each copy is its own `<form>`: native radio groups are scoped by name
 * *within a form*, so without this the light and dark copy of a radio group
 * (a segmented control, a set of choice chips) are one group, and choosing in
 * one silently unchecks the other. The forms never submit.
 */
export function ThemePair({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <form
        data-theme="light"
        onSubmit={(e) => e.preventDefault()}
        className="flex flex-col gap-4 rounded-group bg-galv p-4"
      >
        {children}
      </form>
      <form
        data-theme="dark"
        onSubmit={(e) => e.preventDefault()}
        className="flex flex-col gap-4 rounded-group bg-galv p-4"
      >
        {children}
      </form>
    </div>
  );
}
