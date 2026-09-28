import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { Icon } from "./icon";
import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "link";

type Shared = {
  variant?: ButtonVariant;
  /** Destructive tone: `over` text on surface. Filled destructive is for confirmation sheets only. */
  tone?: "danger";
  /** Solid `over` fill — only valid with `tone="danger"`, only inside confirmation sheets. */
  filled?: boolean;
  loading?: boolean;
  disabled?: boolean;
  /** Shown below the button, in meta/ink-2, when disabled and there's a reason to explain — e.g. "Needs connection — try again once you're back online." */
  reason?: string;
  /** Demo-only: forces the focus-visible ring so it shows up in a static screenshot. */
  focusVisible?: boolean;
  icon?: PhosphorIcon;
  className?: string;
  type?: "button" | "submit" | "reset";
  href?: string;
  onClick?: ComponentPropsWithoutRef<"button">["onClick"];
  name?: string;
  value?: string;
};

export type ButtonProps =
  | (Shared & { children: ReactNode; iconOnly?: false; label?: never })
  | (Shared & { iconOnly: true; label: string; icon: PhosphorIcon; children?: never });

const SIZE = "h-[52px] lg:h-12 px-4 rounded-control text-body-strong";
const FOCUS =
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-chalk";
const FORCED_FOCUS = "outline outline-[3px] outline-offset-2 outline-chalk";
// DESIGN.md §2: dimming a button's own fill (opacity) also dims its text,
// which can fall below 4.5:1. A disabled button keeps a fixed, always-legible
// treatment instead — surface fill, ink-2 text, edge border — regardless of
// its variant or tone.
const DISABLED = "bg-surface text-ink-2 border-[1.5px] border-edge";

function variantClasses(props: ButtonProps): string {
  if (props.disabled) return DISABLED;
  if (props.tone === "danger") {
    return props.filled
      ? "bg-over text-on-over border border-transparent"
      : "bg-transparent text-over border border-transparent";
  }
  switch (props.variant ?? "primary") {
    case "primary":
      return "bg-chalk text-on-chalk border border-transparent";
    case "secondary":
      return "bg-surface text-ink border-[1.5px] border-edge";
    case "ghost":
      return "bg-transparent text-ink border border-transparent";
    case "link":
      return "bg-transparent text-chalk-link border border-transparent px-0 h-auto underline-offset-4 hover:underline";
  }
}

/**
 * DESIGN.md §4 Button. Icon-only buttons require `label` (enforced at the
 * type level by the discriminated union above, and again at runtime here
 * since props can still arrive un-typed from JS callers or tests).
 */
export function Button(props: ButtonProps) {
  if (props.iconOnly && !props.label) {
    throw new Error("Button: an icon-only button requires a `label` for screen readers.");
  }
  const isLink = props.variant === "link";
  const className = cx(
    "inline-flex items-center justify-center gap-2",
    isLink && !props.disabled ? "" : SIZE,
    isLink && !props.iconOnly ? "text-body-strong" : "",
    props.iconOnly && "w-[52px] lg:w-12 px-0",
    variantClasses(props),
    props.disabled && "pointer-events-none",
    props.focusVisible ? FORCED_FOCUS : FOCUS,
    props.className,
  );

  const content = (
    <>
      {props.icon ? <Icon icon={props.icon} /> : null}
      {props.iconOnly ? (
        <span className="sr-only">{props.label}</span>
      ) : (
        // opacity, not `invisible` (visibility:hidden): the real label must
        // stay in the accessibility tree as the button's name while loading,
        // even though the "Working" text below is what's visually shown.
        <span className={props.loading ? "opacity-0" : undefined}>{props.children}</span>
      )}
      {props.loading && !props.iconOnly ? (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="text-body-strong">Working</span>
        </span>
      ) : null}
    </>
  );

  // DESIGN.md §4/§8: every button meets the 48 px target, except a true
  // inline link (variant="link"), which reads inline in a sentence rather
  // than standing alone as a discrete tap target. `data-variant` lets
  // automated checks (and this component's own gallery) tell the two apart.
  const control = props.href ? (
    <Link
      href={props.href}
      aria-disabled={props.disabled || undefined}
      data-variant={props.variant ?? "primary"}
      className={cx(className, props.loading && "relative")}
    >
      {content}
    </Link>
  ) : (
    <button
      type={props.type ?? "button"}
      disabled={props.disabled || props.loading}
      aria-busy={props.loading || undefined}
      onClick={props.onClick}
      name={props.name}
      value={props.value}
      data-variant={props.variant ?? "primary"}
      className={cx(className, props.loading && "relative")}
    >
      {content}
    </button>
  );

  if (!props.disabled || !props.reason) return control;

  return (
    <span className="inline-flex flex-col gap-1.5">
      {control}
      <span className="text-meta text-ink-2">{props.reason}</span>
    </span>
  );
}
