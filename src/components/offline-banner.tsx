import { cx } from "@/lib/cx";

export type OfflineBannerProps = {
  className?: string;
};

/** DESIGN.md §4 offline banner: slim `ink` bar, `surface` text, left-aligned, body size. */
export function OfflineBanner({ className }: OfflineBannerProps) {
  return (
    <div
      role="status"
      className={cx(
        "flex min-h-10 items-center bg-ink px-4 py-2 text-left text-body text-surface",
        className,
      )}
    >
      No signal — entries are saved on this phone and will send automatically.
    </div>
  );
}
