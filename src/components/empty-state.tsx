import { Button } from "./ui/button";
import { cx } from "@/lib/cx";

export type EmptyStateProps = {
  /** One sentence of direction, e.g. "No jobs yet." */
  message: string;
  /** Omit when the reader can't do anything about it (a foreman with no jobs). */
  actionLabel?: string;
  href?: string;
  onClick?: () => void;
  className?: string;
};

/** DESIGN.md §4 empty state: one sentence + the action button, no illustration, centred. */
export function EmptyState({ message, actionLabel, href, onClick, className }: EmptyStateProps) {
  return (
    <div className={cx("flex flex-col items-center gap-4 px-4 py-12 text-center", className)}>
      <p className="text-balance text-body text-ink-2">{message}</p>
      {actionLabel ? (
        <Button variant="primary" href={href} onClick={onClick}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
