import Link from "next/link";
import { WarningCircle, WarningDiamond } from "@phosphor-icons/react/dist/ssr";
import { cx } from "@/lib/cx";

export type NeedsAttentionSeverity = "over" | "watch";

const SEVERITY = {
  over: { icon: WarningCircle, className: "text-over" },
  watch: { icon: WarningDiamond, className: "text-watch" },
} as const;

export type NeedsAttentionItemProps = {
  severity: NeedsAttentionSeverity;
  /** One plain, complete sentence, e.g. "Smith job is $775 over on sheet install." */
  sentence: string;
  href: string;
  className?: string;
};

/** DESIGN.md §4 needs-attention item: severity icon + one-line sentence, tap-through. */
export function NeedsAttentionItem({ severity, sentence, href, className }: NeedsAttentionItemProps) {
  const { icon: SeverityIcon, className: toneClass } = SEVERITY[severity];
  return (
    <Link
      href={href}
      className={cx(
        "flex min-h-[64px] lg:min-h-12 w-full items-center gap-3 px-4 py-2",
        "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-chalk",
        className,
      )}
    >
      <SeverityIcon size={24} aria-hidden="true" className={cx("shrink-0", toneClass)} />
      <span className="text-body text-ink">{sentence}</span>
    </Link>
  );
}
