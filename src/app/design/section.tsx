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

/** A labelled subgroup inside a section, e.g. splitting "Stage status" from "Job status". */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-body-strong text-ink">{title}</p>
      {children}
    </div>
  );
}
