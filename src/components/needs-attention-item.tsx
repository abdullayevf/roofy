import Link from "next/link";
import { CaretRight, WarningCircle, WarningDiamond } from "@phosphor-icons/react/dist/ssr";
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

/**
 * DESIGN.md §4 needs-attention item: severity icon + one-line sentence,
 * tap-through — the same whole-row target, trailing caret and pressed
 * state as a list row (`ui/list.tsx`).
 */
export function NeedsAttentionItem({ severity, sentence, href, className }: NeedsAttentionItemProps) {
  const { icon: SeverityIcon, className: toneClass } = SEVERITY[severity];
  return (
    <Link
      href={href}
      className={cx(
        "flex min-h-[64px] lg:min-h-12 w-full items-center gap-3 px-4 py-2 lg:py-1",
        "focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-3 focus-visible:outline-chalk-link",
        "active:bg-galv",
        className,
      )}
    >
      <SeverityIcon size={24} aria-hidden="true" className={cx("shrink-0", toneClass)} />
      <span className="flex-1 text-body text-ink">{sentence}</span>
      <CaretRight size={24} aria-hidden="true" className="shrink-0 text-ink-2" />
    </Link>
  );
}
