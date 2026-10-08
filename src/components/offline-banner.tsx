import { cx } from "@/lib/cx";

export type OfflineBannerProps = {
  className?: string;
  /** Replaces the default sentence on a screen that does not queue what you do (one plain sentence). */
  message?: string;
};

/** DESIGN.md §4 offline banner: slim `ink` bar, `surface` text, left-aligned, body size. */
export function OfflineBanner({ className, message }: OfflineBannerProps) {
  return (
    <div
      role="status"
      className={cx(
        "flex min-h-10 items-center bg-bar px-4 py-2 text-left text-body text-on-bar",
        className,
      )}
    >
      {message ?? "No signal — entries are saved on this device and will send automatically."}
    </div>
  );
}
