"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { WarningCircle } from "@phosphor-icons/react";
import { addDays } from "@/domain/dates";
import { formatDate } from "@/lib/format";
import { cx } from "@/lib/cx";
import { EmptyState } from "@/components/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/ui/error-message";
import { RetryButton } from "@/components/retry-button";
import { Skeleton } from "@/components/ui/skeleton";
import { keyboardInset } from "./field-input";

/** The widest a field-entry screen grows (grouped rows read badly wider, so landscape phones stop here too). */
export const ENTRY_WIDTH = "mx-auto w-full max-w-150";

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

/**
 * "Today, Mon 28 Sep" above the 2 px ink rule the chalk line draws along when the entry is saved. With `onPick` the
 * same line carries one control beside it that moves the entry to the other day (today or yesterday).
 */
export function EntryDate({
  date,
  today,
  saved = false,
  onPick,
}: {
  date: string;
  today: string;
  saved?: boolean;
  onPick?: (day: "today" | "yesterday") => void;
}) {
  const yesterday = addDays(today, -1);
  const word = date === today ? "Today" : date === yesterday ? "Yesterday" : null;
  const text = `${word ? `${word}, ` : ""}${formatDate(date, today)}`;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-meta text-ink-2">Date</p>
      <div className="flex items-center justify-between gap-3">
        <p className="text-heading text-ink">{text}</p>
        {onPick && !saved ? (
          <Button variant="link" onClick={() => onPick(date === today ? "yesterday" : "today")} className="shrink-0">
            {date === today ? "Use yesterday" : "Use today"}
          </Button>
        ) : null}
      </div>
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

/** An empty state centred in the column and the space the page leaves (the same on every field-entry screen). */
export function EntryEmptyFrame({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[50dvh] flex-col justify-center">{children}</div>;
}

/**
 * Nothing to log to. A manager is told what to add; a foreman is told they can log once a manager adds them to a
 * job (field-1 ruling F3/D11), with a way back to Home and no button they cannot use.
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
  return (
    <EntryEmptyFrame>
      {foreman ? (
        <EmptyState message="You can log once a manager adds you to a job." actionLabel="Go to Home" href="/" />
      ) : (
        <EmptyState message={managerMessage} actionLabel={actionLabel} href={href} />
      )}
    </EntryEmptyFrame>
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

/** A field a keyboard opens for (not a check box, button or list). */
const isTextEntry = (el: Element | null): boolean =>
  el instanceof HTMLTextAreaElement ||
  (el instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "range", "file"].includes(el.type));

/**
 * The pinned action bar. The page pads by the bar's measured height (`--pin-action-height`; the bar's height
 * changes with its reason line and error message). While a text field has focus on a phone the bar sits on the
 * visual viewport, above the on-screen keyboard, instead of above the tab bar (`--keyboard-inset`).
 * Spread `style` on the screen and `barProps` on the bar.
 */
export function usePinnedBar(remeasureOn: unknown) {
  const barRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState("9rem");
  const [inset, setInset] = useState<number | null>(null);
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const measure = () => setHeight(`${Math.ceil(el.getBoundingClientRect().height) + 8}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [remeasureOn]);
  useEffect(() => {
    const vv = window.visualViewport;
    let timer: number | undefined;
    const update = () => {
      const typing = isTextEntry(document.activeElement) && window.innerWidth < 1024;
      setInset(typing ? (vv ? keyboardInset(window.innerHeight, vv) : 0) : null);
    };
    // Leaving a field waits a beat: a press on the bar itself blurs the field first, and the bar must not move
    // out from under the finger before the press lands.
    const left = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(update, 250);
    };
    const entered = (e: FocusEvent) => {
      if (!isTextEntry(e.target as Element | null)) return left();
      window.clearTimeout(timer);
      update();
    };
    document.addEventListener("focusin", entered);
    document.addEventListener("focusout", left);
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("focusin", entered);
      document.removeEventListener("focusout", left);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, []);
  return {
    style: { "--pin-action-height": height } as CSSProperties,
    barProps: {
      ref: barRef,
      "data-keyboard": inset === null ? undefined : "true",
      style: inset === null ? undefined : ({ "--keyboard-inset": `${inset}px` } as CSSProperties),
    },
  };
}

/**
 * The pinned bar's content: an error from a failed save, the primary button, and under it one sentence naming only
 * what is still missing (body size, `ink`). Spread `barProps` from `usePinnedBar`. The sentence goes in a compact
 * bar's place under 500 px tall (CSS hides it there).
 */
export function PinnedAction({
  barProps,
  error,
  hint,
  children,
}: {
  barProps: ReturnType<typeof usePinnedBar>["barProps"];
  error?: string | null;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div {...barProps} data-slot="primary-action" className="pin-action flex flex-col gap-3">
      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      {children}
      {hint ? <p className="pin-hint text-body text-ink">{hint}</p> : null}
    </div>
  );
}

/** A label and a field: what a Job, Stage or Quantity box looks like while it loads. */
export function FieldSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton width={72} height={24} />
      <Skeleton height={52} />
    </div>
  );
}

/** Crew rows: name, then the smaller line under it, and the 48 px box on the right. */
export function CrewRowsSkeleton({ count, withLine = true }: { count: number; withLine?: boolean }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-group border-group bg-surface">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex min-h-16 items-center justify-between gap-4 px-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Skeleton width={120} height={20} />
            {withLine ? <Skeleton width={72} height={16} /> : null}
          </div>
          <Skeleton width={48} height={48} />
        </div>
      ))}
    </div>
  );
}

/**
 * A field-entry screen while it loads (`?demo=loading`): the title and the switch stay live, the date is a
 * label and a line, and `children` are blocks shaped like this screen's form. The Save block is pinned like the
 * real bar (a button-sized block).
 */
export function EntrySkeleton({ screen, active, children }: { screen: string; active: EntryKind; children: React.ReactNode }) {
  const { style, barProps } = usePinnedBar(null);
  return (
    <div data-screen={screen} aria-busy="true" style={style} className={cx("flex flex-col gap-6", ENTRY_WIDTH, "pin-pad")}>
      <EntryTabs active={active} demo="loading" />
      <div className="flex flex-col gap-2">
        <Skeleton width={48} height={20} />
        <Skeleton width={200} height={24} />
        <span aria-hidden="true" className="block h-0.5 bg-line" />
      </div>
      {children}
      <PinnedAction barProps={barProps}>
        <Skeleton height={52} />
      </PinnedAction>
    </div>
  );
}

/** A server failure on a field-entry screen: the title and the switch stay, and the form area says so and offers a retry. */
export function EntryError({ screen, active, demo }: { screen: string; active: EntryKind; demo?: string }) {
  return (
    <div data-screen={screen} className={cx("flex flex-col gap-6", ENTRY_WIDTH)}>
      <EntryTabs active={active} demo={demo} />
      <LoadError />
    </div>
  );
}

/** "Couldn't load this. Try again." with the warning icon in `over` and a retry button. */
export function LoadError() {
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-group border-group bg-surface p-4">
      <p className="flex items-start gap-2 text-body text-ink">
        <WarningCircle size={24} aria-hidden="true" className="shrink-0 text-over" />
        Couldn&apos;t load this. Try again.
      </p>
      <RetryButton variant="secondary" />
    </div>
  );
}
