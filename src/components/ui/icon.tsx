import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

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

/** DESIGN.md §4 icon wrapper: Phosphor, 24 px, aria-hidden unless labelled. */
export function Icon({ icon: Glyph, label, size = 24, weight = "regular", className }: IconProps) {
  return label ? (
    <Glyph size={size} weight={weight} className={className} role="img" aria-label={label} />
  ) : (
    <Glyph size={size} weight={weight} className={className} aria-hidden="true" />
  );
}
