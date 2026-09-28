import { Button } from "./ui/button";
import { cx } from "@/lib/cx";

export type EmptyStateProps = {
  /** One sentence of direction, e.g. "No jobs yet." */
  message: string;
  actionLabel: string;
  href?: string;
  onClick?: () => void;
  className?: string;
};

/** DESIGN.md §4 empty state: one sentence + the action button, no illustration, centred. */
export function EmptyState({ message, actionLabel, href, onClick, className }: EmptyStateProps) {
  return (
    <div className={cx("flex flex-col items-center gap-4 px-4 py-12 text-center", className)}>
      <p className="text-body text-ink-2">{message}</p>
      <Button variant="primary" href={href} onClick={onClick}>
        {actionLabel}
      </Button>
    </div>
  );
}
