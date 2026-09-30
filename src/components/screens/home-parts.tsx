import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { cx } from "@/lib/cx";
import { OutboxBadge } from "@/components/outbox-badge";
import { TapeBar, type TapeBarProps } from "@/components/tape-bar";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Both Homes sit in one column (~720 px), centred on a tablet or a phone on its side and starting at the same left
 * edge on desktop in every state and role, so a label stays near its value (i6-F2).
 */
export const COLUMN = "mx-auto flex w-full max-w-180 flex-col gap-8 lg:mx-0 lg:gap-10";
export const GROUP = "divide-y divide-line rounded-group border-group bg-surface";
export const FOCUS =
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-3 focus-visible:outline-chalk-link";
/** A tappable row inside a GROUP. */
export const ROW =
  "flex min-h-14 items-center gap-3 px-4 py-2 first:rounded-t-group last:rounded-b-group active:bg-galv lg:min-h-12";

export const whole = (bp: number) => Math.round(bp / 100);

/** Title with the outbox badge right after it, on a row that keeps its height whether or not the badge shows. */
export function HomeTitle({ waiting, attention }: { waiting: number; attention: number }) {
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1">
      <h1 className="text-title text-ink">Home</h1>
      <OutboxBadge count={waiting} attention={attention} className="shrink-0" />
    </div>
  );
}

export function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("flex flex-col gap-2", className)}>
      <h2 className="text-heading text-ink">{title}</h2>
      {children}
    </section>
  );
}

/** The lead figure under the title: never wider than the screen; at 200% text zoom the size gives way to the width. */
export function KeyFigure({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-figure-xl num text-ink [overflow-wrap:anywhere]" style={{ fontSize: "min(2.5rem, 10.5vw)" }}>
      {children}
    </p>
  );
}

/**
 * A job card in either Home: name, stage line, a tape bar, then the caller's detail lines.
 * The whole card is the link. `tape` is the bar's props, so a foreman card passes progress only.
 */
export function JobCard({
  href,
  name,
  lines,
  tape,
  children,
}: {
  href: string;
  name: string;
  lines: React.ReactNode[];
  tape: TapeBarProps;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cx("block min-h-[64px] px-4 py-3 first:rounded-t-group last:rounded-b-group active:bg-galv lg:py-2", FOCUS)}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-body-strong text-ink [overflow-wrap:anywhere]">{name}</span>
          {lines.map((line, i) => (
            <span key={i} className="block text-meta text-ink [overflow-wrap:anywhere]">
              {line}
            </span>
          ))}
        </span>
        <CaretRight size={24} aria-hidden="true" className="mt-3 shrink-0 text-ink-2" />
      </span>
      <TapeBar className="mt-2" {...tape} />
      {children}
    </Link>
  );
}

/** A job card's shape while it loads: name, `lines` meta lines, the tape bar and `figures` label/value lines. */
export function JobCardSkeleton({ lines, figures }: { lines: number; figures: number }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <Skeleton width={220} height={24} />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={160} height={16} />
      ))}
      <Skeleton height={12} />
      {Array.from({ length: figures }, (_, i) => (
        <div key={i} className="flex justify-between gap-4">
          <Skeleton width={110} height={16} />
          <Skeleton width={120} height={20} />
        </div>
      ))}
    </div>
  );
}
