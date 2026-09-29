import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { cx } from "@/lib/cx";

export type IconProps = {
  /** A Phosphor icon component, e.g. `CheckCircle` from "@phosphor-icons/react/dist/ssr". */
  icon: PhosphorIcon;
  /** Screen-reader label. Omit for a purely decorative icon (it renders aria-hidden). */
  label?: string;
  /** Pixel size. DESIGN.md §4: 24 px in UI. */
  size?: number;
  weight?: "regular" | "fill";
  className?: string;
};

/**
 * DESIGN.md §4 icon wrapper: Phosphor, 24 px, aria-hidden unless labelled.
 * `shrink-0` so a flex parent can never squeeze the glyph below its size.
 */
export function Icon({ icon: Glyph, label, size = 24, weight = "regular", className }: IconProps) {
  const cls = cx("shrink-0", className);
  return label ? (
    <Glyph size={size} weight={weight} className={cls} role="img" aria-label={label} />
  ) : (
    <Glyph size={size} weight={weight} className={cls} aria-hidden="true" />
  );
}
