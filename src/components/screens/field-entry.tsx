"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { addDays } from "@/domain/dates";
import { formatDate } from "@/lib/format";
import { cx } from "@/lib/cx";
import { EmptyState } from "@/components/empty-state";
import { Segmented } from "@/components/ui/segmented";

/** The widest a field-entry screen grows (grouped rows read badly wider, so landscape phones stop here too). */
export const ENTRY_WIDTH = "max-w-150";

export type EntryKind = "crew-day" | "progress" | "no-work";

const KINDS: { value: EntryKind; label: string; href: string }[] = [
  { value: "crew-day", label: "Crew day", href: "/log" },
  { value: "progress", label: "Progress", href: "/log/progress" },
  { value: "no-work", label: "No work", href: "/log/no-work" },
];

/** The Log title and the switch between Crew day, Progress and No work (flows.md "The Log entry chooser"). One tap to switch. */
export function EntryTabs({ active, demo }: { active: EntryKind; demo?: string }) {
  const router = useRouter();
  const [, startNav] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title text-ink">Log</h1>
      <Segmented
        legend="Log entry type"
        name="log-entry-type"
        value={active}
        options={KINDS.map(({ value, label }) => ({ value, label }))}
        onChange={(next) => {
          const kind = KINDS.find((k) => k.value === next);
          if (kind) startNav(() => router.push(demo ? `${kind.href}?demo=${encodeURIComponent(demo)}` : kind.href));
        }}
      />
    </div>
  );
}

/** "Today, Mon 28 Sep" above the 2 px ink rule the chalk line draws along when the entry is saved. */
export function EntryDate({ date, today, saved = false }: { date: string; today: string; saved?: boolean }) {
  const word = date === today ? "Today" : date === addDays(today, -1) ? "Yesterday" : null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-meta text-ink-2">Date</p>
      <p className="text-heading text-ink">
        {word ? `${word}, ` : ""}
        {formatDate(date, today)}
      </p>
      <span aria-hidden="true" data-slot="date-rule" className="relative block h-0.5 bg-ink">
        <span
          data-testid="chalk-line"
          className={cx(
            "absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-chalk transition-[width] duration-300 ease-out motion-reduce:transition-none",
            saved ? "w-full" : "w-0",
          )}
        />
      </span>
    </div>
  );
}

/**
 * Nothing to log to. A manager is told what to add; a foreman is told they can log once a manager adds them to a
 * job (field-1 ruling F3/D11), with no button they cannot use.
 */
export function EntryEmpty({
  foreman,
  managerMessage,
  actionLabel,
  href,
}: {
  foreman: boolean;
  managerMessage: string;
  actionLabel: string;
  href: string;
}) {
  return foreman ? (
    <EmptyState message="You can log once a manager adds you to a job." />
  ) : (
    <EmptyState message={managerMessage} actionLabel={actionLabel} href={href} />
  );
}

/** A `?demo=` value rides along on links so a demo state survives a pick. */
export function withDemo(path: string, params: Record<string, string | undefined>, demo?: string): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  if (demo) q.set("demo", demo);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/**
 * The pinned action bar's height changes with its reason line and error message; the page pads by what it
 * measures (`--pin-action-height`). Spread `style` on the screen and `barRef` on the bar.
 */
export function usePinnedBar(remeasureOn: unknown) {
  const barRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState("9rem");
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const measure = () => setHeight(`${Math.ceil(el.getBoundingClientRect().height) + 8}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [remeasureOn]);
  return { barRef, style: { "--pin-action-height": height } as CSSProperties };
}
