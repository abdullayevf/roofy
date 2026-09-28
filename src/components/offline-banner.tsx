import { cx } from "@/lib/cx";

export type OfflineBannerProps = {
  className?: string;
};

/** DESIGN.md §4 offline banner: slim `ink` bar, `surface` text. */
export function OfflineBanner({ className }: OfflineBannerProps) {
  return (
    <div
      role="status"
      className={cx(
        "flex min-h-8 items-center justify-center bg-ink px-4 py-1.5 text-center text-meta text-surface",
        className,
      )}
    >
      No signal — entries are saved on this phone and will send automatically.
    </div>
  );
}
