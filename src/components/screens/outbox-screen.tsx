"use client";

import { useState } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import type { OutboxItem, OutboxState } from "@/data/contracts";
import { formatDate } from "@/lib/format";
import { cx } from "@/lib/cx";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip, type Status } from "@/components/ui/status-chip";
import { ENTRY_WIDTH } from "./field-entry";
import { editHref, groupOutbox, outboxLine } from "./field-input";

const CHIP: Record<OutboxState, Status> = {
  waiting: "waiting",
  sending: "sending",
  sent: "sent",
  needs_attention: "needs-attention",
};

/**
 * Outbox (flows.md screen 24): every field entry by state: Needs attention, Sending, Waiting, Sent. A Needs
 * attention row opens to the server's own reason with Edit and resend / Discard. Reads the phone's own queue, so
 * it works with no signal. (Phase 2 shows the demo outbox; Phase 5 swaps in the device queue.)
 */
export function OutboxScreen({ items, today }: { items: OutboxItem[]; today: string }) {
  const [gone, setGone] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const groups = groupOutbox(items.filter((i) => !gone.includes(i.entry.id)));

  return (
    <div data-screen="outbox" className={cx("flex flex-col gap-6", ENTRY_WIDTH)}>
      <h1 className="text-title text-ink">Outbox</h1>
      <div role="status" className="empty:hidden">
        {notice ? <p className="text-body text-ink-2">{notice}</p> : null}
      </div>

      {groups.length === 0 ? (
        <EmptyState message="Nothing is waiting to send." actionLabel="Go to Log" href="/log" />
      ) : (
        groups.map((g) => (
          <section key={g.state} aria-labelledby={`outbox-${g.state}`} className="flex flex-col gap-2">
            <h2 id={`outbox-${g.state}`} className="text-heading text-ink">
              {g.title} <span className="text-ink-2">({g.items.length})</span>
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-group border-group bg-surface">
              {g.items.map((item) => {
                const { kind, detail } = outboxLine(item);
                const id = item.entry.id;
                const attention = item.state === "needs_attention";
                const expanded = open === id;
                const summary = (
                  <>
                    <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                      <span className="text-body-strong text-ink">{kind}</span>
                      <span className="text-meta text-ink-2 [overflow-wrap:anywhere]">{detail}</span>
                      <span className="text-meta text-ink-2">{formatDate(item.date, today)}</span>
                    </span>
                    <StatusChip status={CHIP[item.state]} className="shrink-0" />
                  </>
                );
                return (
                  <li key={id}>
                    {attention ? (
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={`outbox-reason-${id}`}
                        onClick={() => setOpen(expanded ? null : id)}
                        className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-2 text-left active:bg-galv focus-visible:outline focus-visible:outline-[3px] focus-visible:-outline-offset-3 focus-visible:outline-chalk-link"
                      >
                        {summary}
                      </button>
                    ) : (
                      <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-2">{summary}</div>
                    )}
                    {attention && expanded ? (
                      <div id={`outbox-reason-${id}`} className="flex flex-col gap-3 px-4 pb-4">
                        <p className="flex items-start gap-2 text-body text-over">
                          <WarningCircle size={24} aria-hidden="true" className="shrink-0" />
                          {item.rejection?.message ?? "This entry couldn't be sent."}
                        </p>
                        <Button href={editHref(item.entry)} className="w-full">
                          Edit and resend
                        </Button>
                        <Button variant="secondary" tone="danger" onClick={() => setConfirm(id)} className="w-full">
                          Discard
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <Dialog
        open={confirm !== null}
        onOpenChange={(o) => {
          if (!o) setConfirm(null);
        }}
        title="Discard this entry?"
        description="It won't be sent, and you can't get it back."
        confirmLabel="Discard entry"
        tone="danger"
        onConfirm={() => {
          if (confirm) setGone((prev) => [...prev, confirm]);
          setOpen(null);
          setNotice("Entry discarded. Nothing was sent.");
        }}
      />
    </div>
  );
}

/** The outbox while it loads (`?demo=loading`). */
export function OutboxSkeleton() {
  return (
    <div data-screen="outbox" aria-busy="true" className={cx("flex flex-col gap-6", ENTRY_WIDTH)}>
      <h1 className="text-title text-ink">Outbox</h1>
      <Skeleton width={160} height={24} />
      <div className="divide-y divide-line overflow-hidden rounded-group border-group bg-surface">
        {[0, 1, 2].map((i) => (
          <div key={i} className="px-4 py-4">
            <Skeleton height={40} />
          </div>
        ))}
      </div>
    </div>
  );
}
