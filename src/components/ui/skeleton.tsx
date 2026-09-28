import { cx } from "@/lib/cx";

export type SkeletonProps = {
  /** Width in px, matching the real content it stands in for. Omit for 100%. */
  width?: number;
  /** Height in px, matching the real content it stands in for. */
  height: number;
  rounded?: "control" | "group" | "full";
  className?: string;
};

const ROUNDED = { control: "rounded-control", group: "rounded-group", full: "rounded-full" } as const;

/** DESIGN.md §4/§7 skeleton: `line`-coloured blocks sized exactly like the content, no shimmer. */
export function Skeleton({ width, height, rounded = "control", className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cx("block bg-line", ROUNDED[rounded], className)}
      style={{ width: width ? `${width}px` : "100%", height: `${height}px` }}
    />
  );
}
