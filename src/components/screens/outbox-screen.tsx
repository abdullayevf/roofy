"use client";

import { useState } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import type { OutboxItem, OutboxState } from "@/data/contracts";
import { formatDate } from "@/lib/format";
import { cx } from "@/lib/cx";
import { EmptyState } from "@/components/empty-state";
import { KeepTogether } from "@/components/keep-together";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip, type Status } from "@/components/ui/status-chip";
import { ENTRY_WIDTH, EntryEmptyFrame, LoadError } from "./field-entry";
import { editHref, groupOutbox, outboxLine, outboxReason } from "./field-input";

const CHIP: Record<OutboxState, Status> = {
  waiting: "waiting",
  sending: "sending",
  sent: "sent",
  needs_attention: "needs-attention",
};

/**
 * Outbox (flows.md screen 24): every field entry by state: Needs attention, Sending, Waiting, Sent. A Needs
 * attention card carries the server's own reason, Edit and resend (reopens the original screen filled in) and
 * Discard, all in view; a manager reads the server's message with its next step, a foreman the "Ask your manager"
 * wording. Each state is one grouped block with `line` dividers, the status at the top right of every row (none in
 * Needs attention, where the heading says it). Reads the phone's own queue, so it works with no signal. (Phase 2 shows the demo outbox;
 * Phase 5 swaps in the device queue.)
 */
export function OutboxScreen({ items, today, foreman = false }: { items: OutboxItem[]; today: string; foreman?: boolean }) {
  const [gone, setGone] = useState<string[]>([]);
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
        <EntryEmptyFrame>
          <EmptyState message="Nothing is waiting to send." actionLabel="Go to Log" href="/log" />
        </EntryEmptyFrame>
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
                return (
                  <li key={id} className="flex flex-col gap-3 px-4 py-3">
                    <div className="flex min-h-10 items-start justify-between gap-3">
                      <span className="flex min-w-0 flex-col items-start gap-0.5">
                        <span className="text-body-strong text-ink">{kind}</span>
                        <span className="text-meta text-ink-2 [overflow-wrap:anywhere]">
                          <KeepTogether text={detail} />
                        </span>
                        <span className="text-meta text-ink-2">{formatDate(item.date, today)}</span>
                      </span>
                      {attention ? null : <StatusChip status={CHIP[item.state]} plain className="shrink-0" />}
                    </div>
                    {attention ? (
                      <div className="flex flex-col gap-3">
                        <p className="flex items-start gap-2 text-body text-over">
                          <WarningCircle size={24} aria-hidden="true" className="shrink-0" />
                          <span className="min-w-0">{outboxReason(item.rejection, foreman)}</span>
                        </p>
                        <div className="flex flex-col gap-3 tablet:flex-row">
                          <Button href={editHref(item.entry)} className="w-full tablet:w-auto">
                            Edit and resend
                          </Button>
                          <Button variant="secondary" tone="danger" onClick={() => setConfirm(id)} className="w-full tablet:w-auto">
                            Discard
                          </Button>
                        </div>
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
          setNotice("Entry discarded. Nothing was sent.");
        }}
      />
    </div>
  );
}

/** The outbox failed to load: the title stays, and the list area says so and offers a retry. */
export function OutboxError() {
  return (
    <div data-screen="outbox" className={cx("flex flex-col gap-6", ENTRY_WIDTH)}>
      <h1 className="text-title text-ink">Outbox</h1>
      <LoadError />
    </div>
  );
}

/** The outbox while it loads (`?demo=loading`): a heading and rows shaped like an entry with its status. */
export function OutboxSkeleton() {
  return (
    <div data-screen="outbox" aria-busy="true" className={cx("flex flex-col gap-6", ENTRY_WIDTH)}>
      <h1 className="text-title text-ink">Outbox</h1>
      <div className="flex flex-col gap-2">
        <Skeleton width={160} height={24} />
        <div className="divide-y divide-line overflow-hidden rounded-group border-group bg-surface">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="flex flex-col gap-1.5">
                <Skeleton width={96} height={20} />
                <Skeleton width={200} height={16} />
                <Skeleton width={72} height={16} />
              </div>
              <Skeleton width={72} height={24} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
