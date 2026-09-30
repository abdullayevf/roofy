"use client";
import { useState } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";
import { NeedsAttentionItem, type NeedsAttentionSeverity } from "@/components/needs-attention-item";

export type AttentionRow = { id: string; severity: NeedsAttentionSeverity; sentence: string; href: string };

const FOCUS =
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-3 focus-visible:outline-chalk-link";

/**
 * Home's Needs attention rows: the 7 the spec shows, then a full-width 48 px "Show N more" row that opens the rest
 * in place (there is no separate list screen).
 */
export function AttentionList({ rows, more, showMoreLabel }: { rows: AttentionRow[]; more: AttentionRow[]; showMoreLabel: string }) {
  const [open, setOpen] = useState(false);
  const shown = open ? [...rows, ...more] : rows;
  return (
    <>
      {shown.map((r) => (
        <NeedsAttentionItem key={r.id} severity={r.severity} sentence={r.sentence} href={r.href} />
      ))}
      {more.length > 0 ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-body-strong text-ink last:rounded-b-group active:bg-galv ${FOCUS}`}
        >
          {open ? "Show fewer" : showMoreLabel}
          {open ? (
            <CaretUp size={24} aria-hidden="true" className="shrink-0 text-ink-2" />
          ) : (
            <CaretDown size={24} aria-hidden="true" className="shrink-0 text-ink-2" />
          )}
        </button>
      ) : null}
    </>
  );
}
