import type { ReactNode } from "react";

/** One component section on the gallery: a sentence-case heading + its demos. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-line pt-8 first:border-t-0 first:pt-0">
      <h2 className="text-heading text-ink">{title}</h2>
      {children}
    </section>
  );
}

/** One named state inside a section (e.g. "Default", "Focus", "Error"). */
export function Swatch({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-meta text-ink-2">{label}</p>
      {children}
    </div>
  );
}

/**
 * Renders the same content twice, once under a forced light theme and once
 * under a forced dark theme, side by side on desktop (stacked on phone so
 * neither column has to shrink below a usable width at 390 px).
 */
export function ThemePair({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div data-theme="light" className="flex flex-col gap-4 rounded-group bg-galv p-4">
        {children}
      </div>
      <div data-theme="dark" className="flex flex-col gap-4 rounded-group bg-galv p-4">
        {children}
      </div>
    </div>
  );
}
