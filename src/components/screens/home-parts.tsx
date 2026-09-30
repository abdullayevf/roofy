import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { cx } from "@/lib/cx";
import { OutboxBadge } from "@/components/outbox-badge";
import { TapeBar, type TapeBarProps } from "@/components/tape-bar";
import { Button } from "@/components/ui/button";
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

/** One width rule for Home's buttons: full width on a phone, the same 240 px minimum from 640 px up. */
export const HOME_BUTTON = "w-full sm:w-auto sm:min-w-60 sm:self-start";

/** The desktop cap on a job card's tape and figures, so labels stay near values and every right edge is the tape's % slot. */
export const CARD_BLOCK = "lg:max-w-120";

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

export function Section({
  title,
  children,
  className,
  id,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cx("flex scroll-mt-4 flex-col gap-2", className)}>
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
 * Home with nothing to show: a sentence under the title, left-aligned with it, and (when there is something to do)
 * one primary button: full width and 52 px on a phone, its natural width beside the title's left edge on desktop.
 */
export function HomeEmpty({ message, actionLabel, href }: { message: string; actionLabel?: string; href?: string }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-ink">{message}</p>
      {actionLabel ? (
        <Button variant="primary" href={href} className={HOME_BUTTON}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
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
      <TapeBar className={cx("mt-2", CARD_BLOCK)} {...tape} />
      {children}
    </Link>
  );
}

/** The lead figure's height (44 px phone, 52 px desktop) as a block, so nothing jumps when it loads. */
export function KeyFigureSkeleton({ width }: { width: number }) {
  return (
    <div className="flex h-11 items-center lg:h-13">
      <Skeleton width={width} height={32} />
    </div>
  );
}

/** A GROUP row's shape while it loads: the icon, a two-line sentence and the caret of a Needs attention row. */
export function AttentionRowSkeleton() {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-1.5 lg:min-h-12 lg:py-1">
      <Skeleton width={24} height={24} rounded="full" className="shrink-0" />
      <div className="flex flex-1 flex-col gap-1">
        <Skeleton height={20} />
        <Skeleton width={160} height={20} />
      </div>
      <Skeleton width={24} height={24} className="shrink-0" />
    </div>
  );
}

/** A list row's shape while it loads: label left, figure right, the chevron's slot kept. */
export function ListRowSkeleton() {
  return (
    <div className="flex min-h-[64px] items-center gap-x-4 px-4 lg:min-h-12">
      <div className="flex-1">
        <Skeleton width={130} height={24} />
      </div>
      <Skeleton width={96} height={24} />
      <span className="size-6 shrink-0" />
    </div>
  );
}

/**
 * A job card's shape while it loads: name and caret, `lines` meta lines, the tape bar (track and % slot), then either
 * `figures` label/value lines (manager) or one meta line (foreman). Same block cap as the real card.
 */
export function JobCardSkeleton({ lines, figures }: { lines: number; figures: number }) {
  return (
    <div className="px-4 py-3 lg:py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex h-6 items-center">
            <Skeleton width={220} height={20} />
          </div>
          {Array.from({ length: lines }, (_, i) => (
            <div key={i} className="flex h-5 items-center">
              <Skeleton width={160} height={14} />
            </div>
          ))}
        </div>
        <Skeleton width={24} height={24} className="mt-3 shrink-0" />
      </div>
      <div className={cx("mt-2 grid grid-cols-[minmax(0,1fr)_min(8.5rem,45%)] items-center gap-x-[min(1.75rem,8vw)]", CARD_BLOCK)}>
        <Skeleton height={12} />
        <Skeleton width={110} height={24} />
      </div>
      {figures === 0 ? (
        <div className="mt-2 flex h-5 items-center">
          <Skeleton width={140} height={14} />
        </div>
      ) : (
        <div className={cx("mt-2 flex flex-col gap-1", CARD_BLOCK)}>
          {Array.from({ length: figures }, (_, i) => (
            <div key={i} className="flex h-6 items-center justify-between gap-4">
              <Skeleton width={110} height={14} />
              <Skeleton width={120} height={20} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
