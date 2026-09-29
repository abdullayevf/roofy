import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import { CircleNotch } from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { Icon } from "./icon";
import { cx } from "@/lib/cx";
import { focusRing } from "./focus";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "link";

type Shared = {
  variant?: ButtonVariant;
  /** Destructive tone: `over` text on surface. Filled destructive is for confirmation sheets only. */
  tone?: "danger";
  /** Solid `over` fill — only valid with `tone="danger"`, only inside confirmation sheets. */
  filled?: boolean;
  loading?: boolean;
  /** The verb shown while loading, e.g. "Saving day". Defaults to the button's own label. */
  loadingLabel?: string;
  disabled?: boolean;
  /** Shown directly under a disabled button, at body size, when there's a reason to explain. */
  reason?: string;
  /** Demo-only: forces the focus ring so it shows up in a static screenshot. */
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

// min-height, not height: at 200% text zoom a label may wrap, and the button
// grows with it rather than clipping.
const SIZE = "min-h-[52px] lg:min-h-12 px-4 py-1 rounded-control text-body-strong";
// DESIGN.md §2: dimming a button's own fill (opacity) also dims its text,
// which can fall below 4.5:1. A disabled button keeps a fixed, always-legible
// treatment instead — `galv` fill, `line` border, ink-2 text — regardless of
// its variant or tone, so it reads as clearly "not a secondary button".
const DISABLED = "bg-galv text-ink-2 border border-line";

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
      return "bg-transparent text-chalk-link border border-transparent px-0 min-h-12 underline underline-offset-4";
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
    focusRing(props.focusVisible),
    props.className,
  );

  const content = (
    <>
      {props.icon ? <Icon icon={props.icon} /> : null}
      {props.iconOnly ? (
        <span className="sr-only">{props.label}</span>
      ) : props.loading ? (
        // The original label stays in the layout (hidden) so the button keeps
        // its width; what's visible is the loading verb plus a small
        // indicator (it only spins when motion is allowed).
        <span className="grid">
          <span aria-hidden="true" className="invisible col-start-1 row-start-1">
            {props.children}
          </span>
          <span className="col-start-1 row-start-1 flex items-center justify-center gap-2 whitespace-nowrap">
            <CircleNotch size={24} aria-hidden="true" className="animate-spin" />
            {props.loadingLabel ?? props.children}
          </span>
        </span>
      ) : (
        <span>{props.children}</span>
      )}
    </>
  );

  // DESIGN.md §4/§8: every button meets the 48 px target, except a true
  // inline link (variant="link") — which still gets a 48 px tall tap area
  // here, but is marked so automated checks can tell it apart.
  const control = props.href ? (
    <Link
      href={props.href}
      aria-disabled={props.disabled || undefined}
      data-variant={props.variant ?? "primary"}
      className={className}
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
      className={className}
    >
      {content}
    </button>
  );

  if (!props.disabled || !props.reason) return control;

  return (
    <span className="inline-flex flex-col gap-2">
      {control}
      <span className="text-body text-ink-2">{props.reason}</span>
    </span>
  );
}
