"use client";

import { useEffect, useRef, useState } from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { cx } from "@/lib/cx";
import { FOCUS } from "./home-parts";

const WIDE = "(min-width: 1024px)";

/** The element a same-page `#…` link or the address points at, if it is inside `root`. */
function targetIn(root: HTMLElement | null, hash: string): HTMLElement | null {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  const el = id ? document.getElementById(id) : null;
  return el && root?.contains(el) ? el : null;
}

/**
 * One person in a pay run (pay iter1 D5). Below 1024 px the group folds to the name and total; tap the row to show
 * the lines. A flag's tap-through (or the address) to one of this person's lines opens it and scrolls to the line.
 * From 1024 px every group shows its lines and the row is a plain heading.
 */
export function PayPersonFold({
  id,
  className,
  kind,
  labelledBy,
  header,
  children,
}: {
  id: string;
  className?: string;
  kind: string;
  labelledBy: string;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const sync = () => setWide(mq.matches);
    const reveal = (hash: string) => {
      const el = targetIn(ref.current, hash);
      if (!el) return;
      setOpen(true);
      // After the lines show (and after the router's own scroll, which can't reach a hidden line).
      window.setTimeout(() => el.scrollIntoView({ block: "start" }), 50);
    };
    const onHash = () => reveal(window.location.hash);
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href^='#']");
      if (a) reveal(a.getAttribute("href") ?? "");
    };
    sync();
    onHash();
    mq.addEventListener("change", sync);
    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
    };
  }, []);
  const linesId = `${id}-lines`;
  const row = "grid w-full items-start gap-x-4 px-4 py-3 text-left";
  return (
    <section ref={ref} id={id} aria-labelledby={labelledBy} data-pay-person={kind} className={className}>
      <h3 className="text-heading text-ink">
        {wide ? (
          <span className={cx(row, "grid-cols-[minmax(0,1fr)_auto]")}>{header}</span>
        ) : (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={linesId}
            data-person-toggle=""
            onClick={() => setOpen((o) => !o)}
            className={cx(row, "min-h-12 grid-cols-[minmax(0,1fr)_auto_auto] active:bg-galv first:rounded-t-group", FOCUS)}
          >
            {header}
            <CaretDown size={24} aria-hidden="true" className={cx("self-center text-ink-2", open && "rotate-180")} />
          </button>
        )}
      </h3>
      <div id={linesId} data-person-lines="" className={open ? undefined : "max-lg:hidden"}>
        {children}
      </div>
    </section>
  );
}
